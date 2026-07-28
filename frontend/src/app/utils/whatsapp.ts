export const WHATSAPP_PHONE = '573046353167';

export function openWhatsApp(message: string): void {
  window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`, '_blank');
}
