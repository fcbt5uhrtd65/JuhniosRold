from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone

from ..domain.entities import CategoryEntity, ProductEntity, ProductVariantEntity
from ..domain.repositories import ProductRepository
from .models import Category, Price, Product, ProductVariant


class DjangoProductRepository(ProductRepository):
    def get(self, product_id) -> ProductEntity | None:
        product = (
            Product.objects.select_related("category")
            .prefetch_related(
                Prefetch(
                    "variants",
                    queryset=ProductVariant.objects.prefetch_related(
                        Prefetch(
                            "prices",
                            queryset=Price.objects.filter(is_active=True).order_by("-valid_from", "-created_at"),
                        )
                    ),
                )
            )
            .filter(id=product_id)
            .first()
        )
        if not product:
            return None
        return self._to_entity(product)

    @transaction.atomic
    def save(self, product: ProductEntity) -> ProductEntity:
        category = Category.objects.get(id=product.category.id)
        product_model, _ = Product.objects.update_or_create(
            id=product.id,
            defaults={
                "category": category,
                "name": product.name,
                "slug": product.slug,
                "description": product.description,
                "is_active": product.is_active,
                "is_featured": product.is_featured,
            },
        )

        for variant in product.variants:
            variant_model, _ = ProductVariant.objects.update_or_create(
                id=variant.id,
                defaults={
                    "product": product_model,
                    "sku": variant.sku,
                    "name": variant.name,
                    "attributes": variant.attributes,
                    "cost": variant.cost,
                    "is_active": variant.is_active,
                },
            )
            if variant.price is not None:
                self._sync_price(variant_model, variant.price)

        saved_product = self.get(product_model.id)
        if saved_product is None:
            raise RuntimeError("No se pudo reconstruir el producto guardado.")
        return saved_product

    def _to_entity(self, product: Product) -> ProductEntity:
        return ProductEntity(
            id=product.id,
            name=product.name,
            slug=product.slug,
            description=product.description,
            category=self._to_category_entity(product.category),
            variants=[self._to_variant_entity(variant) for variant in product.variants.all()],
            is_active=product.is_active,
            is_featured=product.is_featured,
        )

    def _to_category_entity(self, category: Category) -> CategoryEntity:
        return CategoryEntity(
            id=category.id,
            name=category.name,
            slug=category.slug,
            is_active=category.is_active,
            parent_id=category.parent_id,
        )

    def _to_variant_entity(self, variant: ProductVariant) -> ProductVariantEntity:
        current_price = next(iter(variant.prices.all()), None)
        return ProductVariantEntity(
            id=variant.id,
            sku=variant.sku,
            name=variant.name,
            cost=variant.cost,
            attributes=variant.attributes or {},
            price=current_price.amount if current_price else None,
            is_active=variant.is_active,
        )

    def _sync_price(self, variant: ProductVariant, amount):
        current_price = (
            Price.objects.filter(variant=variant, is_active=True).order_by("-valid_from", "-created_at").first()
        )
        if current_price and current_price.amount == amount:
            return current_price

        now = timezone.now()
        if current_price:
            current_price.is_active = False
            current_price.valid_until = now
            current_price.save(update_fields=("is_active", "valid_until", "updated_at"))

        return Price.objects.create(
            variant=variant,
            amount=amount,
            currency=current_price.currency if current_price else "COP",
            valid_from=now,
            valid_until=None,
            is_active=True,
        )
