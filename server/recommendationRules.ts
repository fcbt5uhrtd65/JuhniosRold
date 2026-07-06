import { products, type Product } from './products';

export interface Recommendation {
  products: Product[];
  reason: string;
}

const needAliases: Record<string, string> = {
  encrespamiento: 'frizz',
  'cabello reseco': 'cabello seco',
  'pelo seco': 'cabello seco',
  'sin brillo': 'cabello opaco',
  'cabello apagado': 'cabello opaco',
  'puntas abiertas': 'puntas secas',
  liso: 'alisar',
  alisado: 'alisar',
  fortalecer: 'caida',
  sedosidad: 'suavidad',
};

function normalizeNeed(need?: string | string[]) {
  const rawNeed = Array.isArray(need) ? need[0] : need;

  if (!rawNeed) return undefined;

  const normalized = rawNeed.trim().toLowerCase();
  return needAliases[normalized] || normalized;
}

export function recommendProducts(need?: string | string[]): Recommendation {
  const normalizedNeed = normalizeNeed(need);

  if (!normalizedNeed) {
    return {
      products: [
        products.find((product) => product.id === 'tratamiento-capilar-nutritivo')!,
        products.find((product) => product.id === 'aceite-argan')!,
      ],
      reason: 'Para recomendarte mejor, dime si buscas controlar frizz, brillo, suavidad, nutricion o cuidado para cabello tinturado.',
    };
  }

  const matches = products.filter((product) =>
    product.needs.some((productNeed) => productNeed === normalizedNeed)
  );

  if (matches.length === 0) {
    return {
      products: [],
      reason: 'No tengo una recomendacion exacta para esa necesidad. Te conecto con un asesor para ayudarte sin inventar.',
    };
  }

  return {
    products: matches.slice(0, 3),
    reason: `Para ${normalizedNeed}, estas opciones pueden ayudarte desde el cuidado cosmetico capilar.`,
  };
}
