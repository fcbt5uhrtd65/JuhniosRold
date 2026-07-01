# Despliegue en produccion

Este proyecto queda preparado para producción con Docker Compose y Nginx en contenedor.

## Arquitectura

- `nginx`: publica el puerto `80`, sirve el build estático del frontend y proxya `/api/`, `/admin/`, `/health/`, `/static/` y `/media/`.
- `backend`: Django con Gunicorn y `config.settings.production`.
- `db`: PostgreSQL interno, sin puerto público.
- `redis`: broker/result backend interno para Celery.
- `celery` y `celery-beat`: tareas asíncronas y tareas programadas.

## Primer despliegue

1. Crear el archivo real de variables:

```bash
cp .env.production.example .env.production
```

2. Editar `.env.production` y cambiar, como mínimo:

```env
POSTGRES_PASSWORD=
DJANGO_SECRET_KEY=
DJANGO_ALLOWED_HOSTS=juhniosrold.cloud,www.juhniosrold.cloud
BACKEND_URL=https://juhniosrold.cloud
FRONTEND_URL=https://juhniosrold.cloud
CORS_ALLOWED_ORIGINS=https://juhniosrold.cloud,https://www.juhniosrold.cloud
CSRF_TRUSTED_ORIGINS=https://juhniosrold.cloud,https://www.juhniosrold.cloud
```

3. Construir y levantar:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

4. Verificar estado:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend nginx
```

5. Probar salud:

```bash
curl http://localhost/health/
```

## Actualizaciones

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend nginx
```

El contenedor `backend` ejecuta `migrate` y `collectstatic` al arrancar.

## Crear usuario administrador

Si necesitas crear un superusuario:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Si quieres usar tus seeders manualmente:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python manage.py seed_admin_users
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python manage.py seed_catalog
```

## HTTPS con Certbot

Antes de pedir el certificado, el DNS de `juhniosrold.cloud` debe apuntar al servidor. Si también vas a usar `www.juhniosrold.cloud`, crea su registro `A` o `CNAME`.

También abre los puertos `80` y `443` en el firewall del servidor/proveedor.

1. Levantar primero en HTTP para que Let's Encrypt pueda validar el dominio:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build nginx
```

2. Pedir el certificado con Certbot en contenedor:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email admin@juhniosrold.cloud \
  --agree-tos \
  --no-eff-email \
  -d juhniosrold.cloud \
  -d www.juhniosrold.cloud
```

Si no vas a usar `www`, elimina la última línea `-d www.juhniosrold.cloud`.

3. Activar Nginx con TLS:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.tls.yml up -d --build
```

4. Probar:

```bash
curl -I https://juhniosrold.cloud/health/
```

5. Renovar certificados:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile certbot run --rm certbot renew --webroot --webroot-path /var/www/certbot
docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.tls.yml exec nginx nginx -s reload
```

Para automatizar renovación, agrega un cron en el servidor:

```cron
0 3 * * * cd /ruta/al/proyecto && docker compose --env-file .env.production -f docker-compose.prod.yml --profile certbot run --rm certbot renew --webroot --webroot-path /var/www/certbot && docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.tls.yml exec nginx nginx -s reload
```

## Backups

Crear backup de PostgreSQL:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

Restaurar requiere detener servicios que escriben en la base y cargar el dump con `psql`.
