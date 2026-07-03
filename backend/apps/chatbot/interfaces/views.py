from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..application import ChatbotService
from .serializers import ChatbotMessageSerializer, DialogflowWebhookSerializer


class ChatbotMessageView(APIView):
    permission_classes = (permissions.AllowAny,)
    service_class = ChatbotService

    def post(self, request):
        serializer = ChatbotMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = self.service_class()
        response = service.respond_to_text(serializer.validated_data["message"])
        payload = response.as_api_payload()
        session_id = serializer.validated_data.get("sessionId")
        if session_id:
            payload["sessionId"] = session_id
        return Response(payload, status=status.HTTP_200_OK)


class DialogflowWebhookView(APIView):
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()
    service_class = ChatbotService

    def post(self, request):
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
