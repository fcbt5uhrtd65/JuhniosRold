export const faqs = {
  catalogUrl: process.env.CATALOG_URL || '/catalogo',
  freeShippingThreshold: process.env.ECOMMERCE_FREE_SHIPPING_THRESHOLD || '80000',
  shipping: {
    defaultText:
      'Hacemos envios a Colombia. En ciudades principales la entrega estimada suele ser de 2 a 5 dias habiles.',
    cityDeliveryDays: {
      bogota: '2-3 dias habiles',
      medellin: '2-3 dias habiles',
      cali: '3-4 dias habiles',
      barranquilla: '3-4 dias habiles',
      cartagena: '3-4 dias habiles',
      bucaramanga: '3-4 dias habiles',
    } as Record<string, string>,
  },
  payments:
    'Puedes pagar desde el checkout con los medios disponibles en la tienda. No confirmo medios especiales sin validarlo con un asesor.',
  wholesale:
    'Para compras mayoristas validamos cantidades, ciudad y productos con un asesor comercial.',
  promotions:
    'Las promociones cambian segun disponibilidad. Para no inventar descuentos, revisa el catalogo o habla con un asesor.',
  orderStatus:
    'Para revisar tu pedido necesito numero de orden o guia. Si no lo tienes, un asesor te ayuda por WhatsApp.',
};
