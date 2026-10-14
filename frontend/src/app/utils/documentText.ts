// Textos compartidos entre el PDF y el Word de la cuenta de cobro.
import { RETENTION_LIMIT, UVT, UVT_RESOLUTION, UVT_YEAR } from './retention';

export interface PaymentAccountDoc {
  number: number | null;
  issue_date: string;
  service_title: string;
  contractor_name: string;
  contractor_document: string;
  contractor_document_city: string;
  contractor_address: string;
  contractor_city: string;
  contractor_email: string;
  contractor_phone: string;
  client_name: string;
  client_branch: string;
  client_document: string;
  client_address: string;
  client_city: string;
  client_legal_rep: string;
  client_legal_rep_document: string;
  description: string;
  contract_reference: string;
  period_start: string;
  period_end: string;
  supervisor: string;
  requisition_number: string;
  requisition_date: string;
  amount: number;
  vat_note: string;
  no_withholding_letter: boolean;
  contract_object: string;
  monthly_value: number | null;
  bank_name: string;
  account_type: string;
  account_number: string;
  account_holder: string;
  account_holder_document: string;
  signature: string;
}

// ---------- Números en letras (español) ----------

const UNITS = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function below1000(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (rest) {
    if (rest < 30) parts.push(UNITS[rest]);
    else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      parts.push(u ? `${TENS[t]} y ${UNITS[u]}` : TENS[t]);
    }
  }
  return parts.join(' ');
}

function integerToWords(n: number): string {
  if (n === 0) return 'cero';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) {
    parts.push(millions === 1 ? 'un millón' : `${integerToWords(millions)} millones`);
  }
  if (thousands) {
    parts.push(thousands === 1 ? 'mil' : `${below1000(thousands)} mil`);
  }
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** "un millón trescientos mil pesos M/CTE" (minúsculas salvo la sigla). */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(Number(amount) || 0));
  const words = integerToWords(n);
  const exactMillions = n >= 1_000_000 && n % 1_000_000 === 0;
  const noun = n === 1 ? 'peso' : exactMillions ? 'de pesos' : 'pesos';
  return `${words} ${noun} M/CTE`;
}

// ---------- Formato ----------

