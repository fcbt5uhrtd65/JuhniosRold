# Juhnios Rold — Guía de Integración Frontend ↔ Backend

## Arquitectura

```
Frontend (React + Vite)          Backend (Node.js + Express)
┌─────────────────────────┐      ┌──────────────────────────┐
│  /src/app/              │      │  /backend/src/            │
│  ├── services/          │─────▶│  ├── modules/             │
│  │   ├── api.ts         │      │  │   ├── auth/            │
│  │   ├── auth.service   │      │  │   ├── users/           │
│  │   ├── products.service│     │  │   ├── products/        │
│  │   ├── orders.service │      │  │   ├── orders/          │
│  │   └── pro.service    │      │  │   └── pro/             │
│  ├── contexts/          │      │  ├── shared/middleware/   │
│  │   ├── UserContext    │      │  └── config/              │
│  │   └── AdminContext   │      └──────────────────────────┘
│  └── hooks/             │              │
│      └── useApiRequest  │         PostgreSQL
└─────────────────────────┘
```

## Modo de funcionamiento

### Sin backend (Demo)
El frontend funciona completamente en modo demo usando **localStorage** como base de datos temporal. Todas las funcionalidades están disponibles: login, registro, carrito, pedidos, panel admin.

### Con backend (Producción)
Cuando el backend está corriendo en `localhost:4000`, el frontend lo detecta automáticamente y usa la API real con JWT para autenticación.

---

## Puesta en marcha del Backend

### 1. Instalar dependencias
```bash
cd backend
npm install
```

### 2. Configurar entorno
```bash
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL y JWT secrets
```

### 3. Crear base de datos PostgreSQL
```bash
createdb juhnios_rold
# O desde psql:
psql -U postgres -c "CREATE DATABASE juhnios_rold;"
```

### 4. Ejecutar migraciones
```bash
npm run migrate
# Equivale a: psql $DATABASE_URL -f src/database/migrations/001_initial_schema.sql
```

### 5. Sembrar datos iniciales
```bash
npm run seed
# Crea: 3 usuarios admin + 6 productos + 1 cliente de prueba
```

### 6. Iniciar servidor de desarrollo
```bash
npm run dev
# El servidor queda en http://localhost:4000
```

---

## Endpoints del API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/auth/register` | — | Registro de usuario |
| `POST` | `/api/auth/login` | — | Login → JWT tokens |
| `POST` | `/api/auth/refresh` | — | Renovar access token |
| `GET` | `/api/auth/me` | ✅ JWT | Usuario actual |
| `POST` | `/api/auth/logout` | ✅ JWT | Cerrar sesión |
| `GET` | `/api/products` | Opcional | Listar productos |
| `GET` | `/api/products/featured` | — | Productos destacados |
| `POST` | `/api/products` | ✅ Admin | Crear producto |
| `PATCH` | `/api/products/:id` | ✅ Admin | Actualizar producto |
| `DELETE` | `/api/products/:id` | ✅ Admin | Eliminar producto |
| `GET` | `/api/orders` | ✅ JWT | Mis pedidos / Todos (admin) |
| `POST` | `/api/orders` | ✅ JWT | Crear pedido |
| `PATCH` | `/api/orders/:id/status` | ✅ Admin | Actualizar estado |
| `GET` | `/api/pro/me` | ✅ JWT | Mi perfil PRO |
| `POST` | `/api/pro/request` | ✅ JWT | Solicitar acceso PRO |
| `POST` | `/api/pro/:id/approve` | ✅ Admin | Aprobar solicitud PRO |
| `GET` | `/api/users` | ✅ Admin | Listar usuarios |

---

## Credenciales de prueba

### Demo (sin backend)
| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@juhnios.com | cualquiera |
| Vendedor | vendedor@juhnios.com | cualquiera |
| Distribuidor | distribuidor@juhnios.com | cualquiera |
| Cliente | (registra uno nuevo) | — |

### Con backend real
| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@juhnios.com | Admin123! |
| Vendedor | vendedor@juhnios.com | Admin123! |
| Distribuidor | distribuidor@juhnios.com | Admin123! |
| Cliente | cliente@test.com | Admin123! |

> ⚠️ Cambia las contraseñas en producción ejecutando el seed con hashes bcrypt correctos.

---

## Arquitectura de servicios del frontend

### `/src/app/services/api.ts`
- Cliente HTTP base con manejo automático de JWT
- Retry con refresh token en 401
- Detección de disponibilidad del backend (`isBackendAvailable()`)
- Timeout de 15s por request

### `/src/app/services/*.service.ts`
- `auth.service.ts` — register, login, getCurrentUser, logout
- `products.service.ts` — CRUD completo de productos
- `orders.service.ts` — crear pedido, listar, actualizar estado
- `pro.service.ts` — solicitar/aprobar/rechazar acceso PRO
- `users.service.ts` — perfil, productos guardados, gestión de usuarios

### `/src/app/hooks/useApiRequest.ts`
- `useApiQuery(fn)` — fetch automático en mount con loading/error/data
- `useApiMutation(fn)` — mutations con loading/error/data

---

## Variables de entorno del frontend

```bash
# .env (en la raíz del proyecto)
VITE_API_URL=http://localhost:4000/api
```

En producción, apunta a tu backend deployado:
```bash
VITE_API_URL=https://api.juhniosrold.com/api
```
