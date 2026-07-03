from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from decimal import Decimal
from urllib.parse import quote

from django.conf import settings
from django.db.models import Prefetch, Q
from django.utils import timezone

from apps.catalog.infrastructure.models import Price, Product, ProductVariant
from apps.commerce.infrastructure.models import Order, WholesaleSettings
from apps.inventory.infrastructure.models import Stock


@dataclass(frozen=True)
class ChatbotProduct:
    id: str
    name: str
    description: str
    catalog_path: str
    price_from: Decimal | None = None
    available_quantity: Decimal | None = None

    def as_payload(self) -> dict:
        payload = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "catalogPath": self.catalog_path,
        }
        if self.price_from is not None:
            payload["priceFrom"] = str(self.price_from)
        if self.available_quantity is not None:
            payload["availableQuantity"] = str(self.available_quantity)
        return payload


@dataclass(frozen=True)
class ChatbotResponse:
    fulfillment_text: str
    intent: str
    payload: dict = field(default_factory=dict)

    def as_api_payload(self) -> dict:
        return {
            "fulfillmentText": self.fulfillment_text,
            "intent": self.intent,
            "payload": self.payload,
        }


NEED_ALIASES = {
    "encrespamiento": "frizz",
    "cabello reseco": "cabello seco",
    "pelo seco": "cabello seco",
    "resequedad": "cabello seco",
    "sin brillo": "cabello opaco",
    "cabello apagado": "cabello opaco",
    "puntas abiertas": "puntas secas",
    "liso": "alisar",
    "alisado": "alisar",
    "controlar volumen": "alisar",
    "fortalecer": "caida",
    "se me cae el cabello": "caida",
    "sedosidad": "suavidad",
}

NEED_KEYWORDS = {
    "frizz": ("frizz", "encresp", "esponj"),
    "cabello seco": ("seco", "reseco", "resequ"),
    "cabello maltratado": ("maltrat", "procesado", "danado", "dañado"),
    "cabello tinturado": ("tintur", "tinte", "coloracion", "coloración"),
    "cabello opaco": ("opaco", "apagado", "sin brillo"),
    "puntas secas": ("puntas", "abiertas"),
    "alisar": ("liso", "alisar", "alisado", "volumen"),
    "caida": ("caida", "caída", "cae", "fortalecer"),
    "brillo": ("brillo", "brillante"),
    "suavidad": ("suave", "suavidad", "sedos"),
}

PRODUCT_NEEDS = {
    "full liso": ("frizz", "alisar", "suavidad", "cabello maltratado"),
    "aceite de argan": ("brillo", "suavidad", "puntas secas", "cabello opaco"),
    "aceite de coco": ("cabello seco", "suavidad", "puntas secas"),
    "tratamiento capilar nutritivo": (
        "cabello seco",
        "cabello maltratado",
        "cabello opaco",
        "brillo",
    ),
    "tono sobre tono": ("cabello tinturado", "cabello opaco", "brillo"),
    "keratina": ("frizz", "alisar", "suavidad", "cabello maltratado"),
    "romero y quina": ("caida", "cabello opaco"),
    "locion corporal": ("suavidad",),
}

CITY_DELIVERY_DAYS = {
    "bogota": "2-3 dias habiles",
    "medellin": "2-3 dias habiles",
    "cali": "3-4 dias habiles",
    "barranquilla": "3-4 dias habiles",
    "cartagena": "3-4 dias habiles",
    "bucaramanga": "3-4 dias habiles",
}

INTENT_KEYWORDS = (
    ("Comprar producto", ("comprar", "compra", "quiero comprar", "agregar", "carrito")),
    ("Recomendar producto", ("recom", "frizz", "brillo", "seco", "maltrat", "tintur", "caida", "caída", "suave", "liso")),
    ("Consulta de envio", ("envio", "envío", "entrega", "demora", "llega", "domicilio")),
    ("Compra mayorista", ("mayor", "distribuidor", "salon", "salón", "peluqueria", "peluquería", "negocio")),
    ("Formas de pago", ("pago", "tarjeta", "wompi", "transferencia", "efectivo")),
    ("Estado de pedido", ("pedido", "guia", "guía", "tracking", "orden")),
    ("Promociones", ("promo", "descuento", "oferta")),
    ("Catalogo", ("catalogo", "catálogo", "productos")),
    ("Hablar con asesor", ("asesor", "whatsapp", "humano", "persona")),
)


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return normalized.lower().strip()


