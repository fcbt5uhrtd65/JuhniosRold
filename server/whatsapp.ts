const DEFAULT_COUNTRY_CODE = '57';
const DEFAULT_WHATSAPP_NUMBER = '3000000000';

function normalizePhoneNumber(number: string) {
  const digits = number.replace(/\D/g, '');

  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return digits;
  }

  return `${DEFAULT_COUNTRY_CODE}${digits}`;
}

export function getWhatsappNumber() {
  const configured =
    process.env.WHATSAPP_NUMBER || process.env.VITE_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_NUMBER;

  return normalizePhoneNumber(configured);
}

export function createWhatsappLink(message: string) {
  const phone = getWhatsappNumber();
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${phone}?text=${encodedMessage}`;
}
