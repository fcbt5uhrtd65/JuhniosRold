import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Fingerprint,
  Pencil,
  Plus,
  RotateCw,
  Save,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  ActionsMenu,
  Badge,
  type BadgeColor,
  Card,
  EmptyState,
  KpiCard,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchBarAdmin,
  SecondaryButton,
  TabBar,
  inputCls,
  selectCls,
} from './AdminUI';
import { Pagination } from './Pagination';
import {
  applyWorkScheduleTemplate,
  approvePayrollPeriod,
  calculatePayrollPeriod,
  correctAttendance,
  createBiometricDevice,
  createEmployeeBiometricId,
  createPayrollLegalParameter,
  createPayrollPeriod,
  createWorkScheduleTemplate,
  deleteEmployeeBiometricId,
  generateYearHolidays,
  getAttendanceIntelligenceSettings,
  getBiometricDevices,
  getEmployeeBiometricIds,
  getEmployeeWorkSchedules,
  getPayrollLegalParameters,
  getPayrollPeriods,
  getPendingCorrectionAttendance,
  getPublicHolidays,
  getWorkScheduleTemplates,
  markPayrollPeriodPaid,
  setEmployeeWorkSchedule,
  updateAttendanceIntelligenceSettings,
  updatePayrollLegalParameter,
  updateWorkScheduleTemplate,
  uploadBiometricFile,
  type Attendance,
  type AttendanceIntelligenceSettings,
  type BiometricDevice,
  type EmployeeBiometricId,
  type EmployeeWorkSchedule,
  type PayrollLegalParameter,
  type PayrollPeriod,
  type PayrollPeriodStatus,
  type PublicHoliday,
  type WorkScheduleTemplate,
} from '../../services/human-resources.service';
import { getEmployees, type Employee } from '../../services/employees.service';
import { isAbortError } from '../../services/api';

type PayrollSection = 'periods' | 'schedules' | 'biometric' | 'holidays';

const PAYROLL_SECTIONS: Array<{ id: PayrollSection; label: string; icon: typeof Banknote }> = [
  { id: 'periods', label: 'Períodos de nómina', icon: Banknote },
  { id: 'schedules', label: 'Horarios', icon: Clock3 },
  { id: 'biometric', label: 'Biométrico', icon: Fingerprint },
  { id: 'holidays', label: 'Festivos y parámetros', icon: CalendarDays },
];

const BIOMETRIC_MAPPING_PAGE_SIZE = 6;

const PERIOD_STATUS_LABELS: Record<PayrollPeriodStatus, string> = {
  OPEN: 'Abierto',
  CALCULATED: 'Calculado',
  APPROVED: 'Aprobado',
  PAID: 'Pagado',
  CLOSED: 'Cerrado',
};

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function periodStatusColor(status: PayrollPeriodStatus): BadgeColor {
  if (status === 'PAID' || status === 'CLOSED') return 'green';
  if (status === 'APPROVED') return 'blue';
  if (status === 'CALCULATED') return 'yellow';
  return 'gray';
}

function formatMoney(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  return num.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-CO');
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CO');
}

function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function addDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateToIsoLocal(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function nextMondayOnOrAfter(value: Date): Date {
  const date = new Date(value);
  const weekday = date.getDay();
  const offset = weekday === 1 ? 0 : (8 - weekday) % 7;
  date.setDate(date.getDate() + offset);
  return date;
}

function addCalendarDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function generatedColombianHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  const fixedNoMove: Array<[string, Date]> = [
    ['Año Nuevo', new Date(year, 0, 1)],
    ['Día del Trabajo', new Date(year, 4, 1)],
    ['Independencia de Colombia', new Date(year, 6, 20)],
    ['Batalla de Boyacá', new Date(year, 7, 7)],
    ['Inmaculada Concepción', new Date(year, 11, 8)],
    ['Navidad', new Date(year, 11, 25)],
  ];
  const fixedMoved: Array<[string, Date]> = [
    ['Reyes Magos', new Date(year, 0, 6)],
    ['San José', new Date(year, 2, 19)],
    ['San Pedro y San Pablo', new Date(year, 5, 29)],
    ['Asunción de la Virgen', new Date(year, 7, 15)],
    ['Día de la Raza', new Date(year, 9, 12)],
    ['Todos los Santos', new Date(year, 10, 1)],
    ['Independencia de Cartagena', new Date(year, 10, 11)],
  ];
  const easterNoMove: Array<[string, Date]> = [
    ['Jueves Santo', addCalendarDays(easter, -3)],
    ['Viernes Santo', addCalendarDays(easter, -2)],
  ];
  const easterMoved: Array<[string, Date]> = [
    ['Ascensión del Señor', addCalendarDays(easter, 39)],
    ['Corpus Christi', addCalendarDays(easter, 60)],
    ['Sagrado Corazón de Jesús', addCalendarDays(easter, 68)],
  ];

  const holidayRows: PublicHoliday[] = [];
  fixedNoMove.forEach(([name, civilDate]) => {
    holidayRows.push({
      id: `generated-${year}-${dateToIsoLocal(civilDate)}`,
      year,
      name,
      kind: 'FIXED',
      civil_date: dateToIsoLocal(civilDate),
      original_date: null,
      is_active: true,
      notes: 'Calculado automaticamente para vista previa',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    });
  });
  fixedMoved.forEach(([name, originalDate]) => {
    const civilDate = nextMondayOnOrAfter(originalDate);
    holidayRows.push({
      id: `generated-${year}-${dateToIsoLocal(civilDate)}`,
      year,
      name,
      kind: 'FIXED_MOVED_TO_MONDAY',
      civil_date: dateToIsoLocal(civilDate),
      original_date: dateToIsoLocal(civilDate) === dateToIsoLocal(originalDate) ? null : dateToIsoLocal(originalDate),
      is_active: true,
      notes: 'Calculado automaticamente para vista previa',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    });
  });
  easterNoMove.forEach(([name, civilDate]) => {
    holidayRows.push({
      id: `generated-${year}-${dateToIsoLocal(civilDate)}`,
      year,
      name,
      kind: 'EASTER_BASED',
      civil_date: dateToIsoLocal(civilDate),
      original_date: null,
      is_active: true,
      notes: 'Calculado automaticamente para vista previa',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    });
  });
  easterMoved.forEach(([name, originalDate]) => {
    const civilDate = nextMondayOnOrAfter(originalDate);
    holidayRows.push({
      id: `generated-${year}-${dateToIsoLocal(civilDate)}`,
      year,
      name,
      kind: 'EASTER_BASED',
      civil_date: dateToIsoLocal(civilDate),
      original_date: dateToIsoLocal(civilDate) === dateToIsoLocal(originalDate) ? null : dateToIsoLocal(originalDate),
      is_active: true,
      notes: 'Calculado automaticamente para vista previa',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    });
  });

  return holidayRows.sort((left, right) => left.civil_date.localeCompare(right.civil_date));
}

