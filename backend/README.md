# Juhnios Rold ERP Backend

Monolito modular construido con Django, Django REST Framework y una variante
ligera de Clean Architecture.

## Módulos

- `identity`: usuarios, JWT, roles, permisos y recuperación de contraseña.
- `customers`: clientes, contactos, segmentos e historial de compras.
- `catalog`: productos, categorías, variantes, precios e imágenes.
- `inventory`: almacenes, ubicaciones, stock y movimientos.
- `commerce`: carritos, checkout, pedidos y seguimiento.
- `employees`: empleados, cargos, departamentos y contratos.
- `human_resources`: asistencia, vacaciones, nómina, evaluaciones y documentos.
- `finance`: ingresos, egresos y movimientos financieros.
- `analytics`: dashboard, consultas agregadas y exportaciones.
- `audit`: bitácora transversal de operaciones críticas.

## Capas

Cada módulo de negocio separa:

- `domain`: entidades, value objects, contratos y reglas sin Django o DRF.
- `application`: DTOs, casos de uso y coordinación transaccional.
- `infrastructure`: ORM, serializers, tareas y adaptadores.
- `interfaces`: views, permisos, filtros y rutas HTTP.

Los archivos `models.py` de cada app son puentes para el descubrimiento de
modelos de Django; los modelos reales viven en `infrastructure/models.py`.

## Desarrollo

```bash
docker compose up --build
```

Servicios:

- API: `http://localhost:8001`
- Swagger: `http://localhost:8001/api/docs/`
- Frontend: `http://localhost:5174`
- PostgreSQL: `localhost:5432`

Crear o actualizar las dos cuentas administrativas iniciales:

```bash
docker compose exec backend python manage.py seed_admin_users
```

Las cuentas se crean en `identity.User`, porque `identity` es el dueño de las
credenciales, roles y permisos. Cada cuenta queda además vinculada a un perfil
de `employees.Employee`; no se crean como clientes.

- `admin@juhnios.com`
- `administrador2@juhnios.com`

La contraseña inicial se toma de `ADMIN_SEED_PASSWORD`. El comando no vuelve a
cambiar contraseñas existentes salvo que se ejecute con `--reset-passwords`.

## Producción

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

El override de producción ejecuta migraciones, recopila estáticos, inicia
Gunicorn y publica el sistema mediante Nginx.
