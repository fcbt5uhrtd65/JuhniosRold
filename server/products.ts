export type ProductCategory = 'capilar' | 'corporal';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  needs: string[];
  catalogPath: string;
}

export const products: Product[] = [
  {
    id: 'full-liso',
    name: 'Full Liso',
    category: 'capilar',
    description: 'Linea para controlar volumen, suavizar y apoyar un acabado mas liso.',
    needs: ['frizz', 'alisar', 'suavidad', 'cabello maltratado'],
    catalogPath: '/catalogo',
  },
  {
    id: 'aceite-argan',
    name: 'Aceite de Argan',
    category: 'capilar',
    description: 'Aceite capilar para brillo, suavidad y puntas secas.',
    needs: ['brillo', 'suavidad', 'puntas secas', 'cabello opaco'],
    catalogPath: '/catalogo',
  },
  {
    id: 'aceite-coco',
    name: 'Aceite de Coco',
    category: 'capilar',
    description: 'Aceite para nutricion, suavidad y cabello seco.',
    needs: ['cabello seco', 'suavidad', 'puntas secas'],
    catalogPath: '/catalogo',
  },
  {
    id: 'tratamiento-capilar-nutritivo',
    name: 'Tratamiento Capilar Nutritivo',
    category: 'capilar',
    description: 'Tratamiento para cabello seco, opaco o maltratado.',
    needs: ['cabello seco', 'cabello maltratado', 'cabello opaco', 'brillo'],
    catalogPath: '/catalogo',
  },
  {
    id: 'tono-sobre-tono',
    name: 'Tono sobre Tono',
    category: 'capilar',
    description: 'Producto para apoyar el color cosmetico del cabello tinturado.',
    needs: ['cabello tinturado', 'cabello opaco', 'brillo'],
    catalogPath: '/catalogo',
  },
  {
    id: 'keratina',
    name: 'Keratina',
    category: 'capilar',
    description: 'Opcion cosmetica para suavidad, control de frizz y apariencia disciplinada.',
    needs: ['frizz', 'alisar', 'suavidad', 'cabello maltratado'],
    catalogPath: '/catalogo',
  },
  {
    id: 'romero-quina',
    name: 'Romero y Quina',
    category: 'capilar',
    description: 'Linea cosmetica de cuidado y fortalecimiento capilar.',
    needs: ['caida', 'cabello opaco'],
    catalogPath: '/catalogo',
  },
  {
    id: 'locion-corporal',
    name: 'Locion corporal',
    category: 'corporal',
    description: 'Locion para hidratacion y suavidad de la piel.',
    needs: ['suavidad'],
    catalogPath: '/catalogo',
  },
];

export function findProductByName(productName?: string | string[]) {
  const normalized = Array.isArray(productName) ? productName[0] : productName;

  if (!normalized) return undefined;

  return products.find(
    (product) => product.name.toLowerCase() === normalized.toLowerCase()
  );
}
