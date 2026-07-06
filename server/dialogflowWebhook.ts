import type { Request, Response } from 'express';
import { faqs } from './faqs';
import { findProductByName } from './products';
import { recommendProducts } from './recommendationRules';
import { createWhatsappLink } from './whatsapp';

interface DialogflowQueryResult {
  intent?: {
    displayName?: string;
  };
  parameters?: Record<string, unknown>;
  queryText?: string;
}

interface DialogflowWebhookRequest {
  queryResult?: DialogflowQueryResult;
  session?: string;
}

interface ChatbotMessageRequest {
  message?: string;
  sessionId?: string;
}

interface FulfillmentPayload {
  fulfillmentText: string;
  payload?: {
    whatsappUrl?: string;
    catalogUrl?: string;
    products?: Array<{
      id: string;
      name: string;
      description: string;
      catalogPath: string;
    }>;
  };
}

function getStringParameter(parameters: Record<string, unknown>, name: string) {
  const value = parameters[name];

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string');
    return typeof first === 'string' ? first : undefined;
  }

  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function normalizeKey(value?: string) {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function advisorLink(reason: string) {
  return createWhatsappLink(
    `Hola, vengo del asistente virtual de Juhnios Rold. Necesito ayuda con: ${reason}`
  );
}

function withAdvisor(text: string, reason: string): FulfillmentPayload {
  return {
    fulfillmentText: `${text} Puedes escribirnos por WhatsApp aqui: ${advisorLink(reason)}`,
    payload: {
      whatsappUrl: advisorLink(reason),
    },
  };
}

function recommend(parameters: Record<string, unknown>): FulfillmentPayload {
  const need = getStringParameter(parameters, 'necesidad_capilar');
  const recommendation = recommendProducts(need);

  if (recommendation.products.length === 0) {
    return withAdvisor(recommendation.reason, need || 'recomendacion personalizada');
  }

  const names = recommendation.products.map((product) => product.name).join(', ');

  return {
    fulfillmentText: `${recommendation.reason} Te sugiero: ${names}. Mira el catalogo o te paso con un asesor para elegir el ideal.`,
    payload: {
      catalogUrl: faqs.catalogUrl,
      whatsappUrl: advisorLink(`recomendacion para ${need || 'mi cabello'}`),
      products: recommendation.products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        catalogPath: product.catalogPath,
      })),
    },
  };
}

function buyProduct(parameters: Record<string, unknown>): FulfillmentPayload {
  const productName = getStringParameter(parameters, 'producto');
  const product = findProductByName(productName);

  if (!productName) {
    return {
      fulfillmentText:
        'Claro. Puedes comprar desde el catalogo. Si quieres, dime el producto y te guio.',
      payload: {
        catalogUrl: faqs.catalogUrl,
        whatsappUrl: advisorLink('comprar un producto'),
      },
    };
  }

  if (!product) {
    return withAdvisor(
      'No tengo informacion exacta de ese producto en este momento.',
      `comprar ${productName}`
    );
  }

  return {
    fulfillmentText: `${product.name} esta en nuestro catalogo. No invento precio ni stock; revisalo en tienda o confirmalo con un asesor.`,
    payload: {
      catalogUrl: product.catalogPath,
      whatsappUrl: advisorLink(`comprar ${product.name}`),
      products: [
        {
          id: product.id,
          name: product.name,
          description: product.description,
          catalogPath: product.catalogPath,
        },
      ],
    },
  };
}

function shippingInfo(parameters: Record<string, unknown>): FulfillmentPayload {
  const city = getStringParameter(parameters, 'ciudad');
  const key = normalizeKey(city);
  const delivery = key ? faqs.shipping.cityDeliveryDays[key] : undefined;

  if (city && delivery) {
    return {
      fulfillmentText: `Si estas en ${city}, la entrega estimada es ${delivery}. El valor final se confirma en el checkout.`,
      payload: {
        catalogUrl: faqs.catalogUrl,
      },
    };
  }

  if (city) {
    return withAdvisor(
      `Hacemos envios a Colombia. Para ${city}, confirmemos cobertura y tiempo exacto con un asesor.`,
      `envio a ${city}`
    );
  }

  return {
    fulfillmentText: `${faqs.shipping.defaultText} Dime tu ciudad y te oriento mejor.`,
    payload: {
      whatsappUrl: advisorLink('consulta de envio'),
    },
  };
}

function wholesale(): FulfillmentPayload {
  return withAdvisor(faqs.wholesale, 'compra mayorista');
}

function paymentMethods(): FulfillmentPayload {
  return withAdvisor(faqs.payments, 'formas de pago');
}

