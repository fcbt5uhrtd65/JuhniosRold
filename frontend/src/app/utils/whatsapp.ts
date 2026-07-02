export const WHATSAPP_PHONE = '573001234567';

export function openWhatsApp(message: string): void {
  window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`, '_blank');
}