def first_string(parameters: dict, name: str) -> str:
    value = parameters.get(name)
    if isinstance(value, list):
        return next((item.strip() for item in value if isinstance(item, str) and item.strip()), "")
    return value.strip() if isinstance(value, str) else ""


class ChatbotService:
    catalog_path = "/catalogo"

    def respond_to_text(self, message: str) -> ChatbotResponse:
        normalized = normalize_text(message)
        intent_name = self.detect_local_intent(normalized)
        parameters = self.extract_local_parameters(normalized)
        return self.respond_to_intent(intent_name, parameters=parameters, query_text=message)

    def respond_to_intent(
        self,
        intent_name: str,
        *,
        parameters: dict | None = None,
        query_text: str = "",
    ) -> ChatbotResponse:
        parameters = parameters or {}
        handlers = {
            "Comprar producto": self.buy_product,
            "Recomendar producto": self.recommend,
            "Compra mayorista": self.wholesale,
            "Consulta de envio": self.shipping_info,
            "Formas de pago": self.payment_methods,
            "Estado de pedido": self.order_status,
            "Catalogo": self.catalog,
            "Promociones": self.promotions,
            "Hablar con asesor": self.human_handoff,
            "Fallback": self.fallback,
        }
        handler = handlers.get(intent_name, self.fallback)
        return handler(parameters, query_text=query_text)

    def detect_local_intent(self, normalized_message: str) -> str:
        for intent_name, keywords in INTENT_KEYWORDS:
            if any(keyword in normalized_message for keyword in keywords):
                return intent_name
        return "Fallback"

    def extract_local_parameters(self, normalized_message: str) -> dict:
        parameters = {}
        need = self.extract_need(normalized_message)
        if need:
            parameters["necesidad_capilar"] = need

        city = self.extract_city(normalized_message)
        if city:
            parameters["ciudad"] = city

        product = self.find_product_name_in_text(normalized_message)
        if product:
            parameters["producto"] = product

        order_number = self.extract_order_number(normalized_message)
        if order_number:
            parameters["numero_pedido"] = order_number

        return parameters

    def recommend(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        need = self.normalize_need(first_string(parameters, "necesidad_capilar"))
        products = self.find_products_for_need(need)

        if not need:
            text = (
                "Para recomendarte mejor, dime si buscas controlar frizz, brillo, suavidad, "
                "nutricion o cuidado para cabello tinturado."
            )
        elif products:
            names = ", ".join(product.name for product in products)
            text = (
                f"Para {need}, estas opciones pueden ayudarte desde el cuidado cosmetico: "
                f"{names}. Mira el catalogo o te paso con un asesor para elegir el ideal."
            )
        else:
            return self.with_advisor(
                "No tengo una recomendacion exacta para esa necesidad. Te conecto con un asesor para ayudarte sin inventar.",
                "Recomendar producto",
                need or query_text or "recomendacion personalizada",
            )

        return ChatbotResponse(
            fulfillment_text=text,
            intent="Recomendar producto",
            payload={
                "catalogUrl": self.catalog_path,
                "whatsappUrl": self.advisor_link(f"recomendacion para {need or 'mi cabello'}"),
                "products": [product.as_payload() for product in products],
            },
        )

    def buy_product(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        product_name = first_string(parameters, "producto") or self.find_product_name_in_text(query_text)
        product = self.find_product(product_name)

        if not product_name:
            return ChatbotResponse(
                fulfillment_text="Claro. Puedes comprar desde el catalogo. Si quieres, dime el producto y te guio.",
                intent="Comprar producto",
                payload={
                    "catalogUrl": self.catalog_path,
                    "whatsappUrl": self.advisor_link("comprar un producto"),
                },
            )

        if product is None:
            return self.with_advisor(
                "No tengo informacion exacta de ese producto en este momento.",
                "Comprar producto",
                f"comprar {product_name}",
            )

        return ChatbotResponse(
            fulfillment_text=(
                f"{product.name} esta en nuestro catalogo. Para evitar datos desactualizados, "
                "confirma precio y disponibilidad en la tienda o con un asesor."
            ),
            intent="Comprar producto",
            payload={
                "catalogUrl": product.catalog_path,
                "whatsappUrl": self.advisor_link(f"comprar {product.name}"),
                "products": [product.as_payload()],
            },
        )

    def shipping_info(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        city = first_string(parameters, "ciudad") or self.extract_city(query_text)
        city_key = normalize_text(city)
        delivery = CITY_DELIVERY_DAYS.get(city_key)

        if city and delivery:
            return ChatbotResponse(
                fulfillment_text=(
                    f"Si estas en {city}, la entrega estimada es {delivery}. "
                    "El valor final se confirma en el checkout."
                ),
                intent="Consulta de envio",
                payload={"catalogUrl": self.catalog_path},
            )

        if city:
            return self.with_advisor(
                f"Hacemos envios a Colombia. Para {city}, confirmemos cobertura y tiempo exacto con un asesor.",
                "Consulta de envio",
                f"envio a {city}",
            )

        return ChatbotResponse(
            fulfillment_text=(
                "Hacemos envios a Colombia. En ciudades principales la entrega estimada suele ser "
                "de 2 a 5 dias habiles. Dime tu ciudad y te oriento mejor."
            ),
            intent="Consulta de envio",
            payload={"whatsappUrl": self.advisor_link("consulta de envio")},
        )

    def wholesale(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        settings_obj = WholesaleSettings.current()
        text = (
            "Para compras mayoristas validamos cantidades, ciudad y productos con un asesor comercial. "
            f"La configuracion actual inicia desde ${settings_obj.minimum_purchase:,.0f} COP "
            f"con {settings_obj.discount_percentage.normalize()}% de descuento, sujeto a validacion."
        )
        return self.with_advisor(text, "Compra mayorista", "compra mayorista")

    def payment_methods(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return self.with_advisor(
            "Puedes pagar desde el checkout con los medios disponibles en la tienda. No confirmo medios especiales sin validarlo con un asesor.",
            "Formas de pago",
            "formas de pago",
        )

    def order_status(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        order_number = first_string(parameters, "numero_pedido") or self.extract_order_number(query_text)

        if not order_number:
            return self.with_advisor(
                "Para revisar tu pedido necesito numero de orden o guia. Si no lo tienes, un asesor te ayuda por WhatsApp.",
                "Estado de pedido",
                "estado de pedido",
            )

        order = (
            Order.objects.filter(number__iexact=order_number)
            .only("number", "status", "tracking_number")
            .first()
        )
        if order is None:
            return self.with_advisor(
                f"No encontre el pedido {order_number} con informacion publica suficiente.",
                "Estado de pedido",
                f"estado del pedido {order_number}",
            )

        tracking = f" Guia: {order.tracking_number}." if order.tracking_number else ""
        return ChatbotResponse(
            fulfillment_text=(
                f"El pedido {order.number} aparece como {order.get_status_display()}.{tracking} "
                "Si necesitas mas detalle, te paso con un asesor."
            ),
            intent="Estado de pedido",
            payload={"whatsappUrl": self.advisor_link(f"estado del pedido {order.number}")},
        )

    def promotions(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return self.with_advisor(
            "Las promociones cambian segun disponibilidad. Para no inventar descuentos, revisa el catalogo o habla con un asesor.",
            "Promociones",
            "promociones vigentes",
        )

    def catalog(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return ChatbotResponse(
            fulfillment_text=(
                "Claro. Puedes ver el catalogo completo y elegir tus productos favoritos. "
                "Si quieres recomendacion, dime que necesita tu cabello."
            ),
            intent="Catalogo",
            payload={
                "catalogUrl": self.catalog_path,
                "whatsappUrl": self.advisor_link("catalogo de productos"),
            },
        )

    def human_handoff(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return self.with_advisor(
            "Listo. Te conecto con un asesor por WhatsApp para ayudarte de forma personalizada.",
            "Hablar con asesor",
            query_text or "asesoria personalizada",
        )

    def fallback(self, parameters: dict | None = None, *, query_text: str = "") -> ChatbotResponse:
        return self.with_advisor(
            "No tengo esa informacion exacta y prefiero no inventarla.",
            "Fallback",
            query_text or "consulta no resuelta",
        )

    def with_advisor(self, text: str, intent: str, reason: str) -> ChatbotResponse:
        whatsapp_url = self.advisor_link(reason)
        return ChatbotResponse(
            fulfillment_text=f"{text} Puedes escribirnos por WhatsApp desde el boton de abajo.",
            intent=intent,
            payload={"whatsappUrl": whatsapp_url},
        )

    def advisor_link(self, reason: str) -> str:
        number = self.whatsapp_number()
        message = quote(
            f"Hola, vengo del asistente virtual de Juhnios Rold. Necesito ayuda con: {reason}"
        )
        return f"https://wa.me/{number}?text={message}"

    def whatsapp_number(self) -> str:
        configured = getattr(settings, "WHATSAPP_NUMBER", "") or "3000000000"
        digits = "".join(char for char in configured if char.isdigit())
        return digits if digits.startswith("57") else f"57{digits}"

    def normalize_need(self, need: str) -> str:
        normalized = normalize_text(need)
        return NEED_ALIASES.get(normalized, normalized)

    def extract_need(self, normalized_message: str) -> str:
        for need, keywords in NEED_KEYWORDS.items():
            if any(normalize_text(keyword) in normalized_message for keyword in keywords):
                return need
        return ""

    def extract_city(self, text: str) -> str:
        normalized = normalize_text(text)
        for city in CITY_DELIVERY_DAYS:
            if city in normalized:
                return city.title()
        return ""

    def extract_order_number(self, text: str) -> str:
        normalized = normalize_text(text)
        for piece in normalized.replace("#", " ").replace(",", " ").split():
            if piece.startswith("jr-") and len(piece) >= 5:
                return piece.upper()
        return ""

    def find_product_name_in_text(self, text: str) -> str:
        normalized = normalize_text(text)
        for product_name in PRODUCT_NEEDS:
            if product_name in normalized:
                return product_name
        return ""

    def find_product(self, product_name: str) -> ChatbotProduct | None:
        normalized_name = normalize_text(product_name)
        if not normalized_name:
            return None

        products = list(self.product_queryset().filter(name__icontains=product_name)[:5])
        if not products:
            products = [
                product
                for product in self.product_queryset()[:50]
                if normalized_name in normalize_text(product.name)
            ]
        if not products:
            return None
        return self.to_chatbot_product(products[0])

    def find_products_for_need(self, need: str) -> list[ChatbotProduct]:
        if not need:
            featured = list(self.product_queryset().filter(is_featured=True)[:2])
            if not featured:
                featured = list(self.product_queryset()[:2])
            return [self.to_chatbot_product(product) for product in featured]

        product_names = [
            name for name, needs in PRODUCT_NEEDS.items()
            if need in needs
        ]
        query = Q()
        for name in product_names:
            query |= Q(name__icontains=name)

        products = list(self.product_queryset().filter(query)[:3]) if query else []
        if not products:
            products = list(
                self.product_queryset()
                .filter(Q(name__icontains=need) | Q(description__icontains=need))[:3]
            )
        return [self.to_chatbot_product(product) for product in products]

    def product_queryset(self):
        active_prices = Price.objects.filter(
            is_active=True,
        ).filter(Q(valid_until__isnull=True) | Q(valid_until__gte=timezone.now()))
        active_variants = ProductVariant.objects.filter(is_active=True).prefetch_related(
            Prefetch("prices", queryset=active_prices),
            Prefetch("stocks", queryset=Stock.objects.all(), to_attr="_chatbot_stocks"),
        )
        return (
            Product.objects.filter(is_active=True, category__is_active=True)
            .select_related("category")
            .prefetch_related(Prefetch("variants", queryset=active_variants))
            .order_by("-is_featured", "name")
        )

    def to_chatbot_product(self, product: Product) -> ChatbotProduct:
        prices = [
            price.amount
            for variant in product.variants.all()
            for price in variant.prices.all()
            if price.is_active
        ]
        quantities = [
            stock.available_quantity
            for variant in product.variants.all()
            for stock in getattr(variant, "_chatbot_stocks", [])
        ]
        return ChatbotProduct(
            id=str(product.id),
            name=product.name,
            description=product.description,
            catalog_path=f"{self.catalog_path}?producto={product.slug}",
            price_from=min(prices) if prices else None,
            available_quantity=sum(quantities) if quantities else None,
        )
