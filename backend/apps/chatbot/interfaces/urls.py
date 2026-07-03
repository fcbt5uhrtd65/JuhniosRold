from django.urls import path

from .views import ChatbotMessageView, DialogflowWebhookView


urlpatterns = [
    path("message/", ChatbotMessageView.as_view(), name="message"),
    path("local-message/", ChatbotMessageView.as_view(), name="local-message"),
    path("dialogflow/webhook/", DialogflowWebhookView.as_view(), name="dialogflow-webhook"),
]
