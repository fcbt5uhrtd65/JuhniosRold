// PDF de la cuenta de cobro (jsPDF, carta, mm, Helvetica).
import { jsPDF } from 'jspdf';
import {
  DECLARATION_TEXT,
  NOT_INVOICE_TEXT,
  amountInWords,
  buildCertificateText,
  clientLines,
  conceptNoteLines,
  contractorLines,
  formatCOP,
  formatNumber,
  hasPaymentInfo,
  paymentAccountFileName,
  parseBold,
  shortDate,
  signatureDetailLines,
  totalsLine,
  type PaymentAccountDoc,
} from './documentText';

type RGB = [number, number, number];
const DARK: RGB = [0x14, 0x21, 0x3d];
const RED: RGB = [0xc8, 0x1e, 0x2d];
const GRAY: RGB = [0x64, 0x70, 0x8b];

const PAGE_H = 279.4;
const ML = 20.5; // margen izquierdo
const MR = 193.5; // borde derecho del contenido
const CW = MR - ML;
const COL2 = 114;
const BOTTOM = PAGE_H - 16;
const SIG_H = 18;
const SIG_MAX_W = 60;
const SIG_LINE_W = 77;

// ---------- Utilidades de medición ----------

/** Mide sin kerning: jsPDF.getTextWidth lo aplica, pero el PDF dibuja sin él y
 *  los espacios salen apretados. */
function textWidth(doc: jsPDF, text: string, size: number, bold = false): number {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  return (doc.getStringUnitWidth(text, { kerning: {} } as never) * size) / doc.internal.scaleFactor;
}

function wrapText(doc: jsPDF, text: string, maxW: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  for (const paragraph of String(text ?? '').split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && textWidth(doc, candidate, size, bold) > maxW) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function setText(doc: jsPDF, size: number, bold: boolean, color: RGB) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

function drawLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  lineH: number,
  opts?: { align?: 'left' | 'right' | 'center' },
): number {
  for (const line of lines) {
    doc.text(line, x, y, opts);
    y += lineH;
  }
  return y;
}

interface SignatureImage {
  data: string;
  format: 'PNG' | 'JPEG';
  w: number;
  h: number;
}

function loadSignature(doc: jsPDF, account: PaymentAccountDoc, enabled: boolean): SignatureImage | null {
  if (!enabled || !account.signature || !account.signature.startsWith('data:image/')) return null;
  try {
    const props = doc.getImageProperties(account.signature);
    const ratio = props.width / props.height || 1;
    let h = SIG_H;
    let w = h * ratio;
    if (w > SIG_MAX_W) {
      w = SIG_MAX_W;
      h = w / ratio;
    }
    const format = /^data:image\/jpe?g/i.test(account.signature) ? 'JPEG' : 'PNG';
    return { data: account.signature, format, w, h };
  } catch {
    return null;
  }
}

/** Dibuja la firma (si hay) sobre una línea. Devuelve la y bajo la línea. */
function drawSignatureBlock(doc: jsPDF, y: number, sig: SignatureImage | null): number {
  const lineY = y + SIG_H + 1;
  if (sig) doc.addImage(sig.data, sig.format, ML, lineY - 1 - sig.h, sig.w, sig.h);
  doc.setDrawColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.setLineWidth(0.2);
  doc.line(ML, lineY, ML + SIG_LINE_W, lineY);
  return lineY;
}

// ---------- Página 1 ----------