function orderStatus(parameters: Record<string, unknown>): FulfillmentPayload {
  const orderNumber = getStringParameter(parameters, 'numero_pedido');

  if (orderNumber) {
    return withAdvisor(
      `Perfecto. Para validar el estado del pedido ${orderNumber}, te paso con un asesor.`,
      `estado del pedido ${orderNumber}`
    );
  }

  return withAdvisor(faqs.orderStatus, 'estado de pedido');
}

function promotions(): FulfillmentPayload {
  return withAdvisor(faqs.promotions, 'promociones vigentes');
}

function catalog(): FulfillmentPayload {
  return {
    fulfillmentText:
      'Claro. Puedes ver el catalogo completo y elegir tus productos favoritos. Si quieres recomendacion, dime que necesita tu cabello.',
    payload: {
      catalogUrl: faqs.catalogUrl,
      whatsappUrl: advisorLink('catalogo de productos'),
    },
  };
}

function humanHandoff(queryText?: string): FulfillmentPayload {
  return withAdvisor(
    'Listo. Te conecto con un asesor por WhatsApp para ayudarte de forma personalizada.',
    queryText || 'asesoria personalizada'
  );
}

function fallback(queryText?: string): FulfillmentPayload {
  return withAdvisor(
    'No tengo esa informacion exacta y prefiero no inventarla.',
    queryText || 'consulta no resuelta'
  );
}

export function buildWebhookResponse(queryResult?: DialogflowQueryResult): FulfillmentPayload {
  const intentName = queryResult?.intent?.displayName || 'Fallback';
  const parameters = queryResult?.parameters || {};

  switch (intentName) {
    case 'Comprar producto':
      return buyProduct(parameters);
    case 'Recomendar producto':
      return recommend(parameters);
    case 'Compra mayorista':
      return wholesale();
    case 'Consulta de envio':
      return shippingInfo(parameters);
    case 'Formas de pago':
      return paymentMethods();
    case 'Estado de pedido':
      return orderStatus(parameters);
    case 'Catalogo':
      return catalog();
    case 'Promociones':
      return promotions();
    case 'Hablar con asesor':
      return humanHandoff(queryResult?.queryText);
    case 'Fallback':
    default:
      return fallback(queryResult?.queryText);
  }
}

export function dialogflowWebhook(req: Request, res: Response) {
  const expectedToken = process.env.DIALOGFLOW_WEBHOOK_TOKEN;

  if (expectedToken) {
    const receivedToken = req.header('X-Webhook-Token');
    if (receivedToken !== expectedToken) {
      res.status(401).json({ message: 'Token de webhook invalido.' });
      return;
    }
  }

  const body = req.body as DialogflowWebhookRequest;
  const response = buildWebhookResponse(body.queryResult);

  res.json(response);
}

export async function localRuleBasedChat(req: Request, res: Response) {
  const body = req.body as ChatbotMessageRequest;
  const message = body.message?.trim();

  if (!message) {
    res.status(400).json({
      message: 'El mensaje es obligatorio.',
    });
    return;
  }

  const normalized = normalizeKey(message) || '';

  const queryResult: DialogflowQueryResult = {
    queryText: message,
    intent: { displayName: 'Fallback' },
    parameters: {},
  };

  if (normalized.includes('recom') || normalized.includes('frizz') || normalized.includes('brillo')) {
    queryResult.intent = { displayName: 'Recomendar producto' };
    queryResult.parameters = {
      necesidad_capilar: normalized.includes('frizz')
        ? 'frizz'
        : normalized.includes('brillo')
          ? 'brillo'
          : undefined,
    };
  } else if (normalized.includes('envio') || normalized.includes('entrega')) {
    queryResult.intent = { displayName: 'Consulta de envio' };
  } else if (normalized.includes('mayor')) {
    queryResult.intent = { displayName: 'Compra mayorista' };
  } else if (normalized.includes('pago') || normalized.includes('tarjeta')) {
    queryResult.intent = { displayName: 'Formas de pago' };
  } else if (normalized.includes('pedido') || normalized.includes('guia')) {
    queryResult.intent = { displayName: 'Estado de pedido' };
  } else if (normalized.includes('promo') || normalized.includes('descuento')) {
    queryResult.intent = { displayName: 'Promociones' };
  } else if (normalized.includes('catalogo') || normalized.includes('producto')) {
    queryResult.intent = { displayName: 'Catalogo' };
  } else if (normalized.includes('asesor') || normalized.includes('whatsapp')) {
    queryResult.intent = { displayName: 'Hablar con asesor' };
  }

  res.json(buildWebhookResponse(queryResult));
}
