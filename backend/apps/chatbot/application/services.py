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

    @property
    def pending_intent(self) -> str | None:
        """Intent que quedo esperando un dato puntual del cliente (ej. la
        ciudad para una consulta de envio), usado para recordar el contexto
        de la conversacion entre mensajes. No se expone en la API publica."""
        return self.payload.get("_pending_intent")

    def as_api_payload(self) -> dict:
        public_payload = {key: value for key, value in self.payload.items() if not key.startswith("_")}
        return {
            "fulfillmentText": self.fulfillment_text,
            "intent": self.intent,
            "payload": public_payload,
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

GREETING_MESSAGES = {
    "hola",
    "holis",
    "hello",
    "hi",
    "hey",
    "buenas",
    "buenos dias",
    "buenas tardes",
    "buenas noches",
    "como estas",
    "como estas?",
    "que onda",
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
    (
        "Buscar producto",
        (
            "precio", "cuanto cuesta", "cuánto cuesta", "cuanto vale", "cuánto vale",
            "vale", "cuesta", "tienen", "tienes", "hay", "necesito", "busco", "quiero",
            "dame", "muestrame", "muéstrame", "existe", "manejan", "venden",
        ),
    ),
)

# Palabras genéricas que no aportan nada como término de búsqueda de producto
# (verbos/pronombres frecuentes en frases como "necesito una crema para...").
SEARCH_STOPWORDS = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "para",
    "por", "con", "sin", "que", "y", "o", "a", "en", "mi", "me", "tu",
    "necesito", "busco", "quiero", "tienen", "tienes", "hay", "dame", "vale",
    "cuesta", "cuanto", "cuánto", "precio", "existe", "manejan", "venden",
    "muestrame", "muéstrame", "comprar", "compra", "algo", "producto", "productos",
}


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

    def respond_to_text(self, message: str, *, context: dict | None = None) -> ChatbotResponse:
        normalized = normalize_text(message)
        intent_name = self.detect_local_intent(normalized)
        parameters = self.extract_local_parameters(normalized)

        # Si el mensaje por si solo no dice nada claro (Fallback) pero en el
        # turno anterior quedamos esperando un dato puntual (ej. "dime tu
        # ciudad"), reusamos ese intent pendiente en vez de perder el hilo de
        # la conversacion — asi "envio" y luego "Barranquilla" se entienden
        # como una sola pregunta, aunque vengan en mensajes separados.
        pending_intent = (context or {}).get("pending_intent")
        if intent_name == "Fallback" and pending_intent:
            intent_name = pending_intent

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
            "Saludo": self.greeting,
            "Default Welcome Intent": self.greeting,
            "Catalogo": self.catalog,
            "Promociones": self.promotions,
            "Hablar con asesor": self.human_handoff,
            "Buscar producto": self.search_product,
            "Fallback": self.fallback,
        }
        handler = handlers.get(intent_name, self.fallback)
        return handler(parameters, query_text=query_text)

    def detect_local_intent(self, normalized_message: str) -> str:
        if self.is_greeting(normalized_message):
            return "Saludo"
        for intent_name, keywords in INTENT_KEYWORDS:
            if any(keyword in normalized_message for keyword in keywords):
                return intent_name
        return "Fallback"

    def is_greeting(self, normalized_message: str) -> bool:
        cleaned = normalized_message.strip(" ?!¡¿.,;:")
        return cleaned in GREETING_MESSAGES

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
                "Con gusto te recomiendo algo. ¿Me cuentas que le pasa a tu cabello? Por ejemplo "
                "frizz, resequedad, falta de brillo, caida o si buscas alisar."
            )
        elif products:
            names = ", ".join(product.name for product in products)
            text = (
                f"Para {need} estas opciones te pueden ayudar bastante: {names}. "
                "Si quieres te cuento mas detalles o te paso con un asesor para elegir el ideal."
            )
        else:
            return self.with_advisor(
                "Uy, justo para esa necesidad no tengo una recomendacion exacta y prefiero no improvisar. "
                "Un asesor te puede orientar mejor.",
                "Recomendar producto",
                need or query_text or "recomendacion personalizada",
            )

        payload = {
            "catalogUrl": self.catalog_path,
            "whatsappUrl": self.advisor_link(f"recomendacion para {need or 'mi cabello'}"),
            "products": [product.as_payload() for product in products],
        }
        if not need:
            payload["_pending_intent"] = "Recomendar producto"

        return ChatbotResponse(
            fulfillment_text=text,
            intent="Recomendar producto",
            payload=payload,
        )

    def buy_product(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        product_name = first_string(parameters, "producto") or self.find_product_name_in_text(query_text)
        product = self.find_product(product_name)

        if not product_name:
            return ChatbotResponse(
                fulfillment_text="Con gusto te ayudo a comprar. Dime que producto te interesa y te guio con precio y disponibilidad.",
                intent="Comprar producto",
                payload={
                    "catalogUrl": self.catalog_path,
                    "whatsappUrl": self.advisor_link("comprar un producto"),
                },
            )

        if product is None:
            return self.with_advisor(
                "Ese producto no lo tengo ubicado en este momento y prefiero no darte informacion incierta.",
                "Comprar producto",
                f"comprar {product_name}",
            )

        return ChatbotResponse(
            fulfillment_text=(
                f"Si, {product.name} esta en nuestro catalogo. Para que compres tranquilo, "
                "confirma precio y disponibilidad en la tienda o con un asesor antes de pagar."
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
                    f"Perfecto. Si estas en {city}, la entrega estimada es de {delivery}. "
                    "El valor final se confirma en el checkout."
                ),
                intent="Consulta de envio",
                payload={"catalogUrl": self.catalog_path},
            )

        if city:
            return self.with_advisor(
                f"Hacemos envios a toda Colombia. Para {city} prefiero que un asesor te confirme "
                "cobertura y tiempo exacto, para no darte un dato que no aplique.",
                "Consulta de envio",
                f"envio a {city}",
            )

        return ChatbotResponse(
            fulfillment_text=(
                "Hacemos envios a toda Colombia. En ciudades principales la entrega estimada suele ser "
                "de 2 a 5 dias habiles. ¿Me dices tu ciudad para orientarte mejor?"
            ),
            intent="Consulta de envio",
            payload={
                "whatsappUrl": self.advisor_link("consulta de envio"),
                "_pending_intent": "Consulta de envio",
            },
        )

    def wholesale(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        settings_obj = WholesaleSettings.current()
        text = (
            "Que bueno que quieras comprar al por mayor. Para compras mayoristas validamos cantidades, "
            "ciudad y productos con un asesor comercial. "
            f"La configuracion actual inicia desde ${settings_obj.minimum_purchase:,.0f} COP "
            f"con {settings_obj.discount_percentage.normalize()}% de descuento, sujeto a validacion."
        )
        return self.with_advisor(text, "Compra mayorista", "compra mayorista")

    def payment_methods(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return self.with_advisor(
            "Puedes pagar desde el checkout con los medios disponibles en la tienda. Para medios especiales "
            "o dudas puntuales, mejor lo validamos con un asesor y asi no te doy datos que puedan cambiar.",
            "Formas de pago",
            "formas de pago",
        )

    def order_status(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        order_number = first_string(parameters, "numero_pedido") or self.extract_order_number(query_text)

        if not order_number:
            return self.with_advisor(
                "Con gusto reviso tu pedido. ¿Me compartes el numero de orden o de guia? Si no lo tienes a la mano, "
                "un asesor te ayuda por WhatsApp.",
                "Estado de pedido",
                "estado de pedido",
                pending_intent="Estado de pedido",
            )

        order = (
            Order.objects.filter(number__iexact=order_number)
            .only("number", "status", "tracking_number")
            .first()
        )
        if order is None:
            return self.with_advisor(
                f"Busque el pedido {order_number} pero no encontre informacion publica suficiente sobre el.",
                "Estado de pedido",
                f"estado del pedido {order_number}",
            )

        tracking = f" Guia: {order.tracking_number}." if order.tracking_number else ""
        return ChatbotResponse(
            fulfillment_text=(
                f"Tu pedido {order.number} aparece como {order.get_status_display()}.{tracking} "
                "Si necesitas mas detalle con gusto te paso con un asesor."
            ),
            intent="Estado de pedido",
            payload={"whatsappUrl": self.advisor_link(f"estado del pedido {order.number}")},
        )

    def promotions(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return self.with_advisor(
            "Las promociones cambian segun disponibilidad y prefiero no inventarte un descuento que ya no exista. "
            "Revisa el catalogo o habla con un asesor para ver que hay vigente.",
            "Promociones",
            "promociones vigentes",
        )

    def greeting(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return ChatbotResponse(
            fulfillment_text=(
                "Hola, que gusto saludarte. Soy el asistente de Juhnios Rold y estoy para ayudarte. "
                "Puedo contarte sobre productos, recomendaciones, envios, pagos, catalogo o compras mayoristas. "
                "¿En que te ayudo hoy?"
            ),
            intent="Saludo",
            payload={
                "catalogUrl": self.catalog_path,
                "whatsappUrl": self.advisor_link("asesoria desde saludo"),
            },
        )

    def catalog(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return ChatbotResponse(
            fulfillment_text=(
                "Claro que si. Puedes ver el catalogo completo y elegir tus favoritos con calma. "
                "Si quieres, cuentame que necesita tu cabello y te doy una recomendacion."
            ),
            intent="Catalogo",
            payload={
                "catalogUrl": self.catalog_path,
                "whatsappUrl": self.advisor_link("catalogo de productos"),
            },
        )

    def human_handoff(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        return self.with_advisor(
            "Listo, con gusto te conecto con un asesor por WhatsApp para que te ayude de forma personalizada.",
            "Hablar con asesor",
            query_text or "asesoria personalizada",
        )

    def search_product(self, parameters: dict, *, query_text: str = "") -> ChatbotResponse:
        products = self.search_products_by_text(query_text)
        if not products:
            return self.fallback(parameters, query_text=query_text)

        return self.build_products_found_response(products, query_text, intent="Buscar producto")

    def fallback(self, parameters: dict | None = None, *, query_text: str = "") -> ChatbotResponse:
        # Antes de rendirse, intenta encontrar productos reales que coincidan
        # con el mensaje libre del cliente (ej. "necesito crema de peinar"),
        # asi no todo lo que no calza con una palabra clave fija termina en
        # "no tengo informacion" cuando el producto si existe en el catalogo.
        products = self.search_products_by_text(query_text)
        if products:
            return self.build_products_found_response(products, query_text, intent="Buscar producto")

        return self.with_advisor(
            "Uy, sobre eso no tengo esa informacion exacta y prefiero no inventarla para no confundirte.",
            "Fallback",
            query_text or "consulta no resuelta",
        )

    def build_products_found_response(
        self, products: list[ChatbotProduct], query_text: str, *, intent: str,
    ) -> ChatbotResponse:
        lines = []
        for product in products:
            price_label = f"${product.price_from:,.0f}" if product.price_from is not None else "precio a confirmar"
            if product.available_quantity is not None and product.available_quantity > 0:
                stock_label = "disponible"
            elif product.available_quantity is not None:
                stock_label = "agotado por ahora"
            else:
                stock_label = "disponibilidad a confirmar"
            lines.append(f"- {product.name}: {price_label} ({stock_label})")

        text = "Mira, esto encontre para ti en el catalogo:\n" + "\n".join(lines)
        return ChatbotResponse(
            fulfillment_text=text,
            intent=intent,
            payload={
                "catalogUrl": self.catalog_path,
                "whatsappUrl": self.advisor_link(query_text or "consulta de producto"),
                "products": [product.as_payload() for product in products],
            },
        )

    def with_advisor(
        self, text: str, intent: str, reason: str, *, pending_intent: str | None = None,
    ) -> ChatbotResponse:
        whatsapp_url = self.advisor_link(reason)
        payload = {"whatsappUrl": whatsapp_url}
        if pending_intent:
            payload["_pending_intent"] = pending_intent
        return ChatbotResponse(
            fulfillment_text=f"{text} Si prefieres, tambien puedes escribirnos por WhatsApp desde el boton de abajo.",
            intent=intent,
            payload=payload,
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

    def search_products_by_text(self, text: str, limit: int = 3) -> list[ChatbotProduct]:
        """Busca productos reales por texto libre (nombre, descripcion, categoria),
        sin depender de una lista fija de necesidades/keywords: primero prueba la
        frase completa, y si no hay match prueba palabra por palabra (ignorando
        conectores) para cubrir frases naturales como 'necesito crema de peinar'."""
        normalized = normalize_text(text)
        if not normalized:
            return []

        products_qs = self.product_queryset()

        exact_matches = list(
            products_qs.filter(
                Q(name__icontains=normalized)
                | Q(description__icontains=normalized)
                | Q(category__name__icontains=normalized)
            )[:limit]
        )
        if exact_matches:
            return [self.to_chatbot_product(product) for product in exact_matches]

        words = [
            word for word in normalized.split()
            if len(word) >= 4 and word not in SEARCH_STOPWORDS
        ]
        if not words:
            return []

        word_query = Q()
        for word in words:
            word_query |= Q(name__icontains=word) | Q(description__icontains=word) | Q(category__name__icontains=word)

        word_matches = list(products_qs.filter(word_query)[:limit])
        return [self.to_chatbot_product(product) for product in word_matches]

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