function drawAccountPage(doc: jsPDF, a: PaymentAccountDoc, sig: SignatureImage | null) {
  let y = 25;
  setText(doc, 24, true, DARK);
  doc.text('CUENTA DE COBRO', ML, y);

  y += 8;
  setText(doc, 9.5, false, RED);
  doc.text(`No. ${formatNumber(a.number)}   |   Fecha: ${shortDate(a.issue_date)}`, MR, y, { align: 'right' });

  y += 8.5;
  setText(doc, 8.5, true, GRAY);
  doc.text(wrapText(doc, a.service_title.toUpperCase(), CW, 8.5, true), ML, y);

  // Prestador / Cliente
  y += 9;
  setText(doc, 8, true, RED);
  doc.text('PRESTADOR', ML, y);
  doc.text('CLIENTE', COL2, y);
  const colW = MR - COL2;
  const leftW = COL2 - ML - 6;

  const leftTop = y + 6;
  setText(doc, 10.5, true, DARK);
  const nameL = wrapText(doc, a.contractor_name, leftW, 10.5, true);
  const nameR = wrapText(doc, a.client_name, colW, 10.5, true);
  let yl = drawLines(doc, nameL, ML, leftTop, 4.6);
  setText(doc, 10.5, true, DARK);
  let yr = drawLines(doc, nameR, COL2, leftTop, 4.6);

  setText(doc, 9, false, GRAY);
  yl = drawLines(doc, contractorLines(a).flatMap((l) => wrapText(doc, l, leftW, 9)), ML, yl + 1, 4.2);
  yr = drawLines(doc, clientLines(a).flatMap((l) => wrapText(doc, l, colW, 9)), COL2, yr + 1, 4.2);
  y = Math.max(yl, yr);

  // Concepto
  y += 4;
  setText(doc, 8, true, RED);
  doc.text('CONCEPTO', ML, y);
  y += 6.5;
  setText(doc, 10.5, false, DARK);
  y = drawLines(doc, wrapText(doc, a.description, CW, 10.5), ML, y, 4.6);
  const notes = conceptNoteLines(a);
  if (notes.length) {
    y += 1.5;
    setText(doc, 9, false, GRAY);
    y = drawLines(doc, notes.flatMap((l) => wrapText(doc, l, CW, 9)), ML, y, 4.2);
  }

  // Valor total
  y += 5;
  setText(doc, 8, true, RED);
  doc.text('VALOR TOTAL', ML, y);
  y += 6;
  setText(doc, 8.5, true, RED);
  const words = wrapText(doc, amountInWords(a.amount).toUpperCase(), 105, 8.5, true);
  drawLines(doc, words, ML, y, 4);
  setText(doc, 18, true, DARK);
  const amountY = y + 8.5;
  doc.text(`${formatCOP(a.amount)} COP`, MR, amountY, { align: 'right' });
  y = Math.max(y + words.length * 4, amountY) + 5.5;
  setText(doc, 8, false, GRAY);
  y = drawLines(doc, wrapText(doc, totalsLine(a), CW, 8), ML, y, 3.8);

  // Información de pago
  if (hasPaymentInfo(a)) {
    y += 5;
    setText(doc, 8, true, RED);
    doc.text('INFORMACIÓN DE PAGO', ML, y);
    y += 6;
    const cell = (label: string, value: string, extra: string, x: number, cy: number): number => {
      setText(doc, 8, true, GRAY);
      doc.text(label, x, cy);
      setText(doc, 10.5, true, DARK);
      const v = wrapText(doc, value || '—', colW, 10.5, true);
      let ey = drawLines(doc, v, x, cy + 5.8, 4.6);
      if (extra) {
        setText(doc, 9, false, GRAY);
        doc.text(extra, x, ey - 0.4);
        ey += 4.2;
      }
      return ey;
    };
    const holderDoc = a.account_holder_document ? `C.C. ${a.account_holder_document}` : '';
    const r1a = cell('ENTIDAD FINANCIERA', a.bank_name, '', ML, y);
    const r1b = cell('TIPO DE CUENTA', a.account_type, '', COL2, y);
    y = Math.max(r1a, r1b) + 1.5;
    const r2a = cell('NÚMERO DE CUENTA', a.account_number, '', ML, y);
    const r2b = cell('TITULAR', a.account_holder, holderDoc, COL2, y);
    y = Math.max(r2a, r2b);
  }

  // Declaraciones
  y += 3;
  setText(doc, 7.5, false, GRAY);
  y = drawLines(doc, wrapText(doc, DECLARATION_TEXT, CW, 7.5), ML, y, 3.3);
  y += 1.5;
  y = drawLines(doc, wrapText(doc, NOT_INVOICE_TEXT, CW, 7.5), ML, y, 3.3);

  // Firma: si no cabe en la página, pasa a la siguiente.
  const detail = signatureDetailLines(a);
  const blockH = 5 + SIG_H + 1 + 5 + 4.4 + (detail.contact ? 4.2 : 0) + 4.2;
  y += 5;
  if (y + blockH > BOTTOM) {
    doc.addPage();
    y = 25;
  }
  setText(doc, 10, false, DARK);
  doc.text('Atentamente,', ML, y);
  const lineY = drawSignatureBlock(doc, y + 1.5, sig);
  setText(doc, 10.5, true, DARK);
  doc.text(a.contractor_name, ML, lineY + 5.5);
  setText(doc, 9, false, GRAY);
  doc.text(detail.document, ML, lineY + 10);
  if (detail.contact) doc.text(detail.contact, ML, lineY + 14.2);
}

