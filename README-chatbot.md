# Chatbot Ecommerce Dialogflow ES - Juhnios Rold

Solucion automatizada para crear, empaquetar, desplegar y conectar un chatbot ecommerce para Productos Juhnios Rold S.A.S. sin crear intents manualmente desde la consola.

## Que incluye

- Agente Dialogflow ES importable en `dialogflow-agent/`.
- Intents y entities en JSON.
- Script para generar ZIP importable.
- Script para restaurar/importar el agente por API.
- Webhook TypeScript en `server/`.
- Endpoint frontend que llama a Dialogflow `detectIntent`.
- Componente React propio en `frontend/src/app/components/ChatbotLauncher.tsx`.
- Reglas para no inventar precios, stock ni promociones.

## Instalar dependencias del agente

```bash
cd dialogflow-agent
npm install
```

## Generar ZIP del agente

```bash
cd dialogflow-agent
npm run build
```

Salida:

```text
dialogflow-agent/dist/juhnios-rold-dialogflow-agent.zip
```

## Variables de entorno

Para desplegar el agente y usar Dialogflow desde el servidor:

```bash
GOOGLE_CLOUD_PROJECT_ID=tu-proyecto-google
GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\service-account.json
DIALOGFLOW_LANGUAGE_CODE=es
```

Para webhook, frontend y WhatsApp:

```bash
CHATBOT_PORT=8787
WHATSAPP_NUMBER=573001112233
VITE_WHATSAPP_NUMBER=573001112233
VITE_CHATBOT_API_URL=http://localhost:8787/api/chatbot/message
CATALOG_URL=/catalogo
DIALOGFLOW_WEBHOOK_URL=https://tu-dominio.com/dialogflow/webhook
```

El numero de WhatsApp puede venir de `WHATSAPP_NUMBER` o `VITE_WHATSAPP_NUMBER`.

## Desplegar el agente por API

Primero genera el ZIP. Luego:

```bash
cd dialogflow-agent
npm run deploy
```

El script valida:

- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `DIALOGFLOW_LANGUAGE_CODE`, por defecto `es`

Si falta una variable, muestra un error claro y no continua.

## Instalar y correr el servidor chatbot

```bash
cd server
npm install
npm run dev
```

Endpoints:

- `GET /health`
- `POST /dialogflow/webhook`
- `POST /api/chatbot/message`
- `POST /api/chatbot/local-message`

`/api/chatbot/message` llama a Dialogflow ES `detectIntent`.

`/dialogflow/webhook` es el fulfillment que Dialogflow debe llamar cuando los intents tienen webhook habilitado.

`/api/chatbot/local-message` sirve para probar reglas locales sin Dialogflow.

## Conectar el frontend

Importa el launcher en tu `App.tsx`:

```tsx
import { ChatbotLauncher } from './components/ChatbotLauncher';
```

Y renderizalo una vez cerca del final del layout:

```tsx
<ChatbotLauncher />
```

En desarrollo, si el chatbot corre en puerto `8787`, configura:

```bash
VITE_CHATBOT_API_URL=http://localhost:8787/api/chatbot/message
```

Si prefieres usar proxy de Vite, agrega `/api/chatbot` al proxy del frontend apuntando al servidor chatbot.

## Probar intents

Prueba estos mensajes desde Dialogflow, Postman o el componente React:

- `hola`
- `quiero comprar Full Liso`
- `que me recomiendas para el frizz`
- `tengo el cabello seco`
- `cuanto demora el envio a Bogota`
- `quiero comprar por mayor`
- `que formas de pago tienen`
- `quiero saber el estado de mi pedido`
- `tienen promociones`
- `quiero ver el catalogo`
- `quiero hablar con un asesor`
- `necesito una garantia medica`

El ultimo debe ir a fallback/asesor porque el bot no promete resultados medicos ni inventa informacion.

## Reglas comerciales implementadas

- No inventa precios.
- No inventa stock.
- No inventa promociones.
- Si falta informacion exacta, pasa a WhatsApp.
- Responde en espanol colombiano, corto y comercial.
- No promete resultados medicos.
- Recomienda productos por necesidad capilar.
- Lleva siempre a catalogo, compra o asesor.

## Archivos principales

- `dialogflow-agent/agent.json`
- `dialogflow-agent/intents/`
- `dialogflow-agent/entities/`
- `scripts/build-dialogflow-agent.ts`
- `scripts/deploy-dialogflow-agent.ts`
- `server/dialogflowWebhook.ts`
- `server/dialogflowClient.ts`
- `server/products.ts`
- `server/recommendationRules.ts`
- `server/faqs.ts`
- `server/whatsapp.ts`
- `frontend/src/app/components/ChatbotLauncher.tsx`
