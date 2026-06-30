# Dialogflow ES Agent - Productos Juhnios Rold

Este directorio contiene el agente importable de Dialogflow ES para el ecommerce de Productos Juhnios Rold S.A.S.

## Estructura

- `agent.json`: configuracion general del agente.
- `intents/`: intents y frases de entrenamiento en espanol.
- `entities/`: entidades y sinonimos.
- `package.json`: scripts para construir y desplegar el ZIP.

## Generar ZIP

```bash
cd dialogflow-agent
npm install
npm run build
```

El ZIP se genera en `dialogflow-agent/dist/juhnios-rold-dialogflow-agent.zip`.

## Desplegar por API

Configura:

```bash
set GOOGLE_CLOUD_PROJECT_ID=tu-proyecto
set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\service-account.json
set DIALOGFLOW_LANGUAGE_CODE=es
```

Luego:

```bash
npm run deploy
```