// ---------- Página 2: carta de certificación ----------

interface Word {
  pieces: { text: string; bold: boolean }[];
  width: number;
}

function toWords(doc: jsPDF, text: string, size: number): Word[] {
  const words: Word[] = [];
  let current: Word | null = null;
  for (const seg of parseBold(text)) {
    for (const part of seg.text.split(/(\s+)/)) {
      if (part === '') continue;
      if (/^\s+$/.test(part)) {
        current = null;
        continue;
      }
      if (!current) {
        current = { pieces: [], width: 0 };
        words.push(current);
      }
      current.pieces.push({ text: part, bold: seg.bold });
      current.width += textWidth(doc, part, size, seg.bold);
    }
  }
  return words;
}

/** Párrafo justificado con negritas. Devuelve la y siguiente. */
function drawJustified(doc: jsPDF, text: string, y: number, size: number, lineH: number): number {
  const words = toWords(doc, text, size);
  const spaceW = textWidth(doc, ' ', size);
  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineW = 0;
  for (const word of words) {
    const add = line.length ? spaceW + word.width : word.width;
    if (line.length && lineW + add > CW) {
      lines.push(line);
      line = [word];
      lineW = word.width;
    } else {
      line.push(word);
      lineW += add;
    }
  }
  if (line.length) lines.push(line);

  lines.forEach((ln, idx) => {
    const isLast = idx === lines.length - 1;
    const wordsW = ln.reduce((sum, w) => sum + w.width, 0);
    const gaps = ln.length - 1;
    const gap = !isLast && gaps > 0 ? (CW - wordsW) / gaps : spaceW;
    let x = ML;
    for (const word of ln) {
      for (const piece of word.pieces) {
        setText(doc, size, piece.bold, DARK);
        doc.text(piece.text, x, y);
        x += textWidth(doc, piece.text, size, piece.bold);
      }
      x += gap;
    }
    y += lineH;
  });
  return y;
}

function drawCertificatePage(doc: jsPDF, a: PaymentAccountDoc, sig: SignatureImage | null) {
  const cert = buildCertificateText(a);
  const size = 10;
  const lh = 4.7;
  let y = 28;

  setText(doc, size, false, DARK);
  doc.text(cert.dateLine, ML, y);
  y += 9;

  cert.addressee.forEach((line, i) => {
    setText(doc, size, i < 2, DARK);
    doc.text(line, ML, y);
    y += lh;
  });
  y += 5;

  setText(doc, size, true, DARK);
  y = drawLines(doc, wrapText(doc, cert.ref, CW, size, true), ML, y, lh);
  y += 6;

  setText(doc, size, true, DARK);
  doc.text(cert.title, ML + CW / 2, y, { align: 'center' });
  y += 7;

  for (const paragraph of cert.paragraphs) {
    y = drawJustified(doc, paragraph, y, size, lh) + 3.2;
  }

  y += 2;
  setText(doc, size, false, DARK);
  doc.text(cert.closing, ML, y);
  const lineY = drawSignatureBlock(doc, y + 1.5, sig);
  setText(doc, 10.5, true, DARK);
  doc.text(cert.signerName, ML, lineY + 5.5);
  setText(doc, 9, false, GRAY);
  doc.text(cert.signerDocument, ML, lineY + 10);
}

// ---------- API ----------

export function buildPaymentAccountPdf(account: PaymentAccountDoc, options: { withSignature?: boolean } = {}): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const sig = loadSignature(doc, account, options.withSignature ?? true);
  drawAccountPage(doc, account, sig);
  if (account.no_withholding_letter) {
    doc.addPage();
    drawCertificatePage(doc, account, sig);
  }
  return doc;
}

export function paymentAccountPdfBlob(account: PaymentAccountDoc, options: { withSignature?: boolean } = {}): Blob {
  return buildPaymentAccountPdf(account, options).output('blob');
}

export function downloadPaymentAccountPdf(account: PaymentAccountDoc, options: { withSignature?: boolean } = {}): void {
  buildPaymentAccountPdf(account, options).save(paymentAccountFileName(account.number, 'pdf'));
}
