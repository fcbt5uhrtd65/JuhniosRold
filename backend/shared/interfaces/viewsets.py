from rest_framework import viewsets


class SoftDeleteModelViewSet(viewsets.ModelViewSet):
    def perform_destroy(self, instance):
        instance.soft_delete()
