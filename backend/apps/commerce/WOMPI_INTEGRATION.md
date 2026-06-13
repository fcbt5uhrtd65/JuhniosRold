# Pagos mock y Wompi Colombia

El proveedor se selecciona con:

```env
PAYMENT_PROVIDER=mock
```

Usar `mock` durante desarrollo mientras no estén disponibles las credenciales
del comercio. Para conectar Wompi, cambiar el valor a `wompi` y completar las
llaves del ambiente correspondiente.

## Flujo simulado

1. El cliente autenticado agrega variantes con
   `POST /api/v1/commerce/cart/items/`.
2. El carrito activo y sus líneas quedan guardados en PostgreSQL. Al volver a
   iniciar sesión, `GET /api/v1/commerce/cart/` devuelve el mismo carrito.
3. `POST /api/v1/commerce/cart/checkout/` crea el pedido usando cantidades y
   precios vigentes de la base de datos, reserva inventario y cierra el carrito.
4. `POST /api/v1/commerce/payments/start/` crea el pago mock.
5. Para aprobar o rechazar:

```text
POST /api/v1/commerce/payments/mock/{payment_id}/resolve/
{"outcome": "approved"}

POST /api/v1/commerce/payments/mock/{payment_id}/resolve/
{"outcome": "declined"}
```

Un pago aprobado consume la reserva de inventario y genera una factura de venta
interna. Un pago rechazado libera la reserva y permite iniciar un nuevo intento
desde el mismo pedido. Esta factura interna no reemplaza la facturación
electrónica ni la integración fiscal con la DIAN.

La pantalla "Mis pedidos" permite retomar un pedido pendiente o fallido con
"Pagar ahora".

La integración usa el Web Checkout de Wompi. El navegador nunca envía al
backend números de tarjeta, CVV ni fechas de vencimiento.

## Flujo Wompi

1. React crea el pedido con `POST /api/v1/commerce/cart/checkout/`.
2. Django calcula precios desde la base de datos y reserva inventario con
   bloqueo de filas. La cantidad física todavía no se descuenta.
3. React inicia el pago con `POST /api/v1/commerce/payments/start/`.
   También se mantienen las rutas específicas de Wompi para compatibilidad.
4. Django crea una referencia única, calcula la firma SHA-256 en el servidor y
   devuelve la URL de `https://checkout.wompi.co/p/`.
5. React redirige al cliente al checkout hospedado por Wompi.
6. Wompi envía `transaction.updated` a
   `POST /api/pagos/wompi/webhook/`.
7. Django valida dinámicamente `signature.properties`, `timestamp`, el secreto
   de eventos y el ambiente. También compara referencia, monto y moneda con el
   pago local.
8. `APPROVED` cambia el pago a aprobado, el pedido a `PAID` y convierte la
   reserva en una salida de inventario dentro de la misma transacción.
9. `DECLINED`, `ERROR`, `VOIDED` o `EXPIRED` cambian el pedido a `FAILED` y
   liberan la reserva. `EXPIRED` también se usa localmente para checkouts
   abandonados.
10. Tras confirmar la transacción de base de datos, Celery envía el correo al
    cliente.

La redirección del navegador es informativa. Solo el webhook firmado confirma
el pago.

## Modelos

- `Order`: pedido, ubicación de despacho y marcas de reserva/consumo.
- `OrderItem`: precio y cantidad congelados al crear el pedido.
- `Payment`: referencia, monto, moneda, estado, método e ID de Wompi.
- `OrderStatusHistory`: historial de transiciones.
- `PaymentWebhookEvent`: auditoría sanitizada e idempotencia por checksum.
- `Stock.reserved_quantity`: evita sobreventa entre checkout y webhook.
- `SalesInvoice` y `SalesInvoiceLine`: comprobante interno generado al aprobar.

No se persiste el cuerpo completo del medio de pago.

## Estados

Pedidos:

`PENDING`, `PAYMENT_PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`,
`CANCELLED`, `FAILED`.

Pagos:

