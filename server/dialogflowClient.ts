import dialogflow from '@google-cloud/dialogflow';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { buildWebhookResponse } from './dialogflowWebhook';

interface ChatbotMessageRequest {
  message?: string;
  sessionId?: string;
}

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export async function detectIntentText(message: string, sessionId: string) {
  const projectId = requireEnv('GOOGLE_CLOUD_PROJECT_ID');
  const languageCode = process.env.DIALOGFLOW_LANGUAGE_CODE || 'es';
  const client = new dialogflow.SessionsClient();
  const sessionPath = client.projectAgentSessionPath(projectId, sessionId);

  const [response] = await client.detectIntent({
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
        languageCode,
      },
    },
  });

  const fulfillmentText = response.queryResult?.fulfillmentText || '';
  const webhookFallback = buildWebhookResponse({
    intent: {
      displayName: response.queryResult?.intent?.displayName || 'Fallback',
    },
    parameters: response.queryResult?.parameters?.fields
      ? Object.fromEntries(
          Object.entries(response.queryResult.parameters.fields).map(([key, value]) => [
            key,
            value.stringValue || value.numberValue || value.boolValue || '',
          ])
        )
      : {},
    queryText: message,
  });

  return {
    fulfillmentText: fulfillmentText || webhookFallback.fulfillmentText,
    intent: response.queryResult?.intent?.displayName || 'Fallback',
    confidence: response.queryResult?.intentDetectionConfidence || 0,
    payload: webhookFallback.payload,
  };
}

export async function chatbotDetectIntent(req: Request, res: Response) {
  const body = req.body as ChatbotMessageRequest;
  const message = body.message?.trim();

  if (!message) {
    res.status(400).json({ message: 'El mensaje es obligatorio.' });
    return;
  }

  try {
    const sessionId = body.sessionId || randomUUID();
    const result = await detectIntentText(message, sessionId);

    res.json({
      sessionId,
      ...result,
    });
  } catch (error: unknown) {
    const messageText = error instanceof Error ? error.message : String(error);

    res.status(500).json({
      message: 'No se pudo consultar Dialogflow.',
      detail: messageText,
    });
  }
}
