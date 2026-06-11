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

En el dashboard de Wompi configurar una URL distinta por ambiente:

```text
https://api.tudominio.com/api/pagos/wompi/webhook/
```

Sandbox debe usar prefijos `pub_test_`, `prv_test_`, `test_events_` y
`test_integrity_`. Producción debe usar `pub_prod_`, `prv_prod_`,
`prod_events_` y `prod_integrity_`.

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