`PENDING`, `APPROVED`, `DECLINED`, `ERROR`, `VOIDED`, `EXPIRED`.

Wompi usa oficialmente `DECLINED` y `VOIDED`; estos corresponden a rechazado y
anulado.

## Configuración

Copiar los valores de `.env.example` a un archivo `.env` no versionado. Nunca
exponer `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET` ni
`WOMPI_INTEGRITY_SECRET` al frontend.

Validar la configuración efectiva dentro del contenedor:

```bash
docker compose exec backend python manage.py check_wompi_config
```

El comando falla si el proveedor no es Wompi, falta una credencial, los
prefijos no corresponden al ambiente o la URL base no es la API oficial. La
salida siempre enmascara las credenciales.

En el dashboard de Wompi configurar una URL distinta por ambiente:

```text
https://api.tudominio.com/api/pagos/wompi/webhook/
```

Sandbox debe usar prefijos `pub_test_`, `prv_test_`, `test_events_` y
`test_integrity_`. Producción debe usar `pub_prod_`, `prv_prod_`,
`prod_events_` y `prod_integrity_`.

Las URL base son APIs, no links de pago:

```env
WOMPI_SANDBOX_URL=https://sandbox.wompi.co/v1
WOMPI_PRODUCTION_URL=https://production.wompi.co/v1
```

## Prueba Sandbox

1. Levantar servicios con `docker compose up -d --build`.
2. Ejecutar `docker compose exec backend python manage.py check_wompi_config`.
3. Consultar `http://localhost:8001/health/` y
   `http://localhost:8001/api/docs/`.
4. Autenticarse, agregar productos al carrito y crear el pedido con
   `POST /api/pedidos/` o `POST /api/v1/commerce/cart/checkout/`.
5. Iniciar Wompi con `POST /api/pagos/wompi/iniciar/`:

```json
{
  "pedido_id": "UUID_DEL_PEDIDO"
}
```

6. Abrir el `checkout_url` devuelto por el backend.
7. Para aprobar con tarjeta usar `4242 4242 4242 4242`; para rechazar usar
   `4111 1111 1111 1111`. Usar una fecha futura y cualquier CVC de tres
   dígitos.
8. Consultar `GET /api/pagos/wompi/estado/{pedido_id}/` hasta recibir un estado
   final.
9. Verificar el detalle con `GET /api/pedidos/{pedido_id}/` y el seguimiento
   con `GET /api/pedidos/{pedido_id}/tracking/`.

Wompi bloquea con HTTP 403 las URLs del Web Checkout que incluyen una
`redirect-url` local como `http://localhost:5174`. En desarrollo el backend
omite ese parámetro. Para regresar automáticamente a la pantalla de resultado,
configurar `FRONTEND_URL` con una URL pública HTTPS del frontend y recrear el
contenedor.

Respuesta esperada al iniciar:

```json
{
  "provider": "wompi",
  "payment_id": "",
  "requires_redirect": true,
  "checkout_url": "https://checkout.wompi.co/p/?...",
  "reference": "PED-...-...",
  "amount_in_cents": 9000000,
  "currency": "COP",
  "public_key": "pub_test_...",
  "integrity_signature": "...",
  "redirect_url": "http://localhost:5174/pago/resultado?pedido_id=..."
}
```

## Webhook local

Publicar el puerto HTTP con uno de estos túneles:

```bash
ngrok http 8001
cloudflared tunnel --url http://localhost:8001
```

Configurar en el Dashboard Sandbox de Wompi:

```text
https://SUBDOMINIO_PUBLICO/api/pagos/wompi/webhook/
```

No usar `localhost`. La URL debe ser pública y HTTPS. Revisar la recepción y la
persistencia del evento con:

```bash
docker compose logs -f backend
docker compose exec backend python manage.py shell -c "from apps.commerce.infrastructure.models import PaymentWebhookEvent; print(list(PaymentWebhookEvent.objects.order_by('-created_at').values('event_type','reference','transaction_status','processed','processing_error')[:10]))"
```

