// Constantes y reglas para el certificado de no retención en la fuente
// (art. 383 E.T., tabla de pagos mensualizados).

export const UVT_YEAR = 2026;
export const UVT = 52374;
export const UVT_RESOLUTION = '000238 de 2025';
export const UVT_RANGE_LIMIT = 95;
export const RETENTION_LIMIT = UVT_RANGE_LIMIT * UVT; // 4.975.530

export interface RetentionAdvice {
  base: number;
  /** true si la base queda en el rango 0–95 UVT (tarifa 0%). */
  withinZeroRate: boolean;
  /** true si se sugiere activar el certificado. */
  suggestCertificate: boolean;
  message: string;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Base = valor mensual del contrato; si está vacío, el valor total. */
export function getRetentionAdvice(totalValue: number, monthlyValue: number | null): RetentionAdvice {
  const base = monthlyValue && monthlyValue > 0 ? monthlyValue : totalValue;
  if (!base || base <= 0) {
    return {
      base: 0,
      withinZeroRate: false,
      suggestCertificate: false,
      message: `Ingresa el valor para evaluar la retención (límite ${fmt(RETENTION_LIMIT)} = ${UVT_RANGE_LIMIT} UVT).`,
    };
  }
  if (base <= RETENTION_LIMIT) {
    return {
      base,
      withinZeroRate: true,
      suggestCertificate: true,
      message: `La base (${fmt(base)}) no supera ${UVT_RANGE_LIMIT} UVT (${fmt(RETENTION_LIMIT)}): aplica tarifa 0% (art. 383 E.T.). Se sugiere incluir el certificado.`,
    };
  }
  return {
    base,
    withinZeroRate: false,
    suggestCertificate: false,
    message: `La base (${fmt(base)}) supera ${UVT_RANGE_LIMIT} UVT (${fmt(RETENTION_LIMIT)}): sí aplica retención en la fuente. No se sugiere el certificado.`,
  };
}