function enumerateDates(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  let current = start;
  while (current <= end) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

function formatMonthTitle(monthKey: string): string {
  return parseLocalDate(`${monthKey}-01`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function groupDatesByMonth(dates: string[]): Array<{ key: string; title: string; cells: Array<string | null> }> {
  const grouped = new Map<string, string[]>();
  dates.forEach((date) => {
    const key = date.slice(0, 7);
    const items = grouped.get(key) ?? [];
    items.push(date);
    grouped.set(key, items);
  });
  return [...grouped.entries()].map(([key, monthDates]) => ({
    key,
    title: formatMonthTitle(key),
    cells: [
      ...Array.from({ length: mondayWeekdayIndex(monthDates[0]) }, () => null as string | null),
      ...monthDates,
    ],
  }));
}

function mondayWeekdayIndex(value: string): number {
  const day = parseLocalDate(value).getDay();
  return day === 0 ? 6 : day - 1;
}

function isWeekendDate(value: string): boolean {
  const day = parseLocalDate(value).getDay();
  return day === 0 || day === 6;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type XlsxCellValue = string | number | null | undefined;

type XlsxCell = {
  value: XlsxCellValue;
  style?: number;
};

type XlsxSheet = {
  name: string;
  rows: XlsxCell[][];
  widths?: number[];
};

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function xlsxCell(value: XlsxCellValue, style = 0): XlsxCell {
  return { value, style };
}

const XLSX_STYLE = {
  title: 4,
  darkHeader: 5,
  tableHeader: 2,
  total: 3,
  softHeader: 6,
  warning: 7,
};

function xmlEscape(value: XlsxCellValue): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sheetNameEscape(value: string): string {
  return xmlEscape(value.replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Hoja');
}

function uniqueSheetName(base: string, used: Set<string>): string {
  const clean = base.replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Hoja';
  let candidate = clean.slice(0, 31);
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${index}`;
    candidate = clean.slice(0, 31 - suffix.length) + suffix;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function xlsxColumnName(index: number): string {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const modulo = (value - 1) % 26;
    label = String.fromCharCode(65 + modulo) + label;
    value = Math.floor((value - modulo) / 26);
  }
  return label;
}

function buildWorksheetXml(sheet: XlsxSheet): string {
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      if (cell.value === null || cell.value === undefined || cell.value === '') return '';
      const reference = `${xlsxColumnName(columnIndex)}${rowIndex + 1}`;
      const style = cell.style ? ` s="${cell.style}"` : '';
      if (typeof cell.value === 'number' && Number.isFinite(cell.value)) {
        return `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
      }
      return `<c r="${reference}" t="inlineStr"${style}><is><t>${xmlEscape(cell.value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${cols}
  <sheetData>${rows}</sheetData>
</worksheet>`;
}

function buildWorkbookXml(sheets: XlsxSheet[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets.map((sheet, index) => `<sheet name="${sheetNameEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}
  </sheets>
</workbook>`;
}

function buildWorkbookRelsXml(sheets: XlsxSheet[]): string {
  const worksheetRels = sheets
    .map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildContentTypesXml(sheets: XlsxSheet[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF92400E"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF4F1"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2A4038"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F3EE"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date = new Date()): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function pushUint16(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUint32(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function createZip(entries: Array<{ path: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const timestamp = dosTimestamp();
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.path);
    const contentBytes = encoder.encode(entry.content);
    const checksum = crc32(contentBytes);
    const localHeader: number[] = [];
    pushUint32(localHeader, 0x04034b50);
    pushUint16(localHeader, 20);
    pushUint16(localHeader, 0x0800);
    pushUint16(localHeader, 0);
    pushUint16(localHeader, timestamp.time);
    pushUint16(localHeader, timestamp.date);
    pushUint32(localHeader, checksum);
    pushUint32(localHeader, contentBytes.length);
    pushUint32(localHeader, contentBytes.length);
    pushUint16(localHeader, nameBytes.length);
    pushUint16(localHeader, 0);
    const localBytes = new Uint8Array([...localHeader, ...nameBytes]);
    parts.push(localBytes, contentBytes);

    const centralHeader: number[] = [];
    pushUint32(centralHeader, 0x02014b50);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 20);
    pushUint16(centralHeader, 0x0800);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, timestamp.time);
    pushUint16(centralHeader, timestamp.date);
    pushUint32(centralHeader, checksum);
    pushUint32(centralHeader, contentBytes.length);
    pushUint32(centralHeader, contentBytes.length);
    pushUint16(centralHeader, nameBytes.length);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint16(centralHeader, 0);
    pushUint32(centralHeader, 0);
    pushUint32(centralHeader, offset);
    centralParts.push(new Uint8Array([...centralHeader, ...nameBytes]));
    offset += localBytes.length + contentBytes.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const centralOffset = offset;
  const endHeader: number[] = [];
  pushUint32(endHeader, 0x06054b50);
  pushUint16(endHeader, 0);
  pushUint16(endHeader, 0);
  pushUint16(endHeader, entries.length);
  pushUint16(endHeader, entries.length);
  pushUint32(endHeader, centralDirectory.length);
  pushUint32(endHeader, centralOffset);
  pushUint16(endHeader, 0);
  return concatBytes([...parts, centralDirectory, new Uint8Array(endHeader)]);
}

function createXlsxBlob(sheets: XlsxSheet[]): Blob {
  const entries = [
    { path: '[Content_Types].xml', content: buildContentTypesXml(sheets) },
    { path: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { path: 'xl/workbook.xml', content: buildWorkbookXml(sheets) },
    { path: 'xl/_rels/workbook.xml.rels', content: buildWorkbookRelsXml(sheets) },
    { path: 'xl/styles.xml', content: buildStylesXml() },
    ...sheets.map((sheet, index) => ({ path: `xl/worksheets/sheet${index + 1}.xml`, content: buildWorksheetXml(sheet) })),
  ];
  return new Blob([createZip(entries)], { type: XLSX_MIME });
}

function useEmployeeDirectory() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getEmployees({ limit: 500 });
        setEmployees(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  return { employees, employeeById, loading };
}

function employeeName(employee: Employee | undefined): string {
  if (!employee) return 'Empleado desconocido';
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

function biometricCodeDisplayName(code: string, employeeByBiometricCode: Map<string, Employee>): string {
  const employee = employeeByBiometricCode.get(code);
  return employee ? employeeName(employee) : `Codigo ${code}`;
}

function describeApiError(error: unknown, fallback: string): string {
  if (isAbortError(error)) {
    return 'La operación está tardando más de lo esperado. Espera un momento y vuelve a intentarlo; si el archivo es muy grande, prueba dividirlo.';
  }
  return error instanceof Error ? error.message : fallback;
}

type BiometricPreviewPunch = {
  time: string;
  action: 'check_in' | 'break_start' | 'break_end' | 'check_out' | null;
};

type BiometricPreviewRow = {
  key: string;
  code: string;
  date: string;
  markCount: number;
  rawMarkCount: number;
  ignoredMarkCount: number;
  checkIn: string;
  breakStart: string;
  breakEnd: string;
  checkOut: string;
  workedHours: number;
  dayHours: number;
  nightHours: number;
  status: 'Completo' | 'Incompleto' | 'Revisar';
  analysis: string;
  marks: string;
};

type SavedBiometricAnalysis = {
  id: string;
  name: string;
  fileName: string;
  dateFrom: string;
  dateTo: string;
  parsed: number;
  rows: BiometricPreviewRow[];
  createdAt: string;
  updatedAt: string;
};

const BIOMETRIC_ANALYSES_STORAGE_KEY = 'juhnios.biometric.savedAnalyses.v1';

function loadSavedBiometricAnalyses(): SavedBiometricAnalysis[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BIOMETRIC_ANALYSES_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.name && Array.isArray(item?.rows)) : [];
  } catch {
    return [];
  }
}

function persistSavedBiometricAnalyses(items: SavedBiometricAnalysis[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BIOMETRIC_ANALYSES_STORAGE_KEY, JSON.stringify(items));
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function parseBiometricTimestamp(raw: string): { date: string; time: string } | null {
  const text = raw.trim();
  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match;
    return {
      date: `${year}-${twoDigits(Number(month))}-${twoDigits(Number(day))}`,
      time: `${twoDigits(Number(hour))}:${twoDigits(Number(minute))}:${twoDigits(Number(second))}`,
    };
  }
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second = '00'] = match;
  return {
    date: `${year}-${twoDigits(Number(month))}-${twoDigits(Number(day))}`,
    time: `${twoDigits(Number(hour))}:${twoDigits(Number(minute))}:${twoDigits(Number(second))}`,
  };
}

function punchActionFromColumns(columns: string[]): BiometricPreviewPunch['action'] {
  const normalized = columns.join(' ').trim().toLowerCase();
  if (!normalized) return null;
  if (/\b(check[_ -]?in|entrada|ingreso)\b/.test(normalized)) return 'check_in';
  if (/\b(check[_ -]?out|salida)\b/.test(normalized)) return 'check_out';
  if (/\b(break[_ -]?start|inicio almuerzo|inicio descanso)\b/.test(normalized)) return 'break_start';
  if (/\b(break[_ -]?end|fin almuerzo|fin descanso)\b/.test(normalized)) return 'break_end';
  const nonEmptyNumeric = columns.map((item) => item.trim()).filter(Boolean);
  if (nonEmptyNumeric.length === 1) {
    if (nonEmptyNumeric[0] === '1') return 'check_in';
    if (nonEmptyNumeric[0] === '2') return 'check_out';
    if (nonEmptyNumeric[0] === '3') return 'break_start';
    if (nonEmptyNumeric[0] === '4') return 'break_end';
  }
  return null;
}

function parseBiometricLine(line: string): { code: string; date: string; time: string; action: BiometricPreviewPunch['action'] } | null {
  const stripped = line.trim();
  if (!stripped) return null;
  const tabColumns = stripped.split('\t').map((item) => item.trim());
  if (tabColumns.length >= 2) {
    let timestampRaw = tabColumns[1];
    let rest = tabColumns.slice(2);
    if (rest[0] && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(rest[0])) {
      timestampRaw = `${timestampRaw} ${rest[0]}`;
      rest = rest.slice(1);
    }
    const timestamp = parseBiometricTimestamp(timestampRaw);
    if (timestamp && tabColumns[0]) {
      return { code: tabColumns[0], ...timestamp, action: punchActionFromColumns(rest) };
    }
  }

  const match = stripped.match(/^(\S+)\s+(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?)(?:\s+(.*))?$/);
  if (!match) return null;
  const [, code, datePart, timePart, rest = ''] = match;
  const timestamp = parseBiometricTimestamp(`${datePart} ${timePart}`);
  if (!timestamp) return null;
  return { code, ...timestamp, action: punchActionFromColumns(rest.split(/\s+/)) };
}

function firstActionTime(punches: BiometricPreviewPunch[], action: BiometricPreviewPunch['action']): string {
  return punches.find((punch) => punch.action === action)?.time ?? '-';
}

function lastActionTime(punches: BiometricPreviewPunch[], action: BiometricPreviewPunch['action']): string {
  return [...punches].reverse().find((punch) => punch.action === action)?.time ?? '-';
}

function timeToMinutes(value: string): number | null {
  if (!value || value === '-') return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizePreviewTime(value: string): string {
  if (!value) return '-';
  const [hours = '00', minutes = '00'] = value.split(':');
  return `${twoDigits(Number(hours))}:${twoDigits(Number(minutes))}:00`;
}

function dayMinutesInSegment(start: number, end: number): number {
  const normalizedEnd = end >= start ? end : end + 1440;
  let total = 0;
  const firstDay = Math.floor(start / 1440);
  const lastDay = Math.floor(Math.max(start, normalizedEnd - 1) / 1440);
  for (let day = firstDay; day <= lastDay; day += 1) {
    const dayStart = day * 1440 + 360;
    const dayEnd = day * 1440 + 1140;
    total += Math.max(0, Math.min(normalizedEnd, dayEnd) - Math.max(start, dayStart));
  }
  return total;
}

function calculatePreviewHours(row: Pick<BiometricPreviewRow, 'checkIn' | 'breakStart' | 'breakEnd' | 'checkOut'>) {
  const checkIn = timeToMinutes(row.checkIn);
  const checkOutRaw = timeToMinutes(row.checkOut);
  if (checkIn === null || checkOutRaw === null) {
    return { workedHours: 0, dayHours: 0, nightHours: 0 };
  }
  const checkOut = checkOutRaw >= checkIn ? checkOutRaw : checkOutRaw + 1440;
  const breakStartRaw = timeToMinutes(row.breakStart);
  const breakEndRaw = timeToMinutes(row.breakEnd);
  const segments: Array<[number, number]> = [];

  if (breakStartRaw !== null && breakEndRaw !== null) {
    const breakStart = breakStartRaw >= checkIn ? breakStartRaw : breakStartRaw + 1440;
    const breakEnd = breakEndRaw >= breakStartRaw ? breakEndRaw : breakEndRaw + 1440;
    if (checkIn < breakStart && breakStart < breakEnd && breakEnd < checkOut) {
      segments.push([checkIn, breakStart], [breakEnd, checkOut]);
    } else {
      segments.push([checkIn, checkOut]);
    }
  } else {
    segments.push([checkIn, checkOut]);
  }

  const workedMinutes = segments.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
  const dayMinutes = segments.reduce((sum, [start, end]) => sum + dayMinutesInSegment(start, end), 0);
  return {
    workedHours: Number((workedMinutes / 60).toFixed(2)),
    dayHours: Number((dayMinutes / 60).toFixed(2)),
    nightHours: Number(((workedMinutes - dayMinutes) / 60).toFixed(2)),
  };
}

function enrichPreviewRow(row: Omit<BiometricPreviewRow, 'workedHours' | 'dayHours' | 'nightHours'>): BiometricPreviewRow {
  return { ...row, ...calculatePreviewHours(row) };
}

function chooseLunchPair(punches: BiometricPreviewPunch[]): [BiometricPreviewPunch, BiometricPreviewPunch] | null {
  const candidates = punches
    .slice(1, -1)
    .map((punch) => ({ punch, minutes: timeToMinutes(punch.time) }))
    .filter((item): item is { punch: BiometricPreviewPunch; minutes: number } => item.minutes !== null);
  let best: { pair: [BiometricPreviewPunch, BiometricPreviewPunch]; score: number } | null = null;

  for (let index = 0; index < candidates.length - 1; index += 1) {
    for (let nextIndex = index + 1; nextIndex < candidates.length; nextIndex += 1) {
      const start = candidates[index];
      const end = candidates[nextIndex];
      const duration = end.minutes - start.minutes;
      const startsNearLunch = start.minutes >= 10 * 60 && start.minutes <= 15 * 60 + 30;
      const reasonableDuration = duration >= 20 && duration <= 180;
      if (!startsNearLunch || !reasonableDuration) continue;
      const center = (start.minutes + end.minutes) / 2;
      const score = Math.abs(center - 13 * 60) + Math.abs(duration - 60) * 0.8;
      if (!best || score < best.score) best = { pair: [start.punch, end.punch], score };
    }
  }

  return best?.pair ?? null;
}

function classifyPreviewPunches(punches: BiometricPreviewPunch[], rawMarkCount: number): Omit<BiometricPreviewRow, 'key' | 'code' | 'date' | 'workedHours' | 'dayHours' | 'nightHours'> {
  const sortedPunches = [...punches].sort((left, right) => left.time.localeCompare(right.time));
  const analysis: string[] = [];
  const ignoredMarkCount = 0;
  if (rawMarkCount > 4) analysis.push(`${rawMarkCount} timbradas en el dia; revisar antes de liquidar`);

  const hasActions = sortedPunches.some((punch) => punch.action);
  let checkIn = '-';
  let checkOut = '-';
  let breakStart = '-';
  let breakEnd = '-';
  let status: BiometricPreviewRow['status'] = 'Revisar';

  if (hasActions) {
    checkIn = firstActionTime(sortedPunches, 'check_in');
    checkOut = lastActionTime(sortedPunches, 'check_out');
    breakStart = firstActionTime(sortedPunches, 'break_start');
    breakEnd = lastActionTime(sortedPunches, 'break_end');
    status = checkIn !== '-' && checkOut !== '-' ? 'Completo' : 'Incompleto';
    if (status === 'Incompleto') analysis.push('El reloj envio acciones, pero falta entrada o salida');
    if (rawMarkCount !== 2 && rawMarkCount !== 4) {
      status = 'Revisar';
      if (rawMarkCount <= 4) analysis.push(`${rawMarkCount} timbrada(s); revisar secuencia del dia`);
    }
  } else if (sortedPunches.length === 0) {
    analysis.push('Sin marcas utiles');
    status = 'Incompleto';
  } else if (sortedPunches.length === 1) {
    checkIn = sortedPunches[0].time;
    status = 'Incompleto';
    analysis.push('1 timbrada; falta entrada o salida');
  } else {
    checkIn = sortedPunches[0].time;
    checkOut = sortedPunches[sortedPunches.length - 1].time;

    if (sortedPunches.length === 2) {
      status = 'Completo';
    } else if (sortedPunches.length === 3) {
      const middle = sortedPunches[1];
      const middleMinutes = timeToMinutes(middle.time);
      if (middleMinutes !== null && middleMinutes >= 10 * 60 && middleMinutes <= 15 * 60 + 30) {
        breakStart = middle.time;
        analysis.push('3 timbradas; hay una sola marca de almuerzo');
      } else {
        analysis.push('3 timbradas; la marca intermedia debe revisarse');
      }
      status = 'Revisar';
    } else if (sortedPunches.length === 4) {
      breakStart = sortedPunches[1].time;
      breakEnd = sortedPunches[2].time;
      status = 'Completo';
    } else {
      const lunchPair = chooseLunchPair(sortedPunches);
      if (lunchPair) {
        breakStart = lunchPair[0].time;
        breakEnd = lunchPair[1].time;
        status = 'Revisar';
        analysis.push('Se sugiere entrada, almuerzo y salida, pero sobran timbradas');
      } else {
        status = 'Revisar';
        analysis.push('No hay par claro de almuerzo; se sugiere primera entrada y ultima salida');
      }
    }
  }

  return {
    markCount: sortedPunches.length,
    rawMarkCount,
    ignoredMarkCount,
    checkIn,
    breakStart,
    breakEnd,
    checkOut,
    status,
    analysis: analysis.join('. '),
    marks: sortedPunches.map((punch) => punch.time).join(', '),
  };
}

function buildBiometricPreviewRows(
  groups: Map<string, { code: string; date: string; punches: BiometricPreviewPunch[] }>,
): BiometricPreviewRow[] {
  return [...groups.values()]
    .map((group) => {
      const punches = [...group.punches].sort((left, right) => left.time.localeCompare(right.time));
      const rawMarkCount = punches.length;
      const classification = classifyPreviewPunches(punches, rawMarkCount);

      return enrichPreviewRow({
        key: `${group.code}-${group.date}`,
        code: group.code,
        date: group.date,
        ...classification,
      });
    })
    .sort((left, right) => left.code.localeCompare(right.code, 'es', { numeric: true }) || left.date.localeCompare(right.date));
}

function biometricExportDateRange(rows: BiometricPreviewRow[], dateRange?: string[]): string[] {
  if (dateRange && dateRange.length > 0) return dateRange;
  return [...new Set(rows.map((row) => row.date))].sort();
}

function biometricObservation(row: BiometricPreviewRow | undefined, holiday: PublicHoliday | undefined, weekend: boolean): string {
  if (row) return 'Con marcacion';
  if (holiday) return 'Festivo sin marca';
  if (weekend) return 'Descanso sin marca';
  return 'Falto sin marca';
}

function biometricStatus(row: BiometricPreviewRow | undefined, holiday: PublicHoliday | undefined, weekend: boolean): string {
  if (row) return row.status;
  if (holiday) return 'Festivo';
  if (weekend) return 'Descanso';
  return 'Falto';
}

function previewDurationLabel(row: BiometricPreviewRow | undefined): string {
  if (!row) return '';
  const checkIn = timeToMinutes(row.checkIn);
  const checkOutRaw = timeToMinutes(row.checkOut);
  if (checkIn === null || checkOutRaw === null) return '';
  const checkOut = checkOutRaw >= checkIn ? checkOutRaw : checkOutRaw + 1440;
  const minutes = Math.max(0, checkOut - checkIn);
  return `${Math.floor(minutes / 60)}:${twoDigits(minutes % 60)}:00`;
}

type BiometricPayrollBreakdown = {
  rawHours: number;
  ordinaryHours: number;
  lunchHours: number;
  extraDayHours: number;
  extraNightHours: number;
  nightSurchargeHours: number;
  sundayDayHours: number;
  sundayExtraDayHours: number;
  sundayNightHours: number;
  sundayExtraNightHours: number;
};

function minutesToHours(value: number): number {
  return Number((Math.max(0, value) / 60).toFixed(2));
}

function expectedOrdinaryMinutesForPreview(date: string, holiday: PublicHoliday | undefined): number {
  void holiday;
  const weekday = mondayWeekdayIndex(date);
  if (weekday >= 5) return 0;
  return weekday === 4 ? 8 * 60 : 9 * 60;
}

function isNightMinute(minute: number): boolean {
  const normalized = ((minute % 1440) + 1440) % 1440;
  return normalized < 6 * 60 || normalized >= 19 * 60;
}

function splitDayNightMinutes(segments: Array<[number, number]>): { day: number; night: number } {
  let day = 0;
  let night = 0;
  for (const [start, end] of segments) {
    for (let minute = start; minute < end; minute += 1) {
      if (isNightMinute(minute)) night += 1;
      else day += 1;
    }
  }
  return { day, night };
}

function takeMinutesFromSegments(segments: Array<[number, number]>, minutes: number): Array<[number, number]> {
  const taken: Array<[number, number]> = [];
  let remaining = Math.max(0, minutes);
  for (const [start, end] of segments) {
    if (remaining <= 0) break;
    const length = Math.max(0, end - start);
    const used = Math.min(length, remaining);
    if (used > 0) taken.push([start, start + used]);
    remaining -= used;
  }
  return taken;
}

function skipMinutesFromSegments(segments: Array<[number, number]>, minutes: number): Array<[number, number]> {
  const kept: Array<[number, number]> = [];
  let remaining = Math.max(0, minutes);
  for (const [start, end] of segments) {
    const length = Math.max(0, end - start);
    if (remaining >= length) {
      remaining -= length;
      continue;
    }
    kept.push([start + remaining, end]);
    remaining = 0;
  }
  return kept;
}

function biometricPayrollBreakdown(row: BiometricPreviewRow | undefined, holiday: PublicHoliday | undefined): BiometricPayrollBreakdown {
  if (!row) {
    return {
      rawHours: 0,
      ordinaryHours: 0,
      lunchHours: 0,
      extraDayHours: 0,
      extraNightHours: 0,
      nightSurchargeHours: 0,
      sundayDayHours: 0,
      sundayExtraDayHours: 0,
      sundayNightHours: 0,
      sundayExtraNightHours: 0,
    };
  }

  const checkIn = timeToMinutes(row.checkIn);
  const checkOutRaw = timeToMinutes(row.checkOut);
  if (checkIn === null || checkOutRaw === null) {
    return {
      rawHours: 0,
      ordinaryHours: 0,
      lunchHours: 0,
      extraDayHours: 0,
      extraNightHours: 0,
      nightSurchargeHours: 0,
      sundayDayHours: 0,
      sundayExtraDayHours: 0,
      sundayNightHours: 0,
      sundayExtraNightHours: 0,
    };
  }

  const checkOut = checkOutRaw >= checkIn ? checkOutRaw : checkOutRaw + 1440;
  const rawMinutes = Math.max(0, checkOut - checkIn);
  const breakStartRaw = timeToMinutes(row.breakStart);
  const breakEndRaw = timeToMinutes(row.breakEnd);
  const hasFullBreak = breakStartRaw !== null && breakEndRaw !== null;
  const breakStart = breakStartRaw !== null && breakStartRaw < checkIn ? breakStartRaw + 1440 : breakStartRaw;
  const breakEnd = breakEndRaw !== null && breakStartRaw !== null && breakEndRaw < breakStartRaw ? breakEndRaw + 1440 : breakEndRaw;
  const fallbackLunchMinutes = !hasFullBreak && rawMinutes >= 6 * 60 && expectedOrdinaryMinutesForPreview(row.date, holiday) > 0 ? 60 : 0;
  let lunchMinutes = fallbackLunchMinutes;
  let segments: Array<[number, number]> = [[checkIn, checkOut]];

  if (breakStart !== null && breakEnd !== null && checkIn < breakStart && breakStart < breakEnd && breakEnd < checkOut) {
    lunchMinutes = Math.max(0, breakEnd - breakStart);
    segments = [[checkIn, breakStart], [breakEnd, checkOut]];
  } else if (fallbackLunchMinutes > 0) {
    const lunchStart = Math.min(checkIn + 5 * 60, Math.max(checkIn, checkOut - fallbackLunchMinutes));
    const lunchEnd = Math.min(checkOut, lunchStart + fallbackLunchMinutes);
    segments = [[checkIn, lunchStart], [lunchEnd, checkOut]].filter(([start, end]) => end > start);
  }

  const expectedOrdinary = expectedOrdinaryMinutesForPreview(row.date, holiday);
  const totalWorkedMinutes = segments.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
  const ordinaryMinutes = Math.min(totalWorkedMinutes, expectedOrdinary);
  const extraMinutes = Math.max(0, totalWorkedMinutes - ordinaryMinutes);
  const ordinarySegments = takeMinutesFromSegments(segments, ordinaryMinutes);
  const extraSegments = skipMinutesFromSegments(segments, ordinaryMinutes);
  const ordinarySplit = splitDayNightMinutes(ordinarySegments);
  const extraSplit = splitDayNightMinutes(extraSegments);
  const sundayOrHoliday = Boolean(holiday) || mondayWeekdayIndex(row.date) === 6;

  if (sundayOrHoliday) {
    return {
      rawHours: Math.floor(rawMinutes / 60),
      ordinaryHours: 0,
      lunchHours: minutesToHours(lunchMinutes),
      extraDayHours: 0,
      extraNightHours: 0,
      nightSurchargeHours: 0,
      sundayDayHours: minutesToHours(ordinarySplit.day),
      sundayExtraDayHours: minutesToHours(extraSplit.day),
      sundayNightHours: minutesToHours(ordinarySplit.night),
      sundayExtraNightHours: minutesToHours(extraSplit.night),
    };
  }

  return {
    rawHours: Math.floor(rawMinutes / 60),
    ordinaryHours: minutesToHours(ordinarySplit.day),
    lunchHours: minutesToHours(lunchMinutes),
    extraDayHours: minutesToHours(extraSplit.day),
    extraNightHours: minutesToHours(extraSplit.night),
    nightSurchargeHours: minutesToHours(ordinarySplit.night),
    sundayDayHours: 0,
    sundayExtraDayHours: 0,
    sundayNightHours: 0,
    sundayExtraNightHours: 0,
  };
}

function addBiometricPayrollBreakdown(left: BiometricPayrollBreakdown, right: BiometricPayrollBreakdown): BiometricPayrollBreakdown {
  return {
    rawHours: Number((left.rawHours + right.rawHours).toFixed(2)),
    ordinaryHours: Number((left.ordinaryHours + right.ordinaryHours).toFixed(2)),
    lunchHours: Number((left.lunchHours + right.lunchHours).toFixed(2)),
    extraDayHours: Number((left.extraDayHours + right.extraDayHours).toFixed(2)),
    extraNightHours: Number((left.extraNightHours + right.extraNightHours).toFixed(2)),
    nightSurchargeHours: Number((left.nightSurchargeHours + right.nightSurchargeHours).toFixed(2)),
    sundayDayHours: Number((left.sundayDayHours + right.sundayDayHours).toFixed(2)),
    sundayExtraDayHours: Number((left.sundayExtraDayHours + right.sundayExtraDayHours).toFixed(2)),
    sundayNightHours: Number((left.sundayNightHours + right.sundayNightHours).toFixed(2)),
    sundayExtraNightHours: Number((left.sundayExtraNightHours + right.sundayExtraNightHours).toFixed(2)),
  };
}

function emptyBiometricPayrollBreakdown(): BiometricPayrollBreakdown {
  return {
    rawHours: 0,
    ordinaryHours: 0,
    lunchHours: 0,
    extraDayHours: 0,
    extraNightHours: 0,
    nightSurchargeHours: 0,
    sundayDayHours: 0,
    sundayExtraDayHours: 0,
    sundayNightHours: 0,
    sundayExtraNightHours: 0,
  };
}

function buildBiometricCodeDayRows(
  code: string,
  rows: BiometricPreviewRow[],
  holidaysByDate: Map<string, PublicHoliday>,
  dateRange: string[],
): XlsxCell[][] {
  const rowsByDate = new Map(rows.map((row) => [row.date, row]));
  return dateRange.map((date) => {
    const row = rowsByDate.get(date);
    const holiday = holidaysByDate.get(date);
    const weekend = isWeekendDate(date);
    const breakdown = biometricPayrollBreakdown(row, holiday);
    const rowStyle = row?.status === 'Revisar' || row?.status === 'Incompleto' ? XLSX_STYLE.warning : 3;
    return [
      xlsxCell(row ? code : ''),
      xlsxCell(formatDate(date)),
      xlsxCell(WEEKDAY_LABELS[mondayWeekdayIndex(date)]),
      xlsxCell(row?.checkIn === '-' ? '' : row?.checkIn ?? ''),
      xlsxCell(row?.checkOut === '-' ? '' : row?.checkOut ?? ''),
      xlsxCell(previewDurationLabel(row)),
      xlsxCell(breakdown.rawHours),
      xlsxCell(breakdown.ordinaryHours),
      xlsxCell(row?.breakStart === '-' ? '' : row?.breakStart ?? ''),
      xlsxCell(row?.breakEnd === '-' ? '' : row?.breakEnd ?? ''),
      xlsxCell(breakdown.lunchHours || ''),
      xlsxCell(breakdown.extraDayHours || 0),
      xlsxCell(breakdown.extraNightHours || 0),
      xlsxCell(breakdown.nightSurchargeHours || 0),
      xlsxCell(breakdown.sundayDayHours || 0),
      xlsxCell(breakdown.sundayExtraDayHours || 0),
      xlsxCell(breakdown.sundayNightHours || 0),
      xlsxCell(breakdown.sundayExtraNightHours || 0),
      xlsxCell(0),
      xlsxCell(breakdown.ordinaryHours),
      xlsxCell(holiday?.name ?? ''),
      xlsxCell(biometricStatus(row, holiday, weekend)),
      xlsxCell(biometricObservation(row, holiday, weekend)),
      xlsxCell(row?.analysis ?? ''),
      xlsxCell(row?.rawMarkCount ?? ''),
      xlsxCell(row?.marks ?? ''),
    ].map((cell) => ({ ...cell, style: cell.style || rowStyle }));
  });
}

function summarizeBiometricCodeRows(
  rows: BiometricPreviewRow[],
  holidaysByDate: Map<string, PublicHoliday>,
  dateRange: string[],
) {
  const payroll = dateRange.reduce((total, date) => {
    const row = rows.find((item) => item.date === date);
    return addBiometricPayrollBreakdown(total, biometricPayrollBreakdown(row, holidaysByDate.get(date)));
  }, emptyBiometricPayrollBreakdown());
  return {
    daysWithMarks: rows.length,
    missingWorkDays: dateRange.filter((date) => !rows.some((row) => row.date === date) && !isWeekendDate(date) && !holidaysByDate.has(date)).length,
    holidayDays: dateRange.filter((date) => holidaysByDate.has(date)).length,
    reviewDays: rows.filter((row) => row.status !== 'Completo').length,
    markCount: rows.reduce((sum, row) => sum + row.markCount, 0),
    rawMarkCount: rows.reduce((sum, row) => sum + row.rawMarkCount, 0),
    ignoredMarkCount: rows.reduce((sum, row) => sum + row.ignoredMarkCount, 0),
    totalHours: Number(rows.reduce((sum, row) => sum + row.workedHours, 0).toFixed(2)),
    dayHours: Number(rows.reduce((sum, row) => sum + row.dayHours, 0).toFixed(2)),
    nightHours: Number(rows.reduce((sum, row) => sum + row.nightHours, 0).toFixed(2)),
    payroll,
  };
}

function legalParameterForRange(parametersByYear: Map<number, PayrollLegalParameter>, dateRange: string[]): PayrollLegalParameter | undefined {
  const year = Number((dateRange[0] ?? new Date().toISOString().slice(0, 10)).slice(0, 4));
  return parametersByYear.get(year);
}

function numberValue(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function biometricHourlyRates(baseSalary: number, parameter: PayrollLegalParameter | undefined) {
  const divisor = numberValue(parameter?.monthly_hours_divisor_default) || 220;
  const ordinary = divisor > 0 ? baseSalary / divisor : 0;
  const nightOrdinaryPct = numberValue(parameter?.night_ordinary_surcharge_pct) || 35;
  const dayExtraPct = numberValue(parameter?.day_extra_surcharge_pct) || 25;
  const nightExtraPct = numberValue(parameter?.night_extra_surcharge_pct) || 75;
  const sundayPct = numberValue(parameter?.sunday_holiday_surcharge_pct) || 80;
  return {
    ordinary,
    dayExtra: ordinary * (1 + dayExtraPct / 100),
    nightExtra: ordinary * (1 + nightExtraPct / 100),
    nightSurcharge: ordinary * (nightOrdinaryPct / 100),
    sundayDay: ordinary * (1 + sundayPct / 100),
    sundayExtraDay: ordinary * (1 + (sundayPct + dayExtraPct) / 100),
    sundayNight: ordinary * (1 + (sundayPct + nightOrdinaryPct) / 100),
    sundayExtraNight: ordinary * (1 + (sundayPct + nightExtraPct) / 100),
  };
}

function roundedCurrency(value: number): number {
  return Math.round(value);
}

function buildBiometricPreviewXlsx(
  rows: BiometricPreviewRow[],
  holidaysByDate: Map<string, PublicHoliday>,
  dateRange: string[],
  fileName: string,
  employeeByBiometricCode: Map<string, Employee>,
  parametersByYear: Map<number, PayrollLegalParameter>,
): Blob {
  const exportRange = biometricExportDateRange(rows, dateRange);
  const parameter = legalParameterForRange(parametersByYear, exportRange);
  const byCode = new Map<string, BiometricPreviewRow[]>();
  rows.forEach((row) => {
    const group = byCode.get(row.code) ?? [];
    group.push(row);
    byCode.set(row.code, group);
  });

  const usedSheetNames = new Set<string>();
  const codeGroups = [...byCode.entries()]
    .map(([code, codeRows]) => [code, [...codeRows].sort((left, right) => left.date.localeCompare(right.date))] as const)
    .sort(([left], [right]) => left.localeCompare(right, 'es', { numeric: true }));
  const summaryRows: XlsxCell[][] = [
    [xlsxCell('RESUMEN DE NOMINA BIOMETRICA', XLSX_STYLE.title)],
    [xlsxCell('Archivo', XLSX_STYLE.softHeader), xlsxCell(fileName || 'TXT biometrico')],
    [xlsxCell('Periodo', XLSX_STYLE.softHeader), xlsxCell(exportRange.length ? `${formatDate(exportRange[0])} - ${formatDate(exportRange[exportRange.length - 1])}` : 'Sin rango')],
    [xlsxCell('Codigos', XLSX_STYLE.softHeader), xlsxCell(codeGroups.length), xlsxCell('Dias del rango', XLSX_STYLE.softHeader), xlsxCell(exportRange.length)],
    [],
    ['Empleado', 'Codigo', 'Dias con marca', 'Faltas laborales', 'Festivos', 'Dias por revisar', 'Timbradas', 'Horas trabajadas', 'Horas diurnas', 'Horas nocturnas'].map((label) => xlsxCell(label, XLSX_STYLE.tableHeader)),
  ];

  const codeSheets = codeGroups.map(([code, codeRows]) => {
    const summary = summarizeBiometricCodeRows(codeRows, holidaysByDate, exportRange);
    const employee = employeeByBiometricCode.get(code);
    const displayName = biometricCodeDisplayName(code, employeeByBiometricCode);
    const baseSalary = numberValue(employee?.base_salary) || numberValue(parameter?.minimum_wage);
    const rates = biometricHourlyRates(baseSalary, parameter);
    const values = {
      ordinary: summary.payroll.ordinaryHours * rates.ordinary,
      dayExtra: summary.payroll.extraDayHours * rates.dayExtra,
      nightExtra: summary.payroll.extraNightHours * rates.nightExtra,
      nightSurcharge: summary.payroll.nightSurchargeHours * rates.nightSurcharge,
      sundayDay: summary.payroll.sundayDayHours * rates.sundayDay,
      sundayExtraDay: summary.payroll.sundayExtraDayHours * rates.sundayExtraDay,
      sundayNight: summary.payroll.sundayNightHours * rates.sundayNight,
      sundayExtraNight: summary.payroll.sundayExtraNightHours * rates.sundayExtraNight,
    };
    const summaryStyle = summary.reviewDays > 0 ? XLSX_STYLE.warning : 3;
    summaryRows.push([
      xlsxCell(biometricCodeDisplayName(code, employeeByBiometricCode)),
      xlsxCell(code),
      xlsxCell(summary.daysWithMarks),
      xlsxCell(summary.missingWorkDays),
      xlsxCell(summary.holidayDays),
      xlsxCell(summary.reviewDays),
      xlsxCell(summary.rawMarkCount),
      xlsxCell(summary.totalHours),
      xlsxCell(summary.dayHours),
      xlsxCell(summary.nightHours),
    ].map((cell) => ({ ...cell, style: cell.style || summaryStyle })));

    const estimatedTotal = Object.values(values).reduce((sum, value) => sum + value, 0);
    const rateRows: XlsxCell[][] = [
      ['Hora ordinaria', 'Base / divisor legal', rates.ordinary, summary.payroll.ordinaryHours, values.ordinary],
      ['Hora extra diurna', '+25%', rates.dayExtra, summary.payroll.extraDayHours, values.dayExtra],
      ['Hora extra nocturna', '+75%', rates.nightExtra, summary.payroll.extraNightHours, values.nightExtra],
      ['Recargo nocturno', '+35%', rates.nightSurcharge, summary.payroll.nightSurchargeHours, values.nightSurcharge],
      ['Dominical / festiva diurna', '+80%', rates.sundayDay, summary.payroll.sundayDayHours, values.sundayDay],
      ['Extra diurna dominical / festiva', '+80% + 25%', rates.sundayExtraDay, summary.payroll.sundayExtraDayHours, values.sundayExtraDay],
      ['Dominical / festiva nocturna', '+80% + 35%', rates.sundayNight, summary.payroll.sundayNightHours, values.sundayNight],
      ['Extra nocturna dominical / festiva', '+80% + 75%', rates.sundayExtraNight, summary.payroll.sundayExtraNightHours, values.sundayExtraNight],
    ].map(([concept, rule, hourValue, hours, amount]) => [
      xlsxCell(String(concept), 3),
      xlsxCell(String(rule), 3),
      xlsxCell(roundedCurrency(Number(hourValue)), 3),
      xlsxCell(Number(hours), 3),
      xlsxCell(roundedCurrency(Number(amount)), 3),
    ]);

    const detailHeader = [
      'COD',
      'FECHA',
      'DIA',
      'ENTRADA',
      'SALIDA',
      'DURACION',
      'HORAS TRABAJADAS',
      'HORAS ORD.',
      'INICIO ALMUERZO',
      'FIN ALMUERZO',
      'DESCANSO',
      'H. EXTRAS DIURNAS',
      'H. EXTRAS NOCT.',
      'RECARGO NOCT.',
      'DOMINICAL DIURNA',
      'EXTRA DIURNA DOM.',
      'DOMINICAL NOCT.',
      'EXTRA NOCT. DOM.',
      'INCAPACIDADES',
      'HORA ORDINARIA',
      'FESTIVO',
      'ESTADO',
      'OBSERVACION',
      'ANALISIS',
      'TIMBRADAS',
      'TODAS LAS TIMBRADAS',
    ];
    const dayRows = buildBiometricCodeDayRows(code, codeRows, holidaysByDate, exportRange);
    const totalRow = [
      xlsxCell('TOTALES', XLSX_STYLE.total),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(summary.payroll.rawHours, XLSX_STYLE.total),
      xlsxCell(summary.payroll.ordinaryHours, XLSX_STYLE.total),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(summary.payroll.lunchHours, XLSX_STYLE.total),
      xlsxCell(summary.payroll.extraDayHours, XLSX_STYLE.total),
      xlsxCell(summary.payroll.extraNightHours, XLSX_STYLE.total),
      xlsxCell(summary.payroll.nightSurchargeHours, XLSX_STYLE.total),
      xlsxCell(summary.payroll.sundayDayHours, XLSX_STYLE.total),
      xlsxCell(summary.payroll.sundayExtraDayHours, XLSX_STYLE.total),
      xlsxCell(summary.payroll.sundayNightHours, XLSX_STYLE.total),
      xlsxCell(summary.payroll.sundayExtraNightHours, XLSX_STYLE.total),
      xlsxCell(0, XLSX_STYLE.total),
      xlsxCell(summary.payroll.ordinaryHours, XLSX_STYLE.total),
      xlsxCell(''),
      xlsxCell(summary.reviewDays > 0 ? `${summary.reviewDays} dia(s) por revisar` : 'OK', summary.reviewDays > 0 ? XLSX_STYLE.warning : XLSX_STYLE.total),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(summary.rawMarkCount, XLSX_STYLE.total),
      xlsxCell(''),
    ];
    const valueRow = [
      xlsxCell('VALOR ESTIMADO', XLSX_STYLE.total),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(roundedCurrency(values.ordinary), XLSX_STYLE.total),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(roundedCurrency(values.dayExtra), XLSX_STYLE.total),
      xlsxCell(roundedCurrency(values.nightExtra), XLSX_STYLE.total),
      xlsxCell(roundedCurrency(values.nightSurcharge), XLSX_STYLE.total),
      xlsxCell(roundedCurrency(values.sundayDay), XLSX_STYLE.total),
      xlsxCell(roundedCurrency(values.sundayExtraDay), XLSX_STYLE.total),
      xlsxCell(roundedCurrency(values.sundayNight), XLSX_STYLE.total),
      xlsxCell(roundedCurrency(values.sundayExtraNight), XLSX_STYLE.total),
      xlsxCell(0, XLSX_STYLE.total),
      xlsxCell(roundedCurrency(values.ordinary), XLSX_STYLE.total),
      xlsxCell(''),
      xlsxCell(`TOTAL: ${roundedCurrency(estimatedTotal)}`, XLSX_STYLE.total),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
      xlsxCell(''),
    ];

    return {
      name: uniqueSheetName(`COD ${code}`, usedSheetNames),
      widths: [10, 14, 12, 13, 13, 13, 17, 12, 17, 16, 11, 18, 17, 16, 19, 21, 19, 21, 14, 14, 24, 14, 20, 42, 11, 42],
      rows: [
        [xlsxCell('NOMINA BIOMETRICA', XLSX_STYLE.title), xlsxCell(displayName, XLSX_STYLE.title), xlsxCell(`CODIGO ${code}`, XLSX_STYLE.title)],
        [xlsxCell('Archivo', XLSX_STYLE.softHeader), xlsxCell(fileName || 'TXT biometrico'), xlsxCell('Periodo', XLSX_STYLE.softHeader), xlsxCell(exportRange.length ? `${formatDate(exportRange[0])} - ${formatDate(exportRange[exportRange.length - 1])}` : 'Sin rango')],
        [xlsxCell('Empleado', XLSX_STYLE.softHeader), xlsxCell(displayName), xlsxCell('Salario base', XLSX_STYLE.softHeader), xlsxCell(baseSalary), xlsxCell('Dias por revisar', XLSX_STYLE.softHeader), xlsxCell(summary.reviewDays)],
        [],
        [xlsxCell('TARIFAS, HORAS Y VALORES', XLSX_STYLE.darkHeader)],
        ['Concepto', 'Regla', 'Valor hora', 'Horas', 'Valor estimado'].map((label) => xlsxCell(label, XLSX_STYLE.tableHeader)),
        ...rateRows,
        [xlsxCell('TOTAL ESTIMADO', XLSX_STYLE.total), xlsxCell(''), xlsxCell(''), xlsxCell(''), xlsxCell(roundedCurrency(estimatedTotal), XLSX_STYLE.total)],
        [],
        [xlsxCell('DETALLE DIARIO', XLSX_STYLE.darkHeader)],
        detailHeader.map((label) => xlsxCell(label, XLSX_STYLE.tableHeader)),
        ...dayRows,
        totalRow,
        valueRow,
      ],
    };
  });

  const sheets: XlsxSheet[] = [
    {
      name: uniqueSheetName('Resumen', usedSheetNames),
      widths: [30, 15, 15, 16, 12, 16, 14, 17, 19, 18, 15, 16],
      rows: summaryRows,
    },
    ...codeSheets,
  ];
  return createXlsxBlob(sheets);
}

export function AdminPayroll() {
  const [activeSection, setActiveSection] = useState<PayrollSection>('periods');
  const { employees, employeeById, loading: loadingEmployees } = useEmployeeDirectory();

  return (
    <div>
      <PageHeader title="Nómina" subtitle="Períodos quincenales, horarios, importación biométrica y parámetros legales." />
      <TabBar tabs={PAYROLL_SECTIONS} value={activeSection} onChange={setActiveSection} />
      {loadingEmployees ? (
        <LoadingState label="Cargando empleados..." />
      ) : (
        <>
          {activeSection === 'periods' && <PeriodsSection employeeById={employeeById} />}
          {activeSection === 'schedules' && <SchedulesSection employees={employees} employeeById={employeeById} />}
          {activeSection === 'biometric' && <BiometricSection employees={employees} employeeById={employeeById} />}
          {activeSection === 'holidays' && <HolidaysSection />}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Períodos de nómina ───────────────────────── */

function PeriodsSection({ employeeById }: { employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPayrollPeriods({ limit: 50 });
      setPeriods(res.data);
      setSelectedPeriod((current) => {
        if (!current) return current;
        return res.data.find((p) => p.id === current.id) ?? current;
      });
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los períodos de nómina');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCalculate = async (period: PayrollPeriod) => {
    setBusyAction(period.id);
    try {
      const result = await calculatePayrollPeriod(period.id);
      if (result.errors.length > 0) {
        toast.warning(`Calculado con ${result.errors.length} error(es). Revisa el detalle.`);
      } else {
        toast.success(`Nómina calculada para ${result.calculated} empleado(s)`);
      }
      await load();
      setSelectedPeriod(result.period);
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo calcular el período'));
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async (period: PayrollPeriod) => {
    setBusyAction(period.id);
    try {
      const updated = await approvePayrollPeriod(period.id);
      toast.success('Período aprobado');
      await load();
      setSelectedPeriod(updated);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo aprobar el período');
    } finally {
      setBusyAction(null);
    }
  };

  const handleMarkPaid = async (period: PayrollPeriod) => {
    setBusyAction(period.id);
    try {
      const updated = await markPayrollPeriodPaid(period.id);
      toast.success('Período marcado como pagado');
      await load();
      setSelectedPeriod(updated);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo marcar como pagado');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) return <LoadingState label="Cargando períodos..." />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <PrimaryButton onClick={() => setShowNewModal(true)} icon={<Plus size={14} />}>Nuevo período</PrimaryButton>
      </div>

      {periods.length === 0 ? (
        <EmptyState title="Sin períodos de nómina" description="Crea un período quincenal para empezar a calcular la nómina." />
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          <Card className="p-3 space-y-2 h-fit">
            {periods.map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selectedPeriod?.id === period.id ? 'border-[#2a4038] bg-[#2a4038]/5' : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-900">{period.label || `${formatDate(period.period_start)} — ${formatDate(period.period_end)}`}</p>
                  <Badge label={PERIOD_STATUS_LABELS[period.status]} color={periodStatusColor(period.status)} />
                </div>
                <p className="text-[11px] text-gray-400">{formatDate(period.period_start)} - {formatDate(period.period_end)}</p>
              </button>
            ))}
          </Card>

          {selectedPeriod ? (
            <PeriodDetail
              period={selectedPeriod}
              employeeById={employeeById}
              busy={busyAction === selectedPeriod.id}
              onCalculate={() => void handleCalculate(selectedPeriod)}
              onApprove={() => void handleApprove(selectedPeriod)}
              onMarkPaid={() => void handleMarkPaid(selectedPeriod)}
            />
          ) : (
            <Card className="p-8"><EmptyState title="Selecciona un período" description="Elige un período de la lista para ver su detalle." /></Card>
          )}
        </div>
      )}

      <NewPeriodModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={async () => {
          setShowNewModal(false);
          await load();
        }}
      />
    </div>
  );
}

function PeriodDetail({
  period,
  employeeById,
  busy,
  onCalculate,
  onApprove,
  onMarkPaid,
}: {
  period: PayrollPeriod;
  employeeById: Map<string, Employee>;
  busy: boolean;
  onCalculate: () => void;
  onApprove: () => void;
  onMarkPaid: () => void;
}) {
  const totalNet = period.payrolls.reduce((sum, p) => sum + Number(p.net_salary || 0), 0);
  const totalGross = period.payrolls.reduce((sum, p) => sum + Number(p.gross_earnings || 0) + Number(p.base_salary || 0), 0);
  const totalDeductions = period.payrolls.reduce((sum, p) => sum + Number(p.total_deductions || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiCard label="Empleados liquidados" value={String(period.payrolls.length)} icon={Banknote} color="text-blue-600 bg-blue-50" />
        <KpiCard label="Total devengado" value={formatMoney(totalGross)} icon={Calculator} color="text-emerald-600 bg-emerald-50" />
        <KpiCard label="Total neto a pagar" value={formatMoney(totalNet)} icon={CheckCircle2} color="text-purple-600 bg-purple-50" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{period.label}</p>
            <p className="text-xs text-gray-400">{formatDate(period.period_start)} - {formatDate(period.period_end)} · Deducciones: {formatMoney(totalDeductions)}</p>
          </div>
          <div className="flex items-center gap-2">
            {(period.status === 'OPEN' || period.status === 'CALCULATED') && (
              <SecondaryButton onClick={onCalculate} disabled={busy} icon={<Calculator size={13} />}>
                {busy ? 'Calculando...' : period.status === 'OPEN' ? 'Calcular' : 'Recalcular'}
              </SecondaryButton>
            )}
            {period.status === 'CALCULATED' && (
              <PrimaryButton onClick={onApprove} disabled={busy} icon={<CheckCircle2 size={13} />}>
                {busy ? 'Aprobando...' : 'Aprobar período'}
              </PrimaryButton>
            )}
            {period.status === 'APPROVED' && (
              <PrimaryButton onClick={onMarkPaid} disabled={busy} icon={<Banknote size={13} />}>
                {busy ? 'Marcando...' : 'Marcar como pagado'}
              </PrimaryButton>
            )}
          </div>
        </div>

        {period.payrolls.length === 0 ? (
          <EmptyState title="Sin nóminas calculadas" description="Usa 'Calcular' para generar la liquidación de cada empleado activo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3">Empleado</th>
                  <th className="py-2 pr-3">Comprobante</th>
                  <th className="py-2 pr-3">Días</th>
                  <th className="py-2 pr-3">Horas extra</th>
                  <th className="py-2 pr-3">Devengado</th>
                  <th className="py-2 pr-3">Deducciones</th>
                  <th className="py-2 pr-3">Neto</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {period.payrolls.map((payroll) => (
                  <tr key={payroll.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3">{payroll.employee_name || employeeName(employeeById.get(payroll.employee))}</td>
                    <td className="py-2 pr-3 text-gray-400">{payroll.payslip_number || '-'}</td>
                    <td className="py-2 pr-3">{payroll.worked_days ?? '-'}</td>
                    <td className="py-2 pr-3">{payroll.overtime_hours}</td>
                    <td className="py-2 pr-3">{formatMoney(Number(payroll.base_salary) + Number(payroll.gross_earnings))}</td>
                    <td className="py-2 pr-3 text-amber-600">{formatMoney(payroll.total_deductions)}</td>
                    <td className="py-2 pr-3 font-semibold text-gray-900">{formatMoney(payroll.net_salary)}</td>
                    <td className="py-2 pr-3">
                      <Badge label={payroll.status} color={payroll.status === 'PAID' ? 'green' : payroll.status === 'APPROVED' ? 'blue' : 'yellow'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function NewPeriodModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const toast = useToast();
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!periodStart || !periodEnd) {
      toast.warning('Indica la fecha de inicio y fin del período.');
      return;
    }
    setSaving(true);
    try {
      await createPayrollPeriod({ period_start: periodStart, period_end: periodEnd, label });
      toast.success('Período creado');
      setPeriodStart('');
      setPeriodEnd('');
      setLabel('');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el período');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo período de nómina" open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Inicio</span>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Fin</span>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Etiqueta (opcional)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: 1ra quincena julio 2026" className={inputCls} />
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Creando...' : 'Crear período'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Horarios ───────────────────────── */

const TEMPLATE_ACCENTS = [
  { dot: 'bg-blue-500', ring: 'border-blue-100' },
  { dot: 'bg-orange-500', ring: 'border-orange-100' },
  { dot: 'bg-violet-500', ring: 'border-violet-100' },
  { dot: 'bg-emerald-500', ring: 'border-emerald-100' },
  { dot: 'bg-rose-500', ring: 'border-rose-100' },
  { dot: 'bg-amber-500', ring: 'border-amber-100' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function SchedulesSection({ employees, employeeById }: { employees: Employee[]; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [schedules, setSchedules] = useState<EmployeeWorkSchedule[]>([]);
  const [templates, setTemplates] = useState<WorkScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reassignEmployeeId, setReassignEmployeeId] = useState<string | undefined>(undefined);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkScheduleTemplate | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState<WorkScheduleTemplate | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedulesRes, templatesRes] = await Promise.allSettled([
        getEmployeeWorkSchedules(),
        getWorkScheduleTemplates(),
      ]);
      if (schedulesRes.status === 'fulfilled') setSchedules(schedulesRes.value);
      if (templatesRes.status === 'fulfilled') setTemplates(templatesRes.value);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los horarios');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateEmployeeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const schedule of schedules) {
      if (!schedule.source_template || !schedule.is_active) continue;
      counts.set(schedule.source_template, (counts.get(schedule.source_template) ?? 0) + 1);
    }
    return counts;
  }, [schedules]);

  const templateNameById = useMemo(() => new Map(templates.map((t) => [t.id, t.name])), [templates]);

  const filteredSchedules = useMemo(() => {
    const term = search.trim().toLowerCase();
    return schedules.filter((schedule) => {
      if (statusFilter === 'ACTIVE' && !schedule.is_active) return false;
      if (statusFilter === 'INACTIVE' && schedule.is_active) return false;
      if (!term) return true;
      const employee = employeeById.get(schedule.employee);
      const name = employee ? employeeName(employee).toLowerCase() : '';
      return name.includes(term);
    });
  }, [schedules, statusFilter, search, employeeById]);

  if (loading) return <LoadingState label="Cargando horarios..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm font-semibold text-gray-900">Plantillas de horario</p>
            <p className="text-[11px] text-gray-500">Crea y administra plantillas para asignarlas fácilmente.</p>
          </div>
          <PrimaryButton onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }} icon={<Plus size={14} />}>
            Nueva plantilla
          </PrimaryButton>
        </div>

        {templates.length === 0 ? (
          <div className="pt-3">
            <EmptyState title="Sin plantillas todavía" description="Crea una plantilla para asignar el mismo horario a varios empleados en un solo paso." />
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
              {templates.map((template, index) => {
                const accent = TEMPLATE_ACCENTS[index % TEMPLATE_ACCENTS.length];
                const employeeCount = templateEmployeeCounts.get(template.id) ?? 0;
                return (
                  <div key={template.id} className={`border ${accent.ring} rounded-2xl p-4 flex flex-col`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                        <p className="text-xs font-semibold text-gray-900">{template.name}</p>
                      </div>
                      <ActionsMenu
                        items={[
                          { label: 'Editar plantilla', icon: Pencil, onClick: () => { setEditingTemplate(template); setShowTemplateModal(true); } },
                          { label: 'Aplicar a empleados', icon: Users, onClick: () => setApplyingTemplate(template) },
                        ]}
                      />
                    </div>
                    {template.description && <p className="text-[11px] text-gray-400 -mt-2 mb-2">{template.description}</p>}
                    <div className="space-y-1 mb-3 flex-1">
                      {template.days.map((day) => (
                        <div key={day.id} className="flex items-center justify-between text-[11px] text-gray-600">
                          <span>{WEEKDAY_LABELS[day.weekday]}</span>
                          <span className="font-mono">{day.expected_start_time.slice(0, 5)} - {day.expected_end_time.slice(0, 5)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-2 border-t border-gray-50">
                      <Users size={12} />
                      Aplicada a {employeeCount} empleado{employeeCount === 1 ? '' : 's'}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1.5">
              <CalendarDays size={12} />
              Consejo: crea plantillas reutilizables para ahorrar tiempo en la asignación de horarios.
            </p>
          </>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Empleados y horarios asignados</p>
            <p className="text-[11px] text-gray-500">Cada empleado necesita un horario esperado para calcular horas ordinarias/extra correctamente.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-52">
              <SearchBarAdmin value={search} onChange={setSearch} placeholder="Buscar empleado..." />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={`${selectCls} w-auto`}>
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
            <SecondaryButton onClick={() => { setReassignEmployeeId(undefined); setShowModal(true); }} icon={<Plus size={13} />}>Asignar horario</SecondaryButton>
          </div>
        </div>

        {filteredSchedules.length === 0 ? (
          <EmptyState
            title={schedules.length === 0 ? 'Sin horarios asignados' : 'Sin resultados'}
            description={schedules.length === 0 ? 'Asigna un horario individual o aplica una plantilla a varios empleados.' : 'Ajusta la búsqueda o el filtro de estado.'}
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredSchedules.map((schedule) => {
              const employee = employeeById.get(schedule.employee);
              return (
                <div key={schedule.id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-[#2a4038]/10 text-[#2a4038] flex items-center justify-center text-[11px] font-bold shrink-0">
                        {initials(employeeName(employee))}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{employeeName(employee)}</p>
                        <p className="text-[10px] text-gray-400">Vigente {formatDate(schedule.start_date)}</p>
                      </div>
                    </div>
                    <ActionsMenu
                      items={[
                        { label: 'Reasignar horario', icon: Pencil, onClick: () => { setReassignEmployeeId(schedule.employee); setShowModal(true); } },
                      ]}
                    />
                  </div>

                  {schedule.source_template && templateNameById.has(schedule.source_template) && (
                    <div className="mb-2">
                      <Badge label={templateNameById.get(schedule.source_template) as string} color="blue" />
                    </div>
                  )}

                  <div className="grid grid-cols-7 gap-1 mb-3">
                    {WEEKDAY_LABELS.map((label, weekday) => {
                      const day = schedule.days.find((d) => d.weekday === weekday);
                      return (
                        <div key={weekday} className="text-center">
                          <p className="text-[9px] font-bold uppercase text-gray-400 mb-1">{label.slice(0, 3)}</p>
                          {day ? (
                            <p className="text-[9px] font-mono text-gray-600 leading-tight">
                              {day.expected_start_time.slice(0, 5)}<br />{day.expected_end_time.slice(0, 5)}
                            </p>
                          ) : (
                            <p className="text-[9px] text-gray-300">-</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Badge label={schedule.is_active ? 'Activo' : 'Inactivo'} color={schedule.is_active ? 'green' : 'gray'} />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <NewScheduleModal
        open={showModal}
        employees={employees}
        initialEmployeeId={reassignEmployeeId}
        onClose={() => setShowModal(false)}
        onCreated={async () => {
          setShowModal(false);
          await load();
        }}
      />
      <NewTemplateModal
        open={showTemplateModal}
        editing={editingTemplate}
        onClose={() => setShowTemplateModal(false)}
        onCreated={async () => {
          setShowTemplateModal(false);
          setEditingTemplate(null);
          await load();
        }}
      />
      {applyingTemplate && (
        <ApplyTemplateModal
          template={applyingTemplate}
          employees={employees}
          onClose={() => setApplyingTemplate(null)}
          onApplied={async () => {
            setApplyingTemplate(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

type ScheduleDayForm = { weekday: number; expectedStart: string; expectedEnd: string; enabled: boolean };

function defaultWeekdayForm(): ScheduleDayForm[] {
  return WEEKDAY_LABELS.map((_, weekday) => ({
    weekday,
    expectedStart: '08:00',
    expectedEnd: '17:00',
    enabled: weekday < 5,
  }));
}

function NewScheduleModal({
  open,
  employees,
  initialEmployeeId,
  onClose,
  onCreated,
}: {
  open: boolean;
  employees: Employee[];
  initialEmployeeId?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState<ScheduleDayForm[]>(defaultWeekdayForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmployeeId(initialEmployeeId ?? '');
      setStartDate('');
      setDays(defaultWeekdayForm());
    }
  }, [open, initialEmployeeId]);

  const updateDay = (weekday: number, patch: Partial<ScheduleDayForm>) => {
    setDays((current) => current.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  };

  const handleSubmit = async () => {
    if (!employeeId || !startDate) {
      toast.warning('Selecciona el empleado y la fecha de inicio.');
      return;
    }
    const activeDays = days.filter((d) => d.enabled);
    if (activeDays.length === 0) {
      toast.warning('Activa al menos un día de la semana.');
      return;
    }
    setSaving(true);
    try {
      await setEmployeeWorkSchedule({
        employee: employeeId,
        start_date: startDate,
        days: activeDays.map((d) => ({
          weekday: d.weekday,
          expected_start_time: d.expectedStart,
          expected_end_time: d.expectedEnd,
        })),
      });
      toast.success('Horario asignado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo asignar el horario'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Asignar horario de empleado" open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Empleado</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={selectCls}>
              <option value="">Selecciona...</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employeeName(employee)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Vigente desde</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Franjas por día</p>
          {days.map((day) => (
            <div key={day.weekday} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2.5">
              <label className="flex items-center gap-2 w-28 text-xs text-gray-700">
                <input type="checkbox" checked={day.enabled} onChange={(e) => updateDay(day.weekday, { enabled: e.target.checked })} />
                {WEEKDAY_LABELS[day.weekday]}
              </label>
              <input
                type="time"
                value={day.expectedStart}
                disabled={!day.enabled}
                onChange={(e) => updateDay(day.weekday, { expectedStart: e.target.value })}
                className={`${inputCls} disabled:opacity-40`}
              />
              <span className="text-xs text-gray-400">a</span>
              <input
                type="time"
                value={day.expectedEnd}
                disabled={!day.enabled}
                onChange={(e) => updateDay(day.weekday, { expectedEnd: e.target.value })}
                className={`${inputCls} disabled:opacity-40`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Asignar horario'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NewTemplateModal({
  open,
  editing,
  onClose,
  onCreated,
}: {
  open: boolean;
  editing?: WorkScheduleTemplate | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState<ScheduleDayForm[]>(defaultWeekdayForm());
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(editing);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setDays(
        WEEKDAY_LABELS.map((_, weekday) => {
          const match = editing.days.find((d) => d.weekday === weekday);
          return {
            weekday,
            expectedStart: match ? match.expected_start_time.slice(0, 5) : '08:00',
            expectedEnd: match ? match.expected_end_time.slice(0, 5) : '17:00',
            enabled: Boolean(match),
          };
        }),
      );
    } else {
      setName('');
      setDescription('');
      setDays(defaultWeekdayForm());
    }
  }, [open, editing]);

  const updateDay = (weekday: number, patch: Partial<ScheduleDayForm>) => {
    setDays((current) => current.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.warning('Indica un nombre para la plantilla.');
      return;
    }
    const activeDays = days.filter((d) => d.enabled);
    if (activeDays.length === 0) {
      toast.warning('Activa al menos un día de la semana.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        days: activeDays.map((d) => ({
          weekday: d.weekday,
          expected_start_time: d.expectedStart,
          expected_end_time: d.expectedEnd,
        })),
      };
      if (editing) {
        await updateWorkScheduleTemplate(editing.id, payload);
        toast.success('Plantilla actualizada');
      } else {
        await createWorkScheduleTemplate(payload);
        toast.success('Plantilla creada');
      }
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo guardar la plantilla'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEditing ? 'Editar plantilla de horario' : 'Nueva plantilla de horario'} open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Turno mañana 7:00-16:30" className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Descripción (opcional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Franjas por día</p>
          {days.map((day) => (
            <div key={day.weekday} className="flex items-center gap-3 border border-gray-100 rounded-lg p-2.5">
              <label className="flex items-center gap-2 w-28 text-xs text-gray-700">
                <input type="checkbox" checked={day.enabled} onChange={(e) => updateDay(day.weekday, { enabled: e.target.checked })} />
                {WEEKDAY_LABELS[day.weekday]}
              </label>
              <input
                type="time"
                value={day.expectedStart}
                disabled={!day.enabled}
                onChange={(e) => updateDay(day.weekday, { expectedStart: e.target.value })}
                className={`${inputCls} disabled:opacity-40`}
              />
              <span className="text-xs text-gray-400">a</span>
              <input
                type="time"
                value={day.expectedEnd}
                disabled={!day.enabled}
                onChange={(e) => updateDay(day.weekday, { expectedEnd: e.target.value })}
                className={`${inputCls} disabled:opacity-40`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plantilla'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function ApplyTemplateModal({
  template,
  employees,
  onClose,
  onApplied,
}: {
  template: WorkScheduleTemplate;
  employees: Employee[];
  onClose: () => void;
  onApplied: () => Promise<void>;
}) {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleEmployee = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast.warning('Selecciona al menos un empleado.');
      return;
    }
    if (!startDate) {
      toast.warning('Indica la fecha de inicio.');
      return;
    }
    setSaving(true);
    try {
      const result = await applyWorkScheduleTemplate(template.id, {
        employee_ids: Array.from(selectedIds),
        start_date: startDate,
      });
      if (result.errors.length > 0) {
        toast.warning(`Aplicado a ${result.applied} empleado(s), con ${result.errors.length} error(es).`);
      } else {
        toast.success(`Horario aplicado a ${result.applied} empleado(s).`);
      }
      await onApplied();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo aplicar la plantilla'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Aplicar "${template.name}" a empleados`} open onClose={onClose} wide>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Vigente desde</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </label>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Empleados ({selectedIds.size} seleccionados)</span>
            <button
              type="button"
              onClick={() => setSelectedIds(selectedIds.size === employees.length ? new Set() : new Set(employees.map((e) => e.id)))}
              className="text-[11px] text-[#2a4038] font-semibold hover:underline"
            >
              {selectedIds.size === employees.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {employees.map((employee) => (
              <label key={employee.id} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selectedIds.has(employee.id)} onChange={() => toggleEmployee(employee.id)} />
                {employeeName(employee)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Aplicando...' : 'Aplicar a empleados'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Biométrico ───────────────────────── */

function BiometricSection({ employees, employeeById }: { employees: Employee[]; employeeById: Map<string, Employee> }) {
  const toast = useToast();
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [mappings, setMappings] = useState<EmployeeBiometricId[]>([]);
  const [pending, setPending] = useState<Attendance[]>([]);
  const [intelligenceSettings, setIntelligenceSettings] = useState<AttendanceIntelligenceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingInitialCode, setMappingInitialCode] = useState<string | undefined>(undefined);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState<Attendance | null>(null);
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false);
  const [uploadingDevice, setUploadingDevice] = useState('');
  const [uploadDateFrom, setUploadDateFrom] = useState('');
  const [uploadDateTo, setUploadDateTo] = useState('');
  const [previewRows, setPreviewRows] = useState<BiometricPreviewRow[]>([]);
  const [previewProgress, setPreviewProgress] = useState({ processed: 0, total: 0, parsed: 0 });
  const [previewParsing, setPreviewParsing] = useState(false);
  const [previewFileName, setPreviewFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [expandedPreviewCodes, setExpandedPreviewCodes] = useState<Set<string>>(new Set());
  const [previewMode, setPreviewMode] = useState<'table' | 'calendar'>('table');
  const [previewHolidays, setPreviewHolidays] = useState<PublicHoliday[]>([]);
  const [previewLegalParameters, setPreviewLegalParameters] = useState<PayrollLegalParameter[]>([]);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedBiometricAnalysis[]>([]);
  const [selectedSavedAnalysisId, setSelectedSavedAnalysisId] = useState('');
  const [currentSavedAnalysisId, setCurrentSavedAnalysisId] = useState<string | null>(null);
  const [mappingPage, setMappingPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, mappingsRes, pendingRes, intelligenceRes, parametersRes] = await Promise.allSettled([
        getBiometricDevices(),
        getEmployeeBiometricIds({ limit: 1000 }),
        getPendingCorrectionAttendance(),
        getAttendanceIntelligenceSettings(),
        getPayrollLegalParameters(),
      ]);
      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value);
      if (mappingsRes.status === 'fulfilled') setMappings(mappingsRes.value);
      if (pendingRes.status === 'fulfilled') setPending(pendingRes.value);
      if (intelligenceRes.status === 'fulfilled') setIntelligenceSettings(intelligenceRes.value);
      if (parametersRes.status === 'fulfilled') setPreviewLegalParameters(parametersRes.value);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la información biométrica');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const items = loadSavedBiometricAnalyses();
    setSavedAnalyses(items);
    setSelectedSavedAnalysisId(items[0]?.id ?? '');
  }, []);

  const handleUpload = async (file: File) => {
    if (uploadDateFrom && uploadDateTo && uploadDateTo < uploadDateFrom) {
      toast.error('La fecha hasta no puede ser anterior a la fecha desde.');
      return;
    }
    const previousFileName = previewFileName;
    setCurrentSavedAnalysisId(null);
    setPreviewFileName(file.name);
    setPreviewProgress({ processed: 0, total: 0, parsed: 0 });
    setPreviewParsing(true);
    const groups = new Map<string, { code: string; date: string; punches: BiometricPreviewPunch[] }>();
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      let parsed = 0;
      for (let index = 0; index < lines.length; index += 1) {
        const parsedLine = parseBiometricLine(lines[index]);
        if (parsedLine) {
          const inRange =
            (!uploadDateFrom || parsedLine.date >= uploadDateFrom) &&
            (!uploadDateTo || parsedLine.date <= uploadDateTo);
          if (inRange) {
            const key = `${parsedLine.code}-${parsedLine.date}`;
            const group = groups.get(key) ?? { code: parsedLine.code, date: parsedLine.date, punches: [] };
            group.punches.push({ time: parsedLine.time, action: parsedLine.action });
            groups.set(key, group);
            parsed += 1;
          }
        }
        if ((index + 1) % 500 === 0 || index === lines.length - 1) {
          if (parsed > 0) setPreviewRows(buildBiometricPreviewRows(groups));
          setPreviewProgress({ processed: index + 1, total: lines.length, parsed });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (parsed === 0) {
        setPreviewFileName(previousFileName);
        toast.error('No se encontraron marcaciones del TXT para el rango seleccionado.');
        return;
      }
    } catch (error) {
      console.error(error);
      setPreviewFileName(previousFileName);
      toast.error('No se pudo analizar el TXT del huellero.');
      return;
    } finally {
      setPreviewParsing(false);
    }
    setUploading(true);
    try {
      const batch = await uploadBiometricFile(file, uploadingDevice || undefined, {
        dateFrom: uploadDateFrom || undefined,
        dateTo: uploadDateTo || undefined,
      });
      toast.success(`TXT procesado: ${batch.total_rows} timbradas. Las repetidas no se borran; quedan para revisar.`);
      await load();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo importar el archivo'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await deleteEmployeeBiometricId(id);
      toast.success('Mapeo eliminado');
      await load();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el mapeo');
    }
  };

  const previewDateRange = useMemo(() => {
    const dates = previewRows.map((row) => row.date).sort();
    const start = uploadDateFrom || dates[0] || '';
    const end = uploadDateTo || dates[dates.length - 1] || '';
    return enumerateDates(start, end);
  }, [previewRows, uploadDateFrom, uploadDateTo]);

  const previewCalendarMonths = useMemo(() => groupDatesByMonth(previewDateRange), [previewDateRange]);

  const previewYears = useMemo(() => {
    const years = new Set<number>();
    previewDateRange.forEach((date) => {
      const year = Number(date.slice(0, 4));
      if (Number.isFinite(year)) years.add(year);
    });
    return [...years].sort();
  }, [previewDateRange]);

  useEffect(() => {
    if (previewYears.length === 0) {
      setPreviewHolidays([]);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const holidays = await Promise.all(previewYears.map((year) => getPublicHolidays({ year }).catch(() => [])));
        if (active) setPreviewHolidays(holidays.flat().filter((holiday) => holiday.is_active));
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      active = false;
    };
  }, [previewYears]);

  const previewHolidaysByDate = useMemo(() => {
    const holidays = new Map<string, PublicHoliday>();
    previewYears.forEach((year) => {
      generatedColombianHolidays(year).forEach((holiday) => holidays.set(holiday.civil_date, holiday));
    });
    previewHolidays.forEach((holiday) => holidays.set(holiday.civil_date, holiday));
    return holidays;
  }, [previewHolidays, previewYears]);

  const previewParametersByYear = useMemo(() => {
    return new Map(previewLegalParameters.map((parameter) => [parameter.year, parameter]));
  }, [previewLegalParameters]);

  const employeeByBiometricCode = useMemo(() => {
    const byCode = new Map<string, Employee>();
    mappings.forEach((mapping) => {
      if (!mapping.is_active) return;
      const employee = employeeById.get(mapping.employee);
      if (employee && !byCode.has(mapping.biometric_code)) {
        byCode.set(mapping.biometric_code, employee);
      }
    });
    return byCode;
  }, [mappings, employeeById]);

  const sortedMappings = useMemo(() => {
    return [...mappings].sort((left, right) => {
      const leftEmployee = employeeName(employeeById.get(left.employee));
      const rightEmployee = employeeName(employeeById.get(right.employee));
      return leftEmployee.localeCompare(rightEmployee, 'es', { numeric: true }) ||
        left.biometric_code.localeCompare(right.biometric_code, 'es', { numeric: true });
    });
  }, [mappings, employeeById]);

  const mappingTotalPages = Math.max(1, Math.ceil(sortedMappings.length / BIOMETRIC_MAPPING_PAGE_SIZE));
  const paginatedMappings = useMemo(() => {
    const page = Math.min(mappingPage, mappingTotalPages);
    const start = (page - 1) * BIOMETRIC_MAPPING_PAGE_SIZE;
    return sortedMappings.slice(start, start + BIOMETRIC_MAPPING_PAGE_SIZE);
  }, [sortedMappings, mappingPage, mappingTotalPages]);

  useEffect(() => {
    setMappingPage((page) => Math.min(page, mappingTotalPages));
  }, [mappingTotalPages]);

  const previewByCode = useMemo(() => {
    const groups = new Map<
      string,
      {
        code: string;
        rows: BiometricPreviewRow[];
        markCount: number;
        rawMarkCount: number;
        ignoredMarkCount: number;
        totalHours: number;
        dayHours: number;
        nightHours: number;
        reviewDays: number;
        missingWorkDays: number;
        holidayDays: number;
      }
    >();

    for (const row of previewRows) {
      const group = groups.get(row.code) ?? {
        code: row.code,
        rows: [],
        markCount: 0,
        rawMarkCount: 0,
        ignoredMarkCount: 0,
        totalHours: 0,
        dayHours: 0,
        nightHours: 0,
        reviewDays: 0,
        missingWorkDays: 0,
        holidayDays: 0,
      };
      group.rows.push(row);
      group.markCount += row.markCount;
      group.rawMarkCount += row.rawMarkCount;
      group.ignoredMarkCount += row.ignoredMarkCount;
      group.totalHours += row.workedHours;
      group.dayHours += row.dayHours;
      group.nightHours += row.nightHours;
      if (row.status !== 'Completo') group.reviewDays += 1;
      groups.set(row.code, group);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        rows: group.rows.sort((left, right) => left.date.localeCompare(right.date)),
        totalHours: Number(group.totalHours.toFixed(2)),
        dayHours: Number(group.dayHours.toFixed(2)),
        nightHours: Number(group.nightHours.toFixed(2)),
        missingWorkDays: previewDateRange.filter((date) => {
          const hasMarks = group.rows.some((row) => row.date === date);
          return !hasMarks && !isWeekendDate(date) && !previewHolidaysByDate.has(date);
        }).length,
        holidayDays: previewDateRange.filter((date) => previewHolidaysByDate.has(date)).length,
      }))
      .sort((left, right) => left.code.localeCompare(right.code, 'es', { numeric: true }));
  }, [previewRows, previewDateRange, previewHolidaysByDate]);

  const togglePreviewCode = (code: string) => {
    setExpandedPreviewCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const updatePreviewTime = (
    rowKey: string,
    field: 'checkIn' | 'breakStart' | 'breakEnd' | 'checkOut',
    value: string,
  ) => {
    setPreviewRows((rows) =>
      rows.map((row) => {
        if (row.key !== rowKey) return row;
        const next = enrichPreviewRow({ ...row, [field]: normalizePreviewTime(value) });
        next.status = next.checkIn !== '-' && next.checkOut !== '-' ? 'Completo' : 'Incompleto';
        next.analysis = `${row.analysis ? `${row.analysis}. ` : ''}Editado manualmente`;
        return next;
      }),
    );
  };

  const exportPreviewRows = (rows: BiometricPreviewRow[], code?: string) => {
    if (rows.length === 0) {
      toast.warning('No hay marcaciones para exportar.');
      return;
    }
    const orderedRows = [...rows].sort((left, right) => left.code.localeCompare(right.code, 'es', { numeric: true }) || left.date.localeCompare(right.date));
    const exportRange = biometricExportDateRange(orderedRows, previewDateRange);
    const start = exportRange[0] ?? orderedRows[0]?.date ?? uploadDateFrom;
    const end = exportRange[exportRange.length - 1] ?? orderedRows[orderedRows.length - 1]?.date ?? uploadDateTo;
    const cleanCode = code ? code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'todos';
    downloadBlob(
      `biometrico_${cleanCode}_${start || 'inicio'}_${end || 'fin'}.xlsx`,
      buildBiometricPreviewXlsx(
        orderedRows,
        previewHolidaysByDate,
        previewDateRange,
        previewFileName,
        employeeByBiometricCode,
        previewParametersByYear,
      ),
    );
    toast.success(code ? `Exportado el Excel del codigo ${code}.` : 'Exportado el Excel por codigo.');
  };

  const updateSavedAnalyses = (items: SavedBiometricAnalysis[]) => {
    setSavedAnalyses(items);
    persistSavedBiometricAnalyses(items);
    if (items.length > 0 && !items.some((item) => item.id === selectedSavedAnalysisId)) {
      setSelectedSavedAnalysisId(items[0].id);
    }
    if (items.length === 0) setSelectedSavedAnalysisId('');
  };

  const handleSaveAnalysis = () => {
    if (previewRows.length === 0) {
      toast.warning('Primero analiza un TXT para guardarlo.');
      return;
    }
    const now = new Date().toISOString();
    const existing = currentSavedAnalysisId ? savedAnalyses.find((item) => item.id === currentSavedAnalysisId) : undefined;
    const defaultName = existing?.name || previewFileName || `Analisis ${formatDate(previewDateRange[0] ?? now.slice(0, 10))}`;
    const name = existing?.name || window.prompt('Nombre del analisis', defaultName)?.trim();
    if (!name) return;

    const saved: SavedBiometricAnalysis = {
      id: existing?.id ?? `${Date.now()}`,
      name,
      fileName: previewFileName || 'Analisis biometrico',
      dateFrom: uploadDateFrom,
      dateTo: uploadDateTo,
      parsed: previewProgress.parsed,
      rows: previewRows,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = existing
      ? savedAnalyses.map((item) => (item.id === existing.id ? saved : item))
      : [saved, ...savedAnalyses];
    updateSavedAnalyses(next);
    setCurrentSavedAnalysisId(saved.id);
    setSelectedSavedAnalysisId(saved.id);
    toast.success(existing ? 'Analisis actualizado.' : 'Analisis guardado.');
  };

  const handleOpenSavedAnalysis = () => {
    const saved = savedAnalyses.find((item) => item.id === selectedSavedAnalysisId);
    if (!saved) {
      toast.warning('Selecciona un analisis guardado.');
      return;
    }
    setPreviewRows(saved.rows);
    setPreviewFileName(saved.fileName || saved.name);
    setUploadDateFrom(saved.dateFrom);
    setUploadDateTo(saved.dateTo);
    setPreviewProgress({ processed: saved.parsed, total: saved.parsed, parsed: saved.parsed });
    setCurrentSavedAnalysisId(saved.id);
    toast.success(`Analisis abierto: ${saved.name}`);
  };

  const handleRenameSavedAnalysis = () => {
    const saved = savedAnalyses.find((item) => item.id === selectedSavedAnalysisId);
    if (!saved) {
      toast.warning('Selecciona un analisis guardado.');
      return;
    }
    const name = window.prompt('Nuevo nombre del analisis', saved.name)?.trim();
    if (!name) return;
    const next = savedAnalyses.map((item) => (
      item.id === saved.id ? { ...item, name, updatedAt: new Date().toISOString() } : item
    ));
    updateSavedAnalyses(next);
    toast.success('Nombre actualizado.');
  };

  const handleDeleteSavedAnalysis = () => {
    const saved = savedAnalyses.find((item) => item.id === selectedSavedAnalysisId);
    if (!saved) {
      toast.warning('Selecciona un analisis guardado.');
      return;
    }
    if (!window.confirm(`Eliminar "${saved.name}"?`)) return;
    const next = savedAnalyses.filter((item) => item.id !== saved.id);
    updateSavedAnalyses(next);
    if (currentSavedAnalysisId === saved.id) setCurrentSavedAnalysisId(null);
    toast.success('Analisis eliminado.');
  };

  if (loading) return <LoadingState label="Cargando información biométrica..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Inteligencia de marcaciones</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              El TXT se analiza por codigo y dia. Todas las timbradas se conservan; si el conteo no es normal, el dia queda marcado para revisar.
            </p>
          </div>
          <SecondaryButton onClick={() => setShowIntelligenceModal(true)}>Ajustar</SecondaryButton>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Importar TXT del reloj biometrico</p>
          <SecondaryButton onClick={() => setShowDeviceModal(true)} icon={<Plus size={13} />}>Nuevo dispositivo</SecondaryButton>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,180px)_minmax(150px,180px)_auto] items-end gap-3">
          <label className="block flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dispositivo (opcional)</span>
            <select value={uploadingDevice} onChange={(e) => setUploadingDevice(e.target.value)} className={selectCls}>
              <option value="">Sin especificar</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tomar desde</span>
            <input type="date" value={uploadDateFrom} onChange={(e) => setUploadDateFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tomar hasta</span>
            <input type="date" value={uploadDateTo} onChange={(e) => setUploadDateTo(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors cursor-pointer disabled:opacity-50">
            <UploadCloud size={14} />
            {uploading ? 'Subiendo...' : 'Subir archivo'}
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="block flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Analisis guardados</span>
            <select
              value={selectedSavedAnalysisId}
              onChange={(event) => setSelectedSavedAnalysisId(event.target.value)}
              className={selectCls}
            >
              <option value="">Sin analisis guardados</option>
              {savedAnalyses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.rows.length} dia(s)
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={handleOpenSavedAnalysis} disabled={!selectedSavedAnalysisId}>Abrir</SecondaryButton>
            <SecondaryButton onClick={handleRenameSavedAnalysis} disabled={!selectedSavedAnalysisId}>Cambiar nombre</SecondaryButton>
            <SecondaryButton onClick={handleDeleteSavedAnalysis} disabled={!selectedSavedAnalysisId}>Eliminar</SecondaryButton>
          </div>
        </div>
      </Card>

      {(previewFileName || previewRows.length > 0) && (
        <Card className="p-5">
          <div className="flex flex-col gap-3 mb-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Tabla analizada del TXT</p>
              <p className="text-[11px] text-gray-500">
                {previewFileName || 'Archivo seleccionado'} - {previewProgress.parsed} timbradas - {previewByCode.length} codigos - {previewRows.length} dias analizados
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={`${previewRows.reduce((sum, row) => sum + row.workedHours, 0).toFixed(2)} hrs trabajadas`} color="gray" />
              <Badge label={`${previewRows.reduce((sum, row) => sum + row.dayHours, 0).toFixed(2)} diurnas`} color="green" />
              <Badge label={`${previewRows.reduce((sum, row) => sum + row.nightHours, 0).toFixed(2)} nocturnas`} color="blue" />
              <Badge label={`${previewRows.filter((row) => row.status !== 'Completo').length} por revisar`} color={previewRows.some((row) => row.status !== 'Completo') ? 'yellow' : 'green'} />
              <SecondaryButton onClick={() => setPreviewMode((mode) => (mode === 'table' ? 'calendar' : 'table'))} icon={<RotateCw size={13} />}>
                {previewMode === 'table' ? 'Girar a calendario' : 'Girar a tabla'}
              </SecondaryButton>
              <SecondaryButton onClick={handleSaveAnalysis} icon={<Save size={13} />}>
                Guardar
              </SecondaryButton>
              {previewMode === 'table' && (
                <SecondaryButton
                  onClick={() => setExpandedPreviewCodes((current) => (
                    current.size === previewByCode.length ? new Set() : new Set(previewByCode.map((group) => group.code))
                  ))}
                >
                  {expandedPreviewCodes.size === previewByCode.length ? 'Ocultar todos' : 'Ver todos'}
                </SecondaryButton>
              )}
              <SecondaryButton onClick={() => exportPreviewRows(previewRows)} icon={<Download size={13} />}>
                Exportar todo
              </SecondaryButton>
              {previewParsing && <Badge label={`Leyendo ${previewProgress.processed}/${previewProgress.total}`} color="yellow" />}
            </div>
          </div>
          {previewProgress.total > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[#2a4038] transition-all"
                style={{ width: `${Math.min(100, Math.round((previewProgress.processed / previewProgress.total) * 100))}%` }}
              />
            </div>
          )}
          {previewRows.length === 0 ? (
            <EmptyState title={previewParsing ? 'Analizando TXT...' : 'Sin marcaciones para mostrar'} />
          ) : (
            <>
              {previewMode === 'calendar' ? (
            <div className="max-h-[640px] overflow-auto space-y-3 pr-1">
              {previewByCode.map((group) => {
                const rowsByDate = new Map(group.rows.map((row) => [row.date, row]));
                const mappedEmployee = employeeByBiometricCode.get(group.code);
                return (
                  <div key={group.code} className="rounded-lg border border-gray-100 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{biometricCodeDisplayName(group.code, employeeByBiometricCode)}</p>
                        <p className="text-[11px] text-gray-500">
                          Codigo {group.code}{mappedEmployee?.employee_code ? ` - ${mappedEmployee.employee_code}` : ''} - {group.rows.length} dias con marca - {group.missingWorkDays} faltas laborales - {group.holidayDays} festivos en rango
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => exportPreviewRows(group.rows, group.code)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-[#2a4038] hover:bg-gray-50"
                      >
                        <Download size={12} /> Exportar codigo
                      </button>
                    </div>
                    <div className="space-y-3 p-3">
                      {previewCalendarMonths.map((month) => (
                        <div key={`${group.code}-${month.key}`} className="overflow-x-auto rounded-lg border border-gray-100">
                          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold capitalize text-gray-700">
                            {month.title}
                          </div>
                          <div className="grid min-w-[1120px] grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-[10px] font-semibold uppercase text-gray-400">
                            {WEEKDAY_LABELS.map((day) => (
                              <div key={day} className="px-2 py-2">{day.slice(0, 3)}</div>
                            ))}
                          </div>
                          <div className="grid min-w-[1120px] grid-cols-7">
                            {month.cells.map((date, index) => {
                              if (!date) return <div key={`empty-${group.code}-${month.key}-${index}`} className="min-h-[174px] border-b border-r border-gray-50 bg-gray-50/50" />;
                              const row = rowsByDate.get(date);
                              const holiday = previewHolidaysByDate.get(date);
                              const parameter = previewParametersByYear.get(Number(date.slice(0, 4)));
                              const holidayRate = parameter?.sunday_holiday_surcharge_pct ? `${parameter.sunday_holiday_surcharge_pct}%` : 'param. default';
                              const weekend = isWeekendDate(date);
                              const missing = !row;
                              const statusLabel = row
                                ? row.status === 'Completo'
                                  ? `${row.workedHours.toFixed(1)}h`
                                  : 'Revisar'
                                : holiday
                                  ? 'Festivo'
                                  : weekend
                                    ? 'Descanso'
                                    : 'Falto';
                              const statusColor: BadgeColor = row ? (row.status === 'Completo' ? 'green' : 'yellow') : holiday ? 'blue' : weekend ? 'gray' : 'red';
                              return (
                                <div
                                  key={`${group.code}-${date}`}
                                  className={`min-h-[174px] border-b border-r border-gray-50 p-2 ${missing && !holiday && !weekend ? 'bg-red-50/50' : holiday ? 'bg-blue-50/40' : 'bg-white'}`}
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="text-[11px] font-semibold text-gray-900">{parseLocalDate(date).getDate()}</span>
                                    <Badge label={statusLabel} color={statusColor} />
                                  </div>
                                  <p className="mt-1 truncate text-[10px] text-gray-500">{WEEKDAY_LABELS[mondayWeekdayIndex(date)]}</p>
                                  {holiday && (
                                    <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-blue-700">
                                      {holiday.name} · {holidayRate}
                                    </p>
                                  )}
                                  {row ? (
                                    <>
                                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                                        {([
                                          ['checkIn', 'Ent.'],
                                          ['breakStart', 'Alm.'],
                                          ['breakEnd', 'Reg.'],
                                          ['checkOut', 'Sal.'],
                                        ] as const).map(([field, label]) => (
                                          <label key={field} className="block">
                                            <span className="block text-[9px] font-semibold uppercase text-gray-400">{label}</span>
                                            <input
                                              type="time"
                                              value={row[field] === '-' ? '' : row[field].slice(0, 5)}
                                              onChange={(event) => updatePreviewTime(row.key, field, event.target.value)}
                                              className="mt-0.5 w-full rounded-md border border-gray-200 px-1.5 py-1 text-[11px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20"
                                            />
                                          </label>
                                        ))}
                                      </div>
                                      <p className="mt-1 text-[10px] font-semibold text-gray-600">{row.rawMarkCount} timbrada(s)</p>
                                      {row.analysis && <p className="mt-1 line-clamp-2 text-[10px] text-amber-700">{row.analysis}</p>}
                                    </>
                                  ) : (
                                    <p className="mt-2 text-[10px] text-gray-400">Sin marca</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
              ) : (
            <div className="overflow-auto max-h-[520px] border border-gray-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                    <th className="py-2 px-3">Empleado / codigo</th>
                    <th className="py-2 px-3">Dias</th>
                    <th className="py-2 px-3">Timbradas</th>
                    <th className="py-2 px-3">Hrs</th>
                    <th className="py-2 px-3">Diurnas</th>
                    <th className="py-2 px-3">Nocturnas</th>
                    <th className="py-2 px-3">Faltas</th>
                    <th className="py-2 px-3">Festivos</th>
                    <th className="py-2 px-3">Revision</th>
                    <th className="py-2 px-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {previewByCode.map((group) => {
                    const expanded = expandedPreviewCodes.has(group.code);
                    const mappedEmployee = employeeByBiometricCode.get(group.code);
                    return (
                      <Fragment key={group.code}>
                        <tr key={group.code} className="border-b border-gray-50 bg-white">
                          <td className="py-3 px-3">
                            <div className="text-sm font-semibold text-gray-900">{biometricCodeDisplayName(group.code, employeeByBiometricCode)}</div>
                            <div className="mt-1 font-mono text-[11px] text-gray-400">
                              Codigo {group.code}{mappedEmployee?.employee_code ? ` - ${mappedEmployee.employee_code}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3">{group.rows.length}</td>
                          <td className="py-3 px-3">{group.rawMarkCount}</td>
                          <td className="py-3 px-3 font-semibold">{group.totalHours.toFixed(2)}</td>
                          <td className="py-3 px-3 text-emerald-700">{group.dayHours.toFixed(2)}</td>
                          <td className="py-3 px-3 text-indigo-700">{group.nightHours.toFixed(2)}</td>
                          <td className="py-3 px-3">
                            <Badge label={group.missingWorkDays} color={group.missingWorkDays > 0 ? 'red' : 'green'} />
                          </td>
                          <td className="py-3 px-3">
                            <Badge label={group.holidayDays} color={group.holidayDays > 0 ? 'blue' : 'gray'} />
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              label={group.reviewDays > 0 ? `${group.reviewDays} dia(s)` : 'OK'}
                              color={group.reviewDays > 0 ? 'yellow' : 'green'}
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => exportPreviewRows(group.rows, group.code)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-[#2a4038] hover:bg-gray-50"
                              >
                                <Download size={12} /> Excel
                              </button>
                            <button
                              type="button"
                              onClick={() => togglePreviewCode(group.code)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-[#2a4038] hover:bg-gray-50"
                            >
                              {expanded ? 'Ocultar' : 'Ver mas'}
                            </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${group.code}-detail`} className="border-b border-gray-100 bg-gray-50/60">
                            <td colSpan={10} className="px-3 py-3">
                              <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                                      <th className="py-2 px-3">Dia</th>
                                      <th className="py-2 px-3">Timbradas</th>
                                      <th className="py-2 px-3">Entrada</th>
                                      <th className="py-2 px-3">Inicio almuerzo</th>
                                      <th className="py-2 px-3">Fin almuerzo</th>
                                      <th className="py-2 px-3">Salida</th>
                                      <th className="py-2 px-3">Hrs</th>
                                      <th className="py-2 px-3">Diurnas</th>
                                      <th className="py-2 px-3">Nocturnas</th>
                                      <th className="py-2 px-3">Festivo</th>
                                      <th className="py-2 px-3">Estado</th>
                                      <th className="py-2 px-3 min-w-[220px]">Analisis</th>
                                      <th className="py-2 px-3 min-w-[180px]">Todas</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.rows.map((row) => (
                                      <tr key={row.key} className="border-b border-gray-50 last:border-0">
                                        <td className="py-2 px-3 whitespace-nowrap">{formatDate(row.date)}</td>
                                        <td className="py-2 px-3">
                                          {row.rawMarkCount}
                                        </td>
                                        {(['checkIn', 'breakStart', 'breakEnd', 'checkOut'] as const).map((field) => (
                                          <td key={field} className="py-2 px-3">
                                            <input
                                              type="time"
                                              value={row[field] === '-' ? '' : row[field].slice(0, 5)}
                                              onChange={(event) => updatePreviewTime(row.key, field, event.target.value)}
                                              className="w-[96px] rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20"
                                            />
                                          </td>
                                        ))}
                                        <td className="py-2 px-3 font-semibold">{row.workedHours.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-emerald-700">{row.dayHours.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-indigo-700">{row.nightHours.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-blue-700">{previewHolidaysByDate.get(row.date)?.name ?? '-'}</td>
                                        <td className="py-2 px-3">
                                          <Badge label={row.status} color={row.status === 'Completo' ? 'green' : 'yellow'} />
                                        </td>
                                        <td className="py-2 px-3 text-amber-700">{row.analysis || '-'}</td>
                                        <td className="py-2 px-3 text-gray-500">{row.marks}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
              )}
            </>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Mapeo de códigos del reloj a empleados</p>
          <SecondaryButton onClick={() => { setMappingInitialCode(undefined); setShowMappingModal(true); }} icon={<Plus size={13} />}>Nuevo mapeo</SecondaryButton>
        </div>
        {mappings.length === 0 ? (
          <EmptyState title="Sin mapeos registrados" description="Sin mapeo, las marcaciones del reloj no se pueden asociar a un empleado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3">Código del reloj</th>
                  <th className="py-2 pr-3">Empleado</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {paginatedMappings.map((mapping) => (
                  <tr key={mapping.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-mono">{mapping.biometric_code}</td>
                    <td className="py-2 pr-3">{employeeName(employeeById.get(mapping.employee))}</td>
                    <td className="py-2 pr-3">
                      <Badge label={mapping.is_active ? 'Activo' : 'Inactivo'} color={mapping.is_active ? 'green' : 'gray'} />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button onClick={() => void handleDeleteMapping(mapping.id)} className="text-red-500 hover:underline">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mappings.length > BIOMETRIC_MAPPING_PAGE_SIZE && (
              <div className="mt-3">
                <Pagination
                  currentPage={Math.min(mappingPage, mappingTotalPages)}
                  totalPages={mappingTotalPages}
                  totalItems={mappings.length}
                  itemsPerPage={BIOMETRIC_MAPPING_PAGE_SIZE}
                  itemsPerPageOptions={[6]}
                  onPageChange={setMappingPage}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Marcaciones pendientes de corrección</p>
        {pending.length === 0 ? (
          <EmptyState title="Sin marcaciones pendientes" description="Todas las asistencias tienen entrada y salida completas." />
        ) : (
          <div className="space-y-2">
            {pending.map((attendance) => (
              <div key={attendance.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{employeeName(employeeById.get(attendance.employee))}</p>
                  <p className="text-[11px] text-gray-400">
                    {formatDate(attendance.date)} · Entrada: {attendance.check_in ? formatDateTime(attendance.check_in) : 'Sin registrar'} · Salida: {attendance.check_out ? formatDateTime(attendance.check_out) : 'Sin registrar'}
                  </p>
                </div>
                <SecondaryButton onClick={() => setShowCorrectionModal(attendance)}>Corregir</SecondaryButton>
              </div>
            ))}
          </div>
        )}
      </Card>

      <NewBiometricMappingModal
        open={showMappingModal}
        employees={employees}
        devices={devices}
        mappings={mappings}
        initialCode={mappingInitialCode}
        onClose={() => setShowMappingModal(false)}
        onCreated={async () => {
          await load();
        }}
      />
      <NewBiometricDeviceModal
        open={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        onCreated={async () => {
          setShowDeviceModal(false);
          await load();
        }}
      />
      {showCorrectionModal && (
        <CorrectAttendanceModal
          attendance={showCorrectionModal}
          employeeName={employeeName(employeeById.get(showCorrectionModal.employee))}
          onClose={() => setShowCorrectionModal(null)}
          onCorrected={async () => {
            setShowCorrectionModal(null);
            await load();
          }}
        />
      )}
      <AttendanceIntelligenceModal
        open={showIntelligenceModal}
        settings={intelligenceSettings}
        onClose={() => setShowIntelligenceModal(false)}
        onSaved={async () => {
          setShowIntelligenceModal(false);
          await load();
        }}
      />
    </div>
  );
}

function AttendanceIntelligenceModal({
  open,
  settings,
  onClose,
  onSaved,
}: {
  open: boolean;
  settings: AttendanceIntelligenceSettings | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [duplicateWindow, setDuplicateWindow] = useState('15');
  const [proximityWindow, setProximityWindow] = useState('120');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDuplicateWindow(String(settings?.duplicate_punch_window_minutes ?? 15));
    setProximityWindow(String(settings?.schedule_proximity_minutes ?? 120));
  }, [open, settings]);

  const handleSubmit = async () => {
    const duplicateMinutes = Number(duplicateWindow);
    const proximityMinutes = Number(proximityWindow);
    if (!duplicateMinutes || duplicateMinutes <= 0 || !proximityMinutes || proximityMinutes <= 0) {
      toast.warning('Ambos valores deben ser números mayores a cero.');
      return;
    }
    setSaving(true);
    try {
      await updateAttendanceIntelligenceSettings({
        duplicate_punch_window_minutes: duplicateMinutes,
        schedule_proximity_minutes: proximityMinutes,
      });
      toast.success('Configuración guardada');
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error(describeApiError(error, 'No se pudo guardar la configuración'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Inteligencia de marcaciones" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ventana de duplicado (minutos)</span>
          <input type="number" min={1} value={duplicateWindow} onChange={(e) => setDuplicateWindow(e.target.value)} className={inputCls} />
          <p className="text-[11px] text-gray-400 mt-1">Si un empleado marca dos veces con menos de esta diferencia, se asume que la segunda fue por error (creyó que no había marcado) y se descarta.</p>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tolerancia al horario esperado (minutos)</span>
          <input type="number" min={1} value={proximityWindow} onChange={(e) => setProximityWindow(e.target.value)} className={inputCls} />
          <p className="text-[11px] text-gray-400 mt-1">Al interpretar un día con marcaciones incompletas, se usa esta cercanía a la hora de entrada/salida esperada del empleado para decidir qué marcación es cuál.</p>
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NewBiometricMappingModal({
  open,
  employees,
  devices,
  mappings,
  initialCode,
  onClose,
  onCreated,
}: {
  open: boolean;
  employees: Employee[];
  devices: BiometricDevice[];
  mappings: EmployeeBiometricId[];
  initialCode?: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [biometricCode, setBiometricCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedCode, setLastSavedCode] = useState('');

  useEffect(() => {
    if (open) {
      setEmployeeId('');
      setDeviceId('');
      setBiometricCode(initialCode ?? '');
      setLastSavedCode('');
    }
  }, [open, initialCode]);

  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const selectedEmployeeMappings = useMemo(() => {
    if (!employeeId) return [];
    return mappings
      .filter((mapping) => mapping.employee === employeeId)
      .sort((left, right) => left.biometric_code.localeCompare(right.biometric_code, 'es', { numeric: true }));
  }, [mappings, employeeId]);

  const handleSubmit = async () => {
    if (!employeeId || !biometricCode.trim()) {
      toast.warning('Selecciona el empleado e indica el código del reloj.');
      return;
    }
    setSaving(true);
    try {
      const savedCode = biometricCode.trim();
      await createEmployeeBiometricId({ employee: employeeId, biometric_code: savedCode, device: deviceId || null });
      setLastSavedCode(savedCode);
      setBiometricCode('');
      toast.success(`Mapeo registrado: codigo ${savedCode}`);
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el mapeo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo mapeo de código biométrico" open={open} onClose={onClose}>
      <div className="space-y-4">
        {lastSavedCode && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            Guardado codigo {lastSavedCode}. Puedes ingresar otro codigo para el mismo empleado.
          </div>
        )}
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Empleado</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={selectCls}>
            <option value="">Selecciona...</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employeeName(employee)}</option>
            ))}
          </select>
        </label>
        {employeeId && (
          <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Codigos guardados de este empleado</p>
            {selectedEmployeeMappings.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">Todavia no tiene codigos biometricos guardados.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedEmployeeMappings.map((mapping) => (
                  <span key={mapping.id} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700">
                    <span className="font-mono font-semibold">{mapping.biometric_code}</span>
                    <span className="text-gray-400">{mapping.device ? deviceById.get(mapping.device)?.name ?? 'Dispositivo' : 'Sin dispositivo'}</span>
                    {!mapping.is_active && <span className="text-red-500">Inactivo</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Código en el reloj biométrico</span>
          <input value={biometricCode} onChange={(e) => setBiometricCode(e.target.value)} placeholder="Ej: 610" className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dispositivo (opcional)</span>
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={selectCls}>
            <option value="">Sin especificar</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>{device.name}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cerrar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar codigo'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function NewBiometricDeviceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setLocation('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.warning('Indica el nombre del dispositivo.');
      return;
    }
    setSaving(true);
    try {
      await createBiometricDevice({ name: name.trim(), location: location.trim() });
      toast.success('Dispositivo registrado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el dispositivo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo reloj biométrico" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Reloj sede principal" className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ubicación (opcional)</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar dispositivo'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function toTimeInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  if (!timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

function CorrectAttendanceModal({
  attendance,
  employeeName: name,
  onClose,
  onCorrected,
}: {
  attendance: Attendance;
  employeeName: string;
  onClose: () => void;
  onCorrected: () => Promise<void>;
}) {
  const toast = useToast();
  const [checkIn, setCheckIn] = useState(toTimeInputValue(attendance.check_in));
  const [checkOut, setCheckOut] = useState(toTimeInputValue(attendance.check_out));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.warning('Indica el motivo de la corrección.');
      return;
    }
    setSaving(true);
    try {
      await correctAttendance(attendance.id, {
        check_in: combineDateAndTime(attendance.date, checkIn),
        check_out: combineDateAndTime(attendance.date, checkOut),
        reason: reason.trim(),
      });
      toast.success('Asistencia corregida');
      await onCorrected();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo corregir la asistencia');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Corregir asistencia" open onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-gray-500">{name} · {formatDate(attendance.date)}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Entrada</span>
            <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Salida</span>
            <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Motivo de la corrección</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Ej: Olvidó marcar la salida, confirmado con el jefe de área." />
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar corrección'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Festivos y parámetros legales ───────────────────────── */

function HolidaysSection() {
  const toast = useToast();
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [parameters, setParameters] = useState<PayrollLegalParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [showParamModal, setShowParamModal] = useState(false);

  const load = useCallback(async (targetYear: number) => {
    setLoading(true);
    try {
      const [holidaysList, parametersList] = await Promise.all([
        getPublicHolidays({ year: targetYear }),
        getPayrollLegalParameters(),
      ]);
      setHolidays(holidaysList);
      setParameters(parametersList);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la información de festivos y parámetros');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(year);
  }, [load, year]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const created = await generateYearHolidays(year);
      toast.success(created.length > 0 ? `${created.length} festivo(s) generado(s)` : 'El catálogo de ese año ya estaba completo');
      await load(year);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el calendario de festivos');
    } finally {
      setGenerating(false);
    }
  };

  const currentParameter = parameters.find((p) => p.year === year);

  if (loading) return <LoadingState label="Cargando festivos y parámetros..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Año</span>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls} />
          </label>
          <SecondaryButton onClick={() => void handleGenerate()} disabled={generating} icon={<CalendarDays size={13} />}>
            {generating ? 'Generando...' : 'Generar festivos del año'}
          </SecondaryButton>
        </div>

        {holidays.length === 0 ? (
          <EmptyState title={`Sin festivos registrados para ${year}`} description="Usa 'Generar festivos del año' para pre-poblar el calendario colombiano." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((holiday) => (
                  <tr key={holiday.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3">{formatDate(holiday.civil_date)}</td>
                    <td className="py-2 pr-3">{holiday.name}</td>
                    <td className="py-2 pr-3 text-gray-400">
                      {holiday.kind === 'FIXED' ? 'Fecha fija' : holiday.kind === 'EASTER_BASED' ? 'Semana Santa' : 'Trasladado a lunes'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Parámetros legales {year}</p>
          <SecondaryButton onClick={() => setShowParamModal(true)} icon={<Plus size={13} />}>
            {currentParameter ? 'Editar' : 'Registrar'}
          </SecondaryButton>
        </div>
        {!currentParameter ? (
          <EmptyState title={`Sin parámetros legales para ${year}`} description="SMMLV, auxilio de transporte y porcentajes de salud/pensión no están configurados." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ParamField label="SMMLV" value={formatMoney(currentParameter.minimum_wage)} />
            <ParamField label="Auxilio de transporte" value={formatMoney(currentParameter.transport_allowance_amount)} />
            <ParamField label="Tope aux. transporte" value={`${currentParameter.transport_allowance_salary_cap_factor} SMMLV`} />
            <ParamField label="Salud (empleado)" value={`${currentParameter.health_employee_pct}%`} />
            <ParamField label="Pensión (empleado)" value={`${currentParameter.pension_employee_pct}%`} />
            <ParamField label="Divisor de horas mensual" value={currentParameter.monthly_hours_divisor_default} />
            <ParamField label="Recargo ordinaria nocturna" value={currentParameter.night_ordinary_surcharge_pct ? `${currentParameter.night_ordinary_surcharge_pct}%` : '35% (default)'} />
            <ParamField label="Recargo extra diurna" value={currentParameter.day_extra_surcharge_pct ? `${currentParameter.day_extra_surcharge_pct}%` : '25% (default)'} />
            <ParamField label="Recargo extra nocturna" value={currentParameter.night_extra_surcharge_pct ? `${currentParameter.night_extra_surcharge_pct}%` : '75% (default)'} />
            <ParamField label="Recargo dominical/festivo" value={currentParameter.sunday_holiday_surcharge_pct ? `${currentParameter.sunday_holiday_surcharge_pct}%` : 'Escalonado por fecha (default)'} />
          </div>
        )}
      </Card>

      <LegalParameterModal
        open={showParamModal}
        year={year}
        existing={currentParameter}
        onClose={() => setShowParamModal(false)}
        onSaved={async () => {
          setShowParamModal(false);
          await load(year);
        }}
      />
    </div>
  );
}

function ParamField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

function LegalParameterModal({
  open,
  year,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  year: number;
  existing: PayrollLegalParameter | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [minimumWage, setMinimumWage] = useState('');
  const [transportAllowance, setTransportAllowance] = useState('');
  const [capFactor, setCapFactor] = useState('2');
  const [healthPct, setHealthPct] = useState('4');
  const [pensionPct, setPensionPct] = useState('4');
  const [monthlyDivisor, setMonthlyDivisor] = useState('230');
  const [nightOrdinaryPct, setNightOrdinaryPct] = useState('');
  const [dayExtraPct, setDayExtraPct] = useState('');
  const [nightExtraPct, setNightExtraPct] = useState('');
  const [sundayHolidayPct, setSundayHolidayPct] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMinimumWage(existing?.minimum_wage ?? '');
    setTransportAllowance(existing?.transport_allowance_amount ?? '');
    setCapFactor(existing?.transport_allowance_salary_cap_factor ?? '2');
    setHealthPct(existing?.health_employee_pct ?? '4');
    setPensionPct(existing?.pension_employee_pct ?? '4');
    setMonthlyDivisor(existing?.monthly_hours_divisor_default ?? '230');
    setNightOrdinaryPct(existing?.night_ordinary_surcharge_pct ?? '');
    setDayExtraPct(existing?.day_extra_surcharge_pct ?? '');
    setNightExtraPct(existing?.night_extra_surcharge_pct ?? '');
    setSundayHolidayPct(existing?.sunday_holiday_surcharge_pct ?? '');
  }, [open, existing]);

  const handleSubmit = async () => {
    if (!minimumWage) {
      toast.warning('Indica el valor del SMMLV.');
      return;
    }
    setSaving(true);
    try {
      const surchargeFields = {
        night_ordinary_surcharge_pct: nightOrdinaryPct === '' ? null : nightOrdinaryPct,
        day_extra_surcharge_pct: dayExtraPct === '' ? null : dayExtraPct,
        night_extra_surcharge_pct: nightExtraPct === '' ? null : nightExtraPct,
        sunday_holiday_surcharge_pct: sundayHolidayPct === '' ? null : sundayHolidayPct,
      };
      if (existing) {
        await updatePayrollLegalParameter(existing.id, {
          minimum_wage: minimumWage,
          transport_allowance_amount: transportAllowance || 0,
          transport_allowance_salary_cap_factor: capFactor,
          health_employee_pct: healthPct,
          pension_employee_pct: pensionPct,
          monthly_hours_divisor_default: monthlyDivisor,
          ...surchargeFields,
        });
      } else {
        await createPayrollLegalParameter({
          year,
          minimum_wage: minimumWage,
          transport_allowance_amount: transportAllowance || 0,
          transport_allowance_salary_cap_factor: capFactor,
          health_employee_pct: healthPct,
          pension_employee_pct: pensionPct,
          monthly_hours_divisor_default: monthlyDivisor,
          ...surchargeFields,
        });
      }
      toast.success('Parámetros guardados');
      await onSaved();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los parámetros');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Parámetros legales ${year}`} open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">SMMLV</span>
            <input type="number" value={minimumWage} onChange={(e) => setMinimumWage(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Auxilio de transporte</span>
            <input type="number" value={transportAllowance} onChange={(e) => setTransportAllowance(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Tope aux. transporte (x SMMLV)</span>
            <input type="number" step="0.1" value={capFactor} onChange={(e) => setCapFactor(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Salud empleado %</span>
            <input type="number" step="0.1" value={healthPct} onChange={(e) => setHealthPct(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Pensión empleado %</span>
            <input type="number" step="0.1" value={pensionPct} onChange={(e) => setPensionPct(e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Divisor de horas mensual</span>
          <input type="number" value={monthlyDivisor} onChange={(e) => setMonthlyDivisor(e.target.value)} className={inputCls} />
        </label>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Recargos de horas (%)</p>
          <p className="text-[11px] text-gray-400 mb-2">Déjalos vacíos para usar la regla legal vigente por fecha (incluye el recargo dominical escalonado 90% desde jul-2026 y 100% desde jul-2027). Solo edítalos si necesitas fijar un valor distinto para este año específico.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Ordinaria nocturna</span>
              <input type="number" step="0.1" placeholder="35 (default)" value={nightOrdinaryPct} onChange={(e) => setNightOrdinaryPct(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Extra diurna</span>
              <input type="number" step="0.1" placeholder="25 (default)" value={dayExtraPct} onChange={(e) => setDayExtraPct(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Extra nocturna</span>
              <input type="number" step="0.1" placeholder="75 (default)" value={nightExtraPct} onChange={(e) => setNightExtraPct(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dominical/festivo</span>
              <input type="number" step="0.1" placeholder="Escalonado por fecha" value={sundayHolidayPct} onChange={(e) => setSundayHolidayPct(e.target.value)} className={inputCls} />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar parámetros'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