Repetir exactamente un webhook firmado debe responder `duplicate: true` y no
crear una segunda salida de inventario. Alterar el checksum debe producir un
error de firma y no modificar pago, pedido ni stock.

Payload de referencia para Postman, sustituyendo los valores y calculando el
checksum con el secreto de eventos:

```json
{
  "event": "transaction.updated",
  "data": {
    "transaction": {
      "id": "sandbox-transaction-id",
      "status": "APPROVED",
      "amount_in_cents": 9000000,
      "reference": "REFERENCIA_LOCAL",
      "currency": "COP",
      "payment_method_type": "CARD"
    }
  },
  "environment": "test",
  "signature": {
    "properties": [
      "transaction.id",
      "transaction.status",
      "transaction.amount_in_cents"
    ],
    "checksum": "SHA256_CALCULADO"
  },
  "timestamp": 1530291411
}
```

El checksum es SHA-256 de los valores indicados por `properties`, en ese orden,
seguidos por `timestamp` y `WOMPI_EVENTS_SECRET`. No usar un arreglo fijo de
propiedades.

Matriz mínima de pruebas:

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| Pedido inexistente | Iniciar con UUID desconocido | HTTP 404 |
| Pedido pagado | Volver a iniciar el pago | HTTP 400, sin pago nuevo |
| Stock insuficiente | Comprar más que `available_quantity` | HTTP 400, sin reserva parcial |
| Firma inválida | Cambiar checksum | HTTP 400, sin cambios de negocio |
| Webhook duplicado | Reenviar el mismo evento | HTTP 200 y `duplicate=true` |
| Monto alterado | Cambiar `amount_in_cents` con firma válida | Evento rechazado |
| Wompi no disponible | Usar temporalmente una URL inválida en un entorno aislado | Error controlado, sin confirmar pago |

## Verificaciones de base de datos

```bash
docker compose exec backend python manage.py shell -c "from apps.commerce.infrastructure.models import Order; o=Order.objects.get(pk='UUID_DEL_PEDIDO'); print(o.status, list(o.payments.values('status','reference','provider_transaction_id')))"
docker compose exec backend python manage.py shell -c "from apps.inventory.infrastructure.models import Stock; print(list(Stock.objects.values('variant__sku','quantity','reserved_quantity')))"
```

En aprobación: pago `APPROVED`, pedido `PAID`, `reserved_quantity=0` y
`quantity` reducida una sola vez. En rechazo o error: pedido `FAILED`, reserva
liberada y cantidad física sin cambios.

## Diagnóstico

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose exec backend python manage.py check_wompi_config
docker compose exec backend python manage.py test tests.test_wompi_payments
```

No imprimir las variables completas en capturas, tickets o canales
compartidos. Preferir `check_wompi_config`, que las enmascara.

## React

La implementación está en:

- `src/app/services/payments.service.ts`
- `src/app/components/Checkout.tsx`
- `src/app/components/PaymentResult.tsx`

La pantalla de resultado consulta
`GET /api/v1/commerce/payments/status/{pedido_id}/`; no confía en el ID
que Wompi agrega a la URL de redirección.

## Docker y producción

`docker-compose.yml` incluye PostgreSQL, backend, frontend, Redis, Celery,
Celery Beat y Nginx. Beat libera reservas de pagos pendientes vencidos cada
cinco minutos.

Antes de producción:

- Ejecutar migraciones.
- Servir Nginx exclusivamente por HTTPS o terminar TLS en un balanceador.
- Configurar `SECURE_HSTS_SECONDS` y rotar secretos fuera del repositorio.
- Restringir acceso al dashboard y revisar eventos con `processing_error`.
- Monitorear tareas de Celery, reintentos y pagos aprobados sin despacho.
- Mantener URLs y credenciales de sandbox completamente separadas de
  producción.

Documentación oficial:

- https://docs.wompi.co/docs/colombia/widget-checkout-web/
- https://docs.wompi.co/docs/colombia/eventos/
- https://docs.wompi.co/docs/colombia/ambientes-y-llaves/