export function formatCOP(amount: number): string {
  return `$${Math.round(Number(amount) || 0).toLocaleString('es-CO')}`;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** "1 de septiembre de 2026" (sin desfases de zona horaria). */
export function longDate(iso: string): string {
  const p = parseIso(iso);
  return p ? `${p.d} de ${MONTHS[p.m - 1]} de ${p.y}` : '';
}

/** "dd/mm/aaaa" */
export function shortDate(iso: string): string {
  const p = parseIso(iso);
  return p ? `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}` : '';
}

export function formatNumber(number: number | null): string {
  return number == null ? '---' : String(number).padStart(3, '0');
}

export function paymentAccountFileName(number: number | null, ext: 'pdf' | 'docx'): string {
  return `cuenta-de-cobro-${number == null ? 'borrador' : formatNumber(number)}.${ext}`;
}

// ---------- Cuenta de cobro (página 1) ----------

export function contractorDocumentLine(a: PaymentAccountDoc): string {
  const city = a.contractor_document_city ? ` de ${a.contractor_document_city}` : '';
  return `C.C. ${a.contractor_document}${city}`;
}

export function contractorLines(a: PaymentAccountDoc): string[] {
  return [contractorDocumentLine(a), a.contractor_address, a.contractor_city].filter(Boolean);
}

export function clientLines(a: PaymentAccountDoc): string[] {
  return [
    a.client_branch,
    a.client_document ? `NIT ${a.client_document}` : '',
    a.client_address,
    a.client_city,
    a.client_legal_rep ? `Rep. legal: ${a.client_legal_rep}` : '',
    a.client_legal_rep_document ? `C.C. ${a.client_legal_rep_document}` : '',
  ].filter(Boolean);
}

export function conceptNoteLines(a: PaymentAccountDoc): string[] {
  const lines: string[] = [];
  if (a.contract_reference) lines.push(`Contrato: ${a.contract_reference}.`);
  if (a.period_start && a.period_end) {
    lines.push(`Periodo: ${longDate(a.period_start)} al ${longDate(a.period_end)}.`);
  } else if (a.period_start || a.period_end) {
    lines.push(`Periodo: ${longDate(a.period_start || a.period_end)}.`);
  }
  if (a.supervisor) lines.push(`Interventor: ${a.supervisor}.`);
  if (a.requisition_number || a.requisition_date) {
    const parts = [
      a.requisition_number ? `No. ${a.requisition_number}` : '',
      a.requisition_date ? `Fecha: ${longDate(a.requisition_date)}` : '',
    ].filter(Boolean);
    lines.push(`Requisición: ${parts.join(' · ')}.`);
  }
  return lines;
}

export function totalsLine(a: PaymentAccountDoc): string {
  const iva = a.vat_note || 'No aplica';
  const retentions = a.no_withholding_letter
    ? 'No aplica (ver certificado bajo juramento anexo)'
    : 'Según aplique';
  return `Subtotal: ${formatCOP(a.amount)} COP · IVA: ${iva} · Retenciones: ${retentions}.`;
}

export function hasPaymentInfo(a: PaymentAccountDoc): boolean {
  return Boolean(a.bank_name || a.account_type || a.account_number || a.account_holder);
}

export const DECLARATION_TEXT =
  'Declaración: los servicios relacionados fueron prestados conforme a lo acordado. El prestador manifiesta que no es responsable de IVA, de acuerdo con la información contractual. Documento expedido para fines administrativos, contables y de pago.';

export const NOT_INVOICE_TEXT =
  'Esta cuenta de cobro no constituye factura de venta. Se adjunta soporte de seguridad social cuando corresponda.';

export function signatureDetailLines(a: PaymentAccountDoc): { document: string; contact: string } {
  const contact = [a.contractor_email, a.contractor_phone ? `Tel. ${a.contractor_phone}` : '']
    .filter(Boolean)
    .join(' · ');
  return { document: contractorDocumentLine(a), contact };
}

// ---------- Carta de certificación (página 2) ----------
// Las negritas se marcan con **…**.

export interface CertificateText {
  dateLine: string;
  addressee: string[]; // "Señores,", cliente, NIT
  ref: string;
  title: string;
  paragraphs: string[];
  closing: string;
  signerName: string;
  signerDocument: string;
}

export function buildCertificateText(a: PaymentAccountDoc): CertificateText {
  const client = a.client_name.toUpperCase();
  const name = a.contractor_name.toUpperCase();
  const base = a.monthly_value && a.monthly_value > 0 ? a.monthly_value : a.amount;
  const baseWords = amountInWords(base).toUpperCase();
  const limit = formatCOP(RETENTION_LIMIT);

  const paragraphs = [
    `**${name}**, identificado(a) con cédula de ciudadanía No. ${a.contractor_document}, con el fin de dar cumplimiento a las disposiciones establecidas en la Ley 1819 de 2016 y en el parágrafo 2 del artículo 383 del Estatuto Tributario, manifiesto bajo la gravedad de juramento que:`,
    `Los ingresos que percibo de **${client}** en virtud del contrato de prestación de servicios suscrito entre las partes, cuyo objeto corresponde a **${a.contract_object}**, corresponden a honorarios y compensación por servicios personales, y constituyen renta de trabajo en los términos del artículo 103 del Estatuto Tributario, sin que exista relación laboral, legal o reglamentaria entre las partes.`,
    'En consecuencia, la retención en la fuente aplicable a dichos pagos se rige por la tabla del artículo 383 del Estatuto Tributario, modificado por el artículo 8 de la Ley 2277 de 2022, y no por las tarifas de retención por honorarios u otros conceptos distintos previstas en los artículos 392 y siguientes del mismo Estatuto.',
    'El parágrafo 2 del artículo 383 dispone que la retención se practique por el sistema de “pagos mensualizados”, tomando el valor mensual del contrato, depurado de los aportes obligatorios a salud y pensión cuando a ello haya lugar, y ubicando dicho valor en la tabla de retención.',
    `El primer rango de esta tabla comprende las bases gravables de cero (0) a noventa y cinco (95) UVT mensuales, al cual corresponde una tarifa de retención del cero por ciento (0%); para el año ${UVT_YEAR}, con una UVT de **${formatCOP(UVT)}** según la Resolución DIAN ${UVT_RESOLUTION}, dicho límite equivale a **${limit}** mensuales.`,
    `Toda vez que el valor mensual que percibo de **EL CONTRATANTE**, equivalente a **${baseWords} (${formatCOP(base)})**, no supera dicho umbral, la base gravable se ubica dentro del primer rango de la tabla del artículo 383, al cual corresponde tarifa cero.`,
    'En consecuencia, solicito a **EL CONTRATANTE** que no se practique retención en la fuente sobre los pagos derivados del contrato de prestación de servicios de la referencia, sin perjuicio de mi compromiso de informar cualquier variación en el valor mensual pactado que pudiera modificar esta base gravable.',
  ];

  return {
    dateLine: `${a.contractor_city ? `${a.contractor_city}, ` : ''}${longDate(a.issue_date)}`,
    addressee: ['Señores,', client, a.client_document ? `NIT. ${a.client_document}` : ''].filter(Boolean),
    ref: 'REF: CERTIFICADO PARA EFECTOS DE RETENCIÓN EN LA FUENTE - LEY 1819 DE 2016 Y LEY 2277 DE 2022 - RENTAS DE TRABAJO.',
    title: 'CERTIFICADO BAJO LA GRAVEDAD DE JURAMENTO',
    paragraphs,
    closing: 'Cordialmente,',
    signerName: name,
    signerDocument: `C.C. ${a.contractor_document}`,
  };
}

/** Divide un texto con **negritas** en segmentos. */
export function parseBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split('**')
    .map((chunk, i) => ({ text: chunk, bold: i % 2 === 1 }))
    .filter((s) => s.text.length > 0);
}
