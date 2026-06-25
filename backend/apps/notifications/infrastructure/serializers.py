from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "type", "title", "message", "action_url", "read", "read_at", "created_at")
        read_only_fields = ("id", "type", "title", "message", "action_url", "read_at", "created_at")
