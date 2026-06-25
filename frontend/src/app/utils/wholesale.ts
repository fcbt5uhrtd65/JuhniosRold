export const WHOLESALE_SETTINGS_KEY = 'juhnios_wholesale_settings';

export interface WholesaleSettings {
  minimumPurchase: number;
  discountPercentage: number;
}

export interface WholesaleDiscountSummary {
  settings: WholesaleSettings;
  discount: number;
  totalAfterDiscount: number;
  remaining: number;
  isActive: boolean;
}

export const DEFAULT_WHOLESALE_SETTINGS: WholesaleSettings = {
  minimumPurchase: 300000,
  discountPercentage: 10,
};

export function getWholesaleSettings(): WholesaleSettings {
  if (typeof window === 'undefined') return DEFAULT_WHOLESALE_SETTINGS;

  try {
    const stored = window.localStorage.getItem(WHOLESALE_SETTINGS_KEY);
    if (!stored) return DEFAULT_WHOLESALE_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<WholesaleSettings>;
    return {
      minimumPurchase: Number(parsed.minimumPurchase) > 0
        ? Number(parsed.minimumPurchase)
        : DEFAULT_WHOLESALE_SETTINGS.minimumPurchase,
      discountPercentage: Number(parsed.discountPercentage) > 0
        ? Number(parsed.discountPercentage)
        : DEFAULT_WHOLESALE_SETTINGS.discountPercentage,
    };
  } catch {
    return DEFAULT_WHOLESALE_SETTINGS;
  }
}

export function saveWholesaleSettings(settings: WholesaleSettings) {
  window.localStorage.setItem(WHOLESALE_SETTINGS_KEY, JSON.stringify(settings));
}

export function calculateWholesaleDiscount(subtotal: number, isWholesaleCustomer = false): WholesaleDiscountSummary {
  const settings = getWholesaleSettings();
  const isActive = isWholesaleCustomer && subtotal >= settings.minimumPurchase;
  const discount = isActive ? Math.round(subtotal * (settings.discountPercentage / 100)) : 0;

  return {
    settings,
    discount,
    totalAfterDiscount: Math.max(0, subtotal - discount),
    remaining: isWholesaleCustomer ? Math.max(0, settings.minimumPurchase - subtotal) : 0,
    isActive,
  };
}

export function generateWholesaleCode(seed: string): string {
  const clean = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const base = clean.slice(0, 6) || Math.random().toString(36).slice(2, 8).toUpperCase();
  return `JR-MAY-${base}`;
}
