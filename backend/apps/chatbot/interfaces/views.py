import hmac

from django.conf import settings
from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..application import ChatbotService
from .serializers import ChatbotMessageSerializer, DialogflowWebhookSerializer

CHATBOT_CONTEXT_CACHE_PREFIX = "chatbot:context:"
CHATBOT_CONTEXT_TTL_SECONDS = 10 * 60


class ChatbotMessageView(APIView):
    permission_classes = (permissions.AllowAny,)
    service_class = ChatbotService

    def post(self, request):
        serializer = ChatbotMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.validated_data["message"]
        session_id = serializer.validated_data.get("sessionId")

        context = self._get_context(session_id)
        service = self.service_class()
        response = service.respond_to_text(message, context=context)
        self._save_context(session_id, response.pending_intent)

        payload = response.as_api_payload()
        if session_id:
            payload["sessionId"] = session_id
        return Response(payload, status=status.HTTP_200_OK)

    def _get_context(self, session_id: str | None) -> dict:
        if not session_id:
            return {}
        pending_intent = cache.get(f"{CHATBOT_CONTEXT_CACHE_PREFIX}{session_id}")
        return {"pending_intent": pending_intent} if pending_intent else {}

    def _save_context(self, session_id: str | None, pending_intent: str | None) -> None:
        if not session_id:
            return
        cache_key = f"{CHATBOT_CONTEXT_CACHE_PREFIX}{session_id}"
        if pending_intent:
            cache.set(cache_key, pending_intent, timeout=CHATBOT_CONTEXT_TTL_SECONDS)
        else:
            # Cualquier respuesta que no vuelva a quedar esperando un dato
            # limpia el contexto pendiente, para no arrastrar un "envio" viejo
            # a una pregunta nueva que no tiene nada que ver.
            cache.delete(cache_key)


class DialogflowWebhookView(APIView):
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()
    service_class = ChatbotService

    def post(self, request):
        expected_token = settings.DIALOGFLOW_WEBHOOK_TOKEN
        if expected_token:
            received_token = request.headers.get("X-Webhook-Token", "")
            if not hmac.compare_digest(received_token, expected_token):
                return Response(
                    {"detail": "Token de webhook invalido."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        serializer = DialogflowWebhookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query_result = serializer.validated_data.get("queryResult") or {}
        intent = query_result.get("intent") or {}
        intent_name = intent.get("displayName") or "Fallback"
        parameters = query_result.get("parameters") or {}
        query_text = query_result.get("queryText") or ""

        service = self.service_class()
        response = service.respond_to_intent(
            intent_name,
            parameters=parameters,
            query_text=query_text,
        )
        return Response(response.as_api_payload(), status=status.HTTP_200_OK)
