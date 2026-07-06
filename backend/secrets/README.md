# Secretos locales del backend

Coloca aqui archivos sensibles que no deben subirse a git.

Para Dialogflow, guarda la clave JSON de la cuenta de servicio con este nombre:

```text
dialogflow-service-account.json
```

La ruta dentro del contenedor queda:

```text
/app/secrets/dialogflow-service-account.json
```

Y la variable correspondiente es:

```env
GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/dialogflow-service-account.json
```

No pegues el contenido del JSON en archivos `.env` ni en commits.
