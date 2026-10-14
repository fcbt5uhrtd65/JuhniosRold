// Word (.docx) de la cuenta de cobro: mismo contenido que el PDF.
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

const DARK = '14213D';
const RED = 'C81E2D';
const GRAY = '64708B';
const FONT = 'Arial';
const PX_PER_MM = 96 / 25.4;
const SIG_H_MM = 18;
const SIG_MAX_W_MM = 60;

function getImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => reject(new Error('No se pudo leer la firma'));
    img.src = dataUrl;
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.split(',')[1] ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildPaymentAccountDocx(
  a: PaymentAccountDoc,
  options: { withSignature?: boolean } = {},
): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableBorders,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import('docx');

  type Run = InstanceType<typeof TextRun>;
  const withSignature = (options.withSignature ?? true) && a.signature.startsWith('data:image/');

  const run = (text: string, o: { bold?: boolean; color?: string; size?: number } = {}): Run =>
    new TextRun({ text, bold: o.bold, color: o.color ?? DARK, size: Math.round((o.size ?? 10) * 2), font: FONT });

  const para = (
    text: string,
    o: { bold?: boolean; color?: string; size?: number; before?: number; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
  ) =>
    new Paragraph({
      alignment: o.align,
      spacing: { before: o.before ?? 0, after: o.after ?? 0 },
      children: [run(text, o)],
    });

  const noBorderTable = (cells: InstanceType<typeof Paragraph>[][], widths: number[]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TableBorders.NONE,
      rows: [
        new TableRow({
          children: cells.map(
            (children, i) =>
              new TableCell({
                width: { size: widths[i], type: WidthType.PERCENTAGE },
                borders: TableBorders.NONE,
                children,
              }),
          ),
        }),
      ],
    });

  // Firma (imagen sobre una línea) + bloque de texto.
  const signatureParagraphs = async (
    lead: string,
    name: { text: string; bold: boolean },
    lines: string[],
  ): Promise<InstanceType<typeof Paragraph>[]> => {
    const out: InstanceType<typeof Paragraph>[] = [para(lead, { before: 240, after: 60 })];
    const lineBorder = { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRAY, space: 1 } };
    if (withSignature) {
      const { w, h } = await getImageSize(a.signature);
      let hMm = SIG_H_MM;
      let wMm = (hMm * w) / h;
      if (wMm > SIG_MAX_W_MM) {
        wMm = SIG_MAX_W_MM;
        hMm = (wMm * h) / w;
      }
      const type = /^data:image\/jpe?g/i.test(a.signature) ? 'jpg' : 'png';
      out.push(
        new Paragraph({
          border: lineBorder,
          indent: { right: 5000 },
          children: [
            new ImageRun({
              type,
              data: dataUrlToBytes(a.signature),
              transformation: { width: Math.round(wMm * PX_PER_MM), height: Math.round(hMm * PX_PER_MM) },
            }),
          ],
        }),
      );
    } else {
      out.push(new Paragraph({ border: lineBorder, indent: { right: 5000 }, spacing: { before: 700 }, children: [] }));
    }
    out.push(para(name.text, { bold: name.bold, size: 10.5, before: 80 }));
    lines.filter(Boolean).forEach((l) => out.push(para(l, { color: GRAY, size: 9 })));
    return out;
  };

  // ---------- Página 1 ----------
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  children.push(para('CUENTA DE COBRO', { bold: true, size: 24 }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 120, after: 120 },
      children: [run(`No. ${formatNumber(a.number)}   |   Fecha: ${shortDate(a.issue_date)}`, { color: RED, size: 9.5 })],
    }),
  );
  children.push(para(a.service_title.toUpperCase(), { bold: true, color: GRAY, size: 8.5, after: 160 }));

  const partyCell = (heading: string, name: string, lines: string[]) => [
    para(heading, { bold: true, color: RED, size: 8, after: 80 }),
    para(name, { bold: true, size: 10.5, after: 40 }),
    ...lines.map((l) => para(l, { color: GRAY, size: 9 })),
  ];
  children.push(
    noBorderTable(
      [
        partyCell('PRESTADOR', a.contractor_name, contractorLines(a)),
        partyCell('CLIENTE', a.client_name, clientLines(a)),
      ],
      [50, 50],
    ),
  );

  children.push(para('CONCEPTO', { bold: true, color: RED, size: 8, before: 200, after: 80 }));
  children.push(para(a.description, { size: 10.5, after: 60 }));
  conceptNoteLines(a).forEach((l) => children.push(para(l, { color: GRAY, size: 9 })));

  children.push(para('VALOR TOTAL', { bold: true, color: RED, size: 8, before: 200, after: 60 }));
  children.push(
    noBorderTable(
      [
        [para(amountInWords(a.amount).toUpperCase(), { bold: true, color: RED, size: 8.5, before: 100 })],
        [para(`${formatCOP(a.amount)} COP`, { bold: true, size: 18, align: AlignmentType.RIGHT })],
      ],
      [55, 45],
    ),
  );
  children.push(para(totalsLine(a), { color: GRAY, size: 8, before: 80 }));

  if (hasPaymentInfo(a)) {
    children.push(para('INFORMACIÓN DE PAGO', { bold: true, color: RED, size: 8, before: 200, after: 80 }));
    const payCell = (label: string, value: string, extra = '') => [
      para(label, { bold: true, color: GRAY, size: 8 }),
      para(value || '—', { bold: true, size: 10.5, after: extra ? 0 : 100 }),
      ...(extra ? [para(extra, { color: GRAY, size: 9, after: 100 })] : []),
    ];
    const holderDoc = a.account_holder_document ? `C.C. ${a.account_holder_document}` : '';
    children.push(
      noBorderTable(
        [payCell('ENTIDAD FINANCIERA', a.bank_name), payCell('TIPO DE CUENTA', a.account_type)],
        [50, 50],
      ),
    );
    children.push(
      noBorderTable(
        [payCell('NÚMERO DE CUENTA', a.account_number), payCell('TITULAR', a.account_holder, holderDoc)],
        [50, 50],
      ),
    );
  }

  children.push(para(DECLARATION_TEXT, { color: GRAY, size: 7.5, before: 160, after: 60 }));
  children.push(para(NOT_INVOICE_TEXT, { color: GRAY, size: 7.5 }));

  const detail = signatureDetailLines(a);
  children.push(
    ...(await signatureParagraphs('Atentamente,', { text: a.contractor_name, bold: true }, [detail.document, detail.contact])),
  );

  // ---------- Página 2: carta ----------
  if (a.no_withholding_letter) {
    const cert = buildCertificateText(a);
    // Salto de página antes de la carta.
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        spacing: { after: 240 },
        children: [run(cert.dateLine, { size: 10 })],
      }),
    );
    cert.addressee.forEach((line, i) => children.push(para(line, { bold: i < 2, size: 10 })));
    children.push(para(cert.ref, { bold: true, size: 10, before: 240, after: 240 }));
    children.push(para(cert.title, { bold: true, size: 10, align: AlignmentType.CENTER, after: 200 }));
    cert.paragraphs.forEach((text) =>
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160 },
          children: parseBold(text).map((s) => run(s.text, { bold: s.bold, size: 10 })),
        }),
      ),
    );
    children.push(
      ...(await signatureParagraphs(cert.closing, { text: cert.signerName, bold: true }, [cert.signerDocument])),
    );
  }

  const doc = new Document({
    title: `Cuenta de cobro ${formatNumber(a.number)}`,
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1000, bottom: 900, left: 1160, right: 1240 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

export async function downloadPaymentAccountDocx(
  account: PaymentAccountDoc,
  options: { withSignature?: boolean } = {},
): Promise<void> {
  const blob = await buildPaymentAccountDocx(account, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = paymentAccountFileName(account.number, 'docx');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
