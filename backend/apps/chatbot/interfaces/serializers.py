from rest_framework import serializers


class ChatbotMessageSerializer(serializers.Serializer):
    message = serializers.CharField(trim_whitespace=True, allow_blank=False)
    sessionId = serializers.CharField(required=False, allow_blank=True)


class DialogflowIntentSerializer(serializers.Serializer):
    displayName = serializers.CharField(required=False, allow_blank=True)


class DialogflowQueryResultSerializer(serializers.Serializer):
    intent = DialogflowIntentSerializer(required=False)
    parameters = serializers.DictField(required=False)
    queryText = serializers.CharField(required=False, allow_blank=True)


class DialogflowWebhookSerializer(serializers.Serializer):
    queryResult = DialogflowQueryResultSerializer(required=False)
    session = serializers.CharField(required=False, allow_blank=True)
