from django.urls import path

from .views import NotificationListView, NotificationMarkAllReadView, NotificationMarkReadView

urlpatterns = [
    path("", NotificationListView.as_view(), name="notifications-list"),
    path("read-all/", NotificationMarkAllReadView.as_view(), name="notifications-read-all"),
    path("<uuid:pk>/read/", NotificationMarkReadView.as_view(), name="notification-read"),
]
