from django.contrib import admin

from .models import Category, Price, Product, ProductImage, ProductReview, ProductVariant


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    fields = ("sku", "name", "presentation_number", "presentation_unit", "cost", "is_active")


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    max_num = 3
    fields = ("image", "alt_text", "position", "is_primary")


class PriceInline(admin.TabularInline):
    model = Price
    extra = 0
    fields = ("amount", "currency", "valid_from", "valid_until", "is_active")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "parent", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    list_select_related = ("parent",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_active", "is_featured", "updated_at")
    list_filter = ("is_active", "is_featured", "category")
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("name",)}
    list_select_related = ("category",)
    inlines = (ProductVariantInline, ProductImageInline)


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ("sku", "product", "name", "presentation_number", "presentation_unit", "cost", "is_active", "updated_at")
    list_filter = ("is_active", "product__category")
    search_fields = ("sku", "name", "product__name")
    list_select_related = ("product", "product__category")
    inlines = (PriceInline,)


@admin.register(Price)
class PriceAdmin(admin.ModelAdmin):
    list_display = ("variant", "amount", "currency", "valid_from", "valid_until", "is_active")
    list_filter = ("currency", "is_active")
    search_fields = ("variant__sku", "variant__product__name")
    list_select_related = ("variant", "variant__product")
    date_hierarchy = "valid_from"


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("product", "alt_text", "position", "is_primary", "updated_at")
    list_filter = ("is_primary",)
    search_fields = ("product__name", "alt_text")
    list_select_related = ("product",)


@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ("product", "user", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = ("product__name", "user__email", "comment")
    list_select_related = ("product", "user")
