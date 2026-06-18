from rest_framework import serializers

MAX_EXPORT_PRODUCT_IDS = 1000


class ProductExportRequestSerializer(serializers.Serializer):
    product_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=MAX_EXPORT_PRODUCT_IDS,
    )
    format = serializers.ChoiceField(choices=("xlsx", "pdf"), default="xlsx")
