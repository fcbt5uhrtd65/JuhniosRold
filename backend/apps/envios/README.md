# Módulo de envíos y seguimiento

## Límites del dominio

`commerce` sigue siendo dueño del pedido, sus líneas, pagos, inventario reservado y
`OrderStatusHistory`. `envios` es dueño de transportadoras, guías, datos del despacho,
eventos de tracking y comunicación con operadores logísticos.

La integración entre ambos dominios ocurre mediante `EnvioStateService`. Un cambio
logístico relevante actualiza el pedido usando `OrderStatusService`, que siempre crea
historial y auditoría:

| Envío | Pedido |
| --- | --- |
| `GUIA_GENERADA`, `RECOGIDO` | `SHIPPED` |
| `EN_TRANSITO`, `EN_REPARTO` | `IN_TRANSIT` |
| `ENTREGADO` | `DELIVERED` |
| `DEVUELTO` | `RETURNED` |

## Estructura

```text
apps/envios/
├── domain/
│   ├── entities.py
│   ├── value_objects.py
│   ├── repositories.py
│   └── exceptions.py
├── application/
│   ├── use_cases/
│   │   ├── crear_envio.py
│   │   ├── registrar_guia_manual.py
│   │   ├── generar_guia.py
│   │   ├── actualizar_estado_envio.py
│   │   ├── consultar_tracking.py
│   │   ├── actualizar_tracking.py
│   │   └── cancelar_envio.py
│   ├── dtos.py
│   └── services.py
├── infrastructure/
│   ├── models.py
│   ├── repositories.py
│   ├── serializers.py
│   ├── shipping_gateways.py
│   ├── mock_shipping_gateway.py
│   ├── envia_gateway.py
│   ├── coordinadora_gateway.py
│   └── tasks.py
├── interfaces/
│   ├── views.py
│   ├── urls.py
│   ├── permissions.py
│   └── webhooks.py
├── migrations/
├── tests/
└── admin.py
```

## Flujo manual inicial

1. El pago cambia el pedido a `PAID`.
2. Administración crea `POST /api/v1/envios/` con `pedido_id`.
3. Administración registra guía en
   `POST /api/v1/envios/{id}/registrar-guia-manual/`.
4. El envío cambia a `GUIA_GENERADA` y el pedido a `SHIPPED`.
5. Los cambios se realizan con `PUT /api/v1/envios/{id}/estado/`.
6. El cliente consulta `GET /api/v1/pedidos/{pedido_id}/tracking/`.

También existen aliases sin versión bajo `/api/envios/` y
`/api/pedidos/{pedido_id}/tracking/`.

## Preparación para proveedores externos

`ShippingGateway` define cotización, generación de guía, etiqueta, recogida, tracking,
cancelación y validación de webhooks. `MockShippingGateway` implementa el contrato para
desarrollo. `EnviaGateway` y `CoordinadoraGateway` son adaptadores explícitos que fallan
con un error de configuración hasta implementar el contrato confirmado por cada
proveedor.

Los webhooks usan `external_event_id` único para idempotencia. En producción debe
configurarse `SHIPPING_WEBHOOK_SECRET` y cada adaptador debe validar la firma oficial de
su proveedor antes de procesar el payload.

## Permisos

- Superusuario: acceso completo.
- `is_staff`, `MANAGER` o `GERENTE`: crear, actualizar y cancelar.
- `SELLER` o `VENDEDOR`: consultar y registrar guía manual.
- Cliente: solo lectura de envíos asociados a su propio perfil.

## Celery

- `update_external_tracking`: consulta periódicamente envíos no manuales.
- `send_shipping_status_notification`: notifica al correo del cliente.
- `alert_shipping_incident`: alerta al personal cuando el estado es `NOVEDAD`.

El intervalo se controla con `SHIPPING_TRACKING_UPDATE_INTERVAL_MINUTES`.

## Seguridad operativa

- Mantener HTTPS en frontend, backend y callbacks.
- No exponer `raw_response` ni `raw_payload` en serializers públicos.
- Guardar secretos solo en variables de entorno.
- Validar firma, timestamp e idempotencia de cada webhook real.
- Conservar permisos por objeto para impedir seguimiento de pedidos ajenos.
- Implementar reintentos con backoff y límites de tiempo al conectar APIs reales.
