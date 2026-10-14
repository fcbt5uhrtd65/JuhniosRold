import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FileText, Eye, Loader2, RotateCcw, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  createPaymentAccount,
  getNextPaymentAccountNumber,
  getPaymentAccount,
  type PaymentAccount,
} from '../../services/payment-accounts.service';
import { amountInWords, formatCOP, type PaymentAccountDoc } from '../../utils/documentText';
import { downloadPaymentAccountPdf } from '../../utils/paymentAccountPdf';
import { downloadPaymentAccountDocx } from '../../utils/paymentAccountDocx';
import { RETENTION_LIMIT, UVT_RANGE_LIMIT, getRetentionAdvice } from '../../utils/retention';
import { PaymentAccountSignature } from './PaymentAccountSignature';
import { PaymentAccountViewer } from './PaymentAccountViewer';

// ---------- Estado del formulario ----------

export interface FormState {
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
  amount: string; // solo dígitos
  vat_note: string;
  contract_object: string;
  monthly_value: string; // solo dígitos
  bank_name: string;
  account_type: string;
  account_number: string;
  holder_same: boolean;
  account_holder: string;
  account_holder_document: string;
}

const DEFAULT_CLIENT_NAME = 'SURTITIENDAS GALVÁN S.A.S.';
const DEFAULT_CLIENT_NIT = '900.271.306-5';
const DRAFT_KEY = 'pa_draft_v1';
const SIGNATURE_KEY = 'pa_signature_v1';
const DOC_PATTERN = /^[0-9.\-\s]{5,30}$/;
const ACCOUNT_TYPES = ['Ahorros', 'Corriente', 'Nequi / Daviplata'];

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyForm(): FormState {
  return {
    issue_date: isoDate(new Date()),
    service_title: '',
    contractor_name: '',
    contractor_document: '',
    contractor_document_city: '',
    contractor_address: '',
    contractor_city: '',
    contractor_email: '',
    contractor_phone: '',
    client_name: DEFAULT_CLIENT_NAME,
    client_branch: '',
    client_document: DEFAULT_CLIENT_NIT,
    client_address: '',
    client_city: '',
    client_legal_rep: '',
    client_legal_rep_document: '',
    description: '',
    contract_reference: '',
    period_start: '',
    period_end: '',
    supervisor: '',
    requisition_number: '',
    requisition_date: '',
    amount: '',
    vat_note: 'No aplica',
    contract_object: '',
    monthly_value: '',
    bank_name: '',
    account_type: 'Ahorros',
    account_number: '',
    holder_same: true,
    account_holder: '',
    account_holder_document: '',
  };
}

const digits = (v: string) => v.replace(/\D/g, '');
const grouped = (v: string) => (v ? Number(v).toLocaleString('es-CO') : '');

function safeStorage<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/** Datos de prestador, cliente, pago, contrato y firma de una cuenta previa. */
function reuseFromAccount(a: PaymentAccount): Partial<FormState> {
  const holderSame =
    !a.account_holder ||
    (a.account_holder === a.contractor_name && a.account_holder_document === a.contractor_document);
  return {
    contractor_name: a.contractor_name,
    contractor_document: a.contractor_document,
    contractor_document_city: a.contractor_document_city,
    contractor_address: a.contractor_address,
    contractor_city: a.contractor_city,
    contractor_email: a.contractor_email,
    contractor_phone: a.contractor_phone,
    client_name: a.client_name,
    client_branch: a.client_branch,
    client_document: a.client_document,
    client_address: a.client_address,
    client_city: a.client_city,
    client_legal_rep: a.client_legal_rep,
    client_legal_rep_document: a.client_legal_rep_document,
    bank_name: a.bank_name,
    account_type: a.account_type || 'Ahorros',
    account_number: a.account_number,
    holder_same: holderSame,
    account_holder: holderSame ? '' : a.account_holder,
    account_holder_document: holderSame ? '' : a.account_holder_document,
    contract_reference: a.contract_reference,
    supervisor: a.supervisor,
    contract_object: a.contract_object,
    monthly_value: a.monthly_value ? String(Math.round(a.monthly_value)) : '',
  };
}

/** Rellena todo el formulario con una cuenta existente (Duplicar). */
function fullFromAccount(a: PaymentAccount): FormState {
  return {
    ...emptyForm(),
    ...reuseFromAccount(a),
    service_title: a.service_title,
    description: a.description,
    period_start: a.period_start,
    period_end: a.period_end,
    requisition_number: a.requisition_number,
    requisition_date: a.requisition_date,
    amount: String(Math.round(a.amount)),
    vat_note: a.vat_note || 'No aplica',
  };
}

// ---------- Piezas de UI compactas ----------

const inputCls =
  'w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs placeholder:text-gray-300 focus:border-[#2a4038] focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20';

function Card({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-800">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2a4038] text-[10px] text-white">{n}</span>
        {title}
      </h3>
      <div className="grid grid-cols-12 gap-2.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  span = 6,
  children,
}: {
  label: string;
  required?: boolean;
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  children: ReactNode;
}) {
  const spanCls = { 3: 'col-span-12 sm:col-span-3', 4: 'col-span-12 sm:col-span-4', 5: 'col-span-12 sm:col-span-5', 6: 'col-span-12 sm:col-span-6', 7: 'col-span-12 sm:col-span-7', 8: 'col-span-12 sm:col-span-8', 12: 'col-span-12' }[span];
  return (
    <label className={`${spanCls} flex flex-col gap-1`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

// ---------- Formulario ----------

export interface PaymentAccountFormProps {
  previousAccounts: PaymentAccount[];
  /** Cuenta completa (con firma) para precargar el formulario; `nonce` fuerza la recarga. */
  duplicate: { account: PaymentAccount; nonce: number } | null;
  onCreated: () => void;
}

export function PaymentAccountForm({ previousAccounts, duplicate, onCreated }: PaymentAccountFormProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [signature, setSignature] = useState('');
  const [useSignature, setUseSignature] = useState(true);
  /** null = seguir la sugerencia; true/false = el usuario forzó la opción. */
  const [forcedCertificate, setForcedCertificate] = useState<boolean | null>(null);
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [busy, setBusy] = useState(false);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [preview, setPreview] = useState<PaymentAccountDoc | null>(null);
  const hydrated = useRef(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // --- Borrador autoguardado y firma recordada ---
  useEffect(() => {
    const savedSignature = safeStorage(() => localStorage.getItem(SIGNATURE_KEY) ?? '', '');
    if (savedSignature) setSignature(savedSignature);
    const raw = safeStorage(() => localStorage.getItem(DRAFT_KEY), null);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as { form?: Partial<FormState>; forced?: boolean | null };
        if (draft.form) {
          setForm({ ...emptyForm(), ...draft.form });
          setForcedCertificate(draft.forced ?? null);
          setDraftRecovered(true);
        }
      } catch {
        // Borrador corrupto: se ignora.
      }
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const timer = setTimeout(() => {
      safeStorage(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, forced: forcedCertificate }));
      }, undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [form, forcedCertificate]);

  const updateSignature = (value: string) => {
    setSignature(value);
    safeStorage(() => {
      if (value) localStorage.setItem(SIGNATURE_KEY, value);
      else localStorage.removeItem(SIGNATURE_KEY);
    }, undefined);
  };

  // --- Duplicar desde el historial ---
  useEffect(() => {
    if (!duplicate) return;
    setForm(fullFromAccount(duplicate.account));
    setForcedCertificate(duplicate.account.no_withholding_letter);
    if (duplicate.account.signature) updateSignature(duplicate.account.signature);
    setDraftRecovered(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicate?.nonce]);

  const discardDraft = () => {
    safeStorage(() => localStorage.removeItem(DRAFT_KEY), undefined);
    setForm(emptyForm());
    setForcedCertificate(null);
    setDraftRecovered(false);
  };

  // --- Contratistas previos ---
  const [reusing, setReusing] = useState(false);
  const contractors = useMemo(() => {
    const seen = new Map<string, PaymentAccount>();
    previousAccounts.forEach((a) => {
      const key = `${a.contractor_name.toLowerCase()}|${a.contractor_document}`;
      if (!seen.has(key)) seen.set(key, a);
    });
    return Array.from(seen.values());
  }, [previousAccounts]);

  const applyPrevious = useCallback(
    async (id: string) => {
      setReusing(true);
      try {
        const full = await getPaymentAccount(id);
        setForm((prev) => ({ ...prev, ...reuseFromAccount(full) }));
        setForcedCertificate(full.no_withholding_letter ? true : null);
        if (full.signature) updateSignature(full.signature);
        toast.success('Datos del contratista copiados');
      } catch {
        toast.error('No se pudieron copiar los datos de la cuenta anterior');
      } finally {
        setReusing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );

  const handleContractorName = (value: string) => {
    set('contractor_name', value);
    // Autocompletado por nombre: solo si aún no se ha escrito la cédula.
    if (form.contractor_document) return;
    const match = contractors.find((a) => a.contractor_name.toLowerCase() === value.trim().toLowerCase());
    if (match) void applyPrevious(match.id);
  };

  // --- Valor y retención ---
  const amount = Number(form.amount) || 0;
  const monthly = Number(form.monthly_value) || 0;
  const advice = getRetentionAdvice(amount, monthly || null);
  const includeCertificate = forcedCertificate ?? advice.suggestCertificate;

  const setPeriod = (which: 'this' | 'previous') => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() - (which === 'previous' ? 1 : 0), 1);
    const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    setForm((prev) => ({ ...prev, period_start: isoDate(base), period_end: isoDate(last) }));
  };

  // --- Validación ---
  const holderName = form.holder_same ? form.contractor_name : form.account_holder;
  const holderDoc = form.holder_same ? form.contractor_document : form.account_holder_document;

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!form.contractor_name.trim()) list.push('nombre del prestador');
    if (!DOC_PATTERN.test(form.contractor_document.trim())) list.push('cédula del prestador (5–30 dígitos)');
    if (!form.client_name.trim()) list.push('nombre del cliente');
    if (!form.client_document.trim()) list.push('NIT del cliente');
    if (!form.issue_date) list.push('fecha');
    if (!form.service_title.trim()) list.push('título del servicio');
    if (!form.description.trim()) list.push('trabajo realizado');
    if (form.period_start && form.period_end && form.period_end < form.period_start) list.push('periodo válido');
    if (amount <= 0) list.push('valor total');
    if (includeCertificate && !form.contract_object.trim()) list.push('objeto del contrato');
    if (!form.holder_same) {
      if (!form.account_holder.trim()) list.push('titular de la cuenta');
      if (form.account_holder_document && !DOC_PATTERN.test(form.account_holder_document.trim())) {
        list.push('cédula del titular válida');
      }
      if (!form.account_holder_document.trim()) list.push('cédula del titular');
    }
    return list;
  }, [form, amount, includeCertificate]);

  const buildDoc = (number: number | null): PaymentAccountDoc => ({
    number,
    issue_date: form.issue_date,
    service_title: form.service_title.trim(),
    contractor_name: form.contractor_name.trim(),
    contractor_document: form.contractor_document.trim(),
    contractor_document_city: form.contractor_document_city.trim(),
    contractor_address: form.contractor_address.trim(),
    contractor_city: form.contractor_city.trim(),
    contractor_email: form.contractor_email.trim(),
    contractor_phone: form.contractor_phone.trim(),
    client_name: form.client_name.trim(),
    client_branch: form.client_branch.trim(),
    client_document: form.client_document.trim(),
    client_address: form.client_address.trim(),
    client_city: form.client_city.trim(),
    client_legal_rep: form.client_legal_rep.trim(),
    client_legal_rep_document: form.client_legal_rep_document.trim(),
    description: form.description.trim(),
    contract_reference: form.contract_reference.trim(),
    period_start: form.period_start,
    period_end: form.period_end,
    supervisor: form.supervisor.trim(),
    requisition_number: form.requisition_number.trim(),
    requisition_date: form.requisition_date,
    amount,
    vat_note: form.vat_note.trim() || 'No aplica',
    no_withholding_letter: includeCertificate,
    contract_object: includeCertificate ? form.contract_object.trim() : '',
    monthly_value: includeCertificate && monthly > 0 ? monthly : null,
    bank_name: form.bank_name.trim(),
    account_type: form.account_type,
    account_number: form.account_number.trim(),
    account_holder: holderName.trim(),
    account_holder_document: holderDoc.trim(),
    signature,
  });

  const openPreview = async () => {
    let next: number | null = null;
    try {
      next = await getNextPaymentAccountNumber();
    } catch {
      // Sin consecutivo disponible: el borrador se muestra sin número.
    }
    setPreview(buildDoc(next));
  };

  const clearForm = () => {
    safeStorage(() => localStorage.removeItem(DRAFT_KEY), undefined);
    setForm(emptyForm());
    setForcedCertificate(null);
    setDraftRecovered(false);
  };

  const download = async (doc: PaymentAccountDoc, kind: 'pdf' | 'docx', withSignature: boolean) => {
    if (kind === 'pdf') downloadPaymentAccountPdf(doc, { withSignature });
    else await downloadPaymentAccountDocx(doc, { withSignature });
  };

  const submit = async () => {
    if (missing.length > 0 || busy) return;
    setBusy(true);
    try {
      const { number: _ignored, ...input } = buildDoc(null);
      void _ignored;
      const created = await createPaymentAccount(input);
      toast.success(`Cuenta de cobro No. ${String(created.number).padStart(3, '0')} creada`);
      await download({ ...created, signature: created.signature || signature }, format, useSignature);
      // Se conservan prestador, cliente, pago y firma; se limpia el resto.
      setForm((prev) => ({
        ...emptyForm(),
        contractor_name: prev.contractor_name,
        contractor_document: prev.contractor_document,
        contractor_document_city: prev.contractor_document_city,
        contractor_address: prev.contractor_address,
        contractor_city: prev.contractor_city,
        contractor_email: prev.contractor_email,
        contractor_phone: prev.contractor_phone,
        client_name: prev.client_name,
        client_branch: prev.client_branch,
        client_document: prev.client_document,
        client_address: prev.client_address,
        client_city: prev.client_city,
        client_legal_rep: prev.client_legal_rep,
        client_legal_rep_document: prev.client_legal_rep_document,
        bank_name: prev.bank_name,
        account_type: prev.account_type,
        account_number: prev.account_number,
        holder_same: prev.holder_same,
        account_holder: prev.account_holder,
        account_holder_document: prev.account_holder_document,
      }));
      setForcedCertificate(null);
      safeStorage(() => localStorage.removeItem(DRAFT_KEY), undefined);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la cuenta de cobro');
    } finally {
      setBusy(false);
    }
  };

  const monthLimit = `$${RETENTION_LIMIT.toLocaleString('es-CO')}`;

  return (
    <div>
      {draftRecovered && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>Recuperamos el borrador que dejaste sin terminar.</span>
          <button type="button" onClick={discardDraft} className="inline-flex items-center gap-1 font-semibold underline">
            <X size={12} /> Descartar
          </button>
        </div>
      )}

      {/* Mismo contratista de antes */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#2a4038]/15 bg-[#2a4038]/5 px-3 py-2">
        <span className="text-xs font-semibold text-[#2a4038]">¿Mismo contratista de antes?</span>
        <select
          className={`${inputCls} max-w-xs`}
          defaultValue=""
          disabled={reusing || contractors.length === 0}
          onChange={(e) => {
            if (e.target.value) void applyPrevious(e.target.value);
            e.target.value = '';
          }}
        >
          <option value="">{contractors.length ? 'Selecciona una cuenta anterior…' : 'Aún no hay cuentas anteriores'}</option>
          {contractors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.contractor_name} · {a.client_name}
            </option>
          ))}
        </select>
        {reusing && <Loader2 size={14} className="animate-spin text-[#2a4038]" />}
        <span className="text-[10px] text-gray-500">Copia prestador, cliente, pago, contrato y firma.</span>
      </div>

      <datalist id="pa-contractors">
        {contractors.map((a) => (
          <option key={a.id} value={a.contractor_name} />
        ))}
      </datalist>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card n={1} title="Prestador">
          <Field label="Nombre completo" required span={12}>
            <input
              className={inputCls}
              list="pa-contractors"
              value={form.contractor_name}
              onChange={(e) => handleContractorName(e.target.value)}
              placeholder="Nombre del contratista"
            />
          </Field>
          <Field label="Cédula" required span={6}>
            <input
              className={inputCls}
              value={form.contractor_document}
              onChange={(e) => set('contractor_document', e.target.value.replace(/[^0-9.\-\s]/g, ''))}
              placeholder="1.234.567.890"
              inputMode="numeric"
            />
          </Field>
          <Field label="Ciudad de expedición" span={6}>
            <input className={inputCls} value={form.contractor_document_city} onChange={(e) => set('contractor_document_city', e.target.value)} />
          </Field>
          <Field label="Dirección" span={7}>
            <input className={inputCls} value={form.contractor_address} onChange={(e) => set('contractor_address', e.target.value)} />
          </Field>
          <Field label="Ciudad" span={5}>
            <input className={inputCls} value={form.contractor_city} onChange={(e) => set('contractor_city', e.target.value)} />
          </Field>
          <Field label="Correo" span={7}>
            <input type="email" className={inputCls} value={form.contractor_email} onChange={(e) => set('contractor_email', e.target.value)} />
          </Field>
          <Field label="Teléfono" span={5}>
            <input className={inputCls} value={form.contractor_phone} onChange={(e) => set('contractor_phone', e.target.value)} />
          </Field>
        </Card>

        <Card n={2} title="Cliente">
          <Field label="Razón social" required span={12}>
            <input className={inputCls} value={form.client_name} onChange={(e) => set('client_name', e.target.value)} />
          </Field>
          <Field label="Sede" span={6}>
            <input className={inputCls} value={form.client_branch} onChange={(e) => set('client_branch', e.target.value)} />
          </Field>
          <Field label="NIT" required span={6}>
            <input className={inputCls} value={form.client_document} onChange={(e) => set('client_document', e.target.value)} />
          </Field>
          <Field label="Dirección" span={7}>
            <input className={inputCls} value={form.client_address} onChange={(e) => set('client_address', e.target.value)} />
          </Field>
          <Field label="Ciudad" span={5}>
            <input className={inputCls} value={form.client_city} onChange={(e) => set('client_city', e.target.value)} />
          </Field>
          <Field label="Representante legal" span={7}>
            <input className={inputCls} value={form.client_legal_rep} onChange={(e) => set('client_legal_rep', e.target.value)} />
          </Field>
          <Field label="Cédula del representante" span={5}>
            <input className={inputCls} value={form.client_legal_rep_document} onChange={(e) => set('client_legal_rep_document', e.target.value)} />
          </Field>
        </Card>
      </div>

      <div className="mt-3">
        <Card n={3} title="Documento y concepto">
          <Field label="Fecha" required span={3}>
            <input type="date" className={inputCls} value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} />
          </Field>
          <Field label="Título del servicio" required span={8}>
            <input className={inputCls} value={form.service_title} onChange={(e) => set('service_title', e.target.value)} placeholder="Servicios de desarrollo web y móvil" />
          </Field>
          <Field label="Trabajo realizado" required span={12}>
            <textarea className={`${inputCls} min-h-[60px]`} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Periodo desde" span={3}>
            <input type="date" className={inputCls} value={form.period_start} onChange={(e) => set('period_start', e.target.value)} />
          </Field>
          <Field label="Periodo hasta" span={3}>
            <input type="date" className={inputCls} min={form.period_start || undefined} value={form.period_end} onChange={(e) => set('period_end', e.target.value)} />
          </Field>
          <div className="col-span-12 flex items-end gap-2 pb-1 text-[11px] sm:col-span-6">
            <button type="button" className="font-semibold text-[#2a4038] underline" onClick={() => setPeriod('this')}>Este mes</button>
            <span className="text-gray-300">·</span>
            <button type="button" className="font-semibold text-[#2a4038] underline" onClick={() => setPeriod('previous')}>Mes anterior</button>
          </div>
          <Field label="Referencia del contrato" span={4}>
            <input className={inputCls} value={form.contract_reference} onChange={(e) => set('contract_reference', e.target.value)} />
          </Field>
          <Field label="Interventor" span={4}>
            <input className={inputCls} value={form.supervisor} onChange={(e) => set('supervisor', e.target.value)} />
          </Field>
          <Field label="No. requisición" span={4}>
            <input className={inputCls} value={form.requisition_number} onChange={(e) => set('requisition_number', e.target.value)} />
          </Field>
          <Field label="Fecha de requisición" span={4}>
            <input type="date" className={inputCls} value={form.requisition_date} onChange={(e) => set('requisition_date', e.target.value)} />
          </Field>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card n={4} title="Valor y retención">
          <Field label="Valor total (COP)" required span={6}>
            <input
              className={inputCls}
              inputMode="numeric"
              value={grouped(form.amount)}
              onChange={(e) => set('amount', digits(e.target.value))}
              placeholder="3.500.000"
            />
          </Field>
          <Field label="IVA" span={6}>
            <input className={inputCls} value={form.vat_note} onChange={(e) => set('vat_note', e.target.value)} />
          </Field>
          {amount > 0 && (
            <p className="col-span-12 text-[11px] font-semibold uppercase text-red-700">{amountInWords(amount)}</p>
          )}

          <div className="col-span-12 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
            <label className="flex items-start gap-2 text-xs font-medium text-gray-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeCertificate}
                onChange={(e) => setForcedCertificate(e.target.checked)}
              />
              Incluir certificado bajo juramento para no practicar retención
            </label>
            <p className={`mt-1.5 text-[11px] ${advice.withinZeroRate ? 'text-emerald-700' : advice.base ? 'text-amber-700' : 'text-gray-500'}`}>
              {advice.message}
            </p>
            {forcedCertificate !== null && (
              <button type="button" className="mt-1 text-[11px] font-semibold text-[#2a4038] underline" onClick={() => setForcedCertificate(null)}>
                Volver a la sugerencia
              </button>
            )}
            {includeCertificate && (
              <div className="mt-2 grid grid-cols-12 gap-2.5">
                <Field label="Objeto del contrato" required span={12}>
                  <textarea className={`${inputCls} min-h-[48px]`} value={form.contract_object} onChange={(e) => set('contract_object', e.target.value)} placeholder="desarrollo web y móvil" />
                </Field>
                <Field label="Valor mensual del contrato" span={12}>
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    value={grouped(form.monthly_value)}
                    onChange={(e) => set('monthly_value', digits(e.target.value))}
                    placeholder="Vacío = usar el valor total"
                  />
                </Field>
                <p className="col-span-12 text-[10px] text-gray-400">
                  Límite {UVT_RANGE_LIMIT} UVT = {monthLimit} mensuales.
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid gap-3">
          <Card n={5} title="Información de pago">
            <Field label="Banco" span={6}>
              <input className={inputCls} value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
            </Field>
            <Field label="Tipo de cuenta" span={6}>
              <select className={inputCls} value={form.account_type} onChange={(e) => set('account_type', e.target.value)}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Número de cuenta" span={12}>
              <input className={inputCls} value={form.account_number} onChange={(e) => set('account_number', e.target.value)} />
            </Field>
            <label className="col-span-12 flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={form.holder_same} onChange={(e) => set('holder_same', e.target.checked)} />
              El titular es el prestador
            </label>
            {!form.holder_same && (
              <>
                <Field label="Titular" required span={7}>
                  <input className={inputCls} value={form.account_holder} onChange={(e) => set('account_holder', e.target.value)} />
                </Field>
                <Field label="Cédula del titular" required span={5}>
                  <input
                    className={inputCls}
                    value={form.account_holder_document}
                    onChange={(e) => set('account_holder_document', e.target.value.replace(/[^0-9.\-\s]/g, ''))}
                  />
                </Field>
              </>
            )}
          </Card>

          <Card n={6} title="Firma">
            <div className="col-span-12">
              <PaymentAccountSignature value={signature} onChange={updateSignature} onError={(m) => toast.error(m)} />
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={useSignature} onChange={(e) => setUseSignature(e.target.checked)} />
                Poner la firma en el documento
              </label>
              {!useSignature && <p className="text-[10px] text-gray-400">Quedará solo la línea en blanco para firmar a mano.</p>}
            </div>
          </Card>
        </div>
      </div>

      {/* Barra inferior fija */}
      <div className="sticky bottom-0 z-30 mt-4 rounded-xl border border-gray-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[140px]">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Valor total</p>
            <p className="text-sm font-bold text-gray-900">{formatCOP(amount)} COP</p>
          </div>
          <p className={`flex-1 text-xs ${missing.length ? 'text-amber-700' : 'text-emerald-700'}`}>
            {missing.length ? `Falta: ${missing.join(', ')}` : 'Listo para crear'}
          </p>
          <button type="button" onClick={clearForm} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <RotateCcw size={13} /> Limpiar
          </button>
          <button type="button" onClick={openPreview} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            <Eye size={13} /> Visualizar documento
          </button>
          <select className={`${inputCls} w-auto`} value={format} onChange={(e) => setFormat(e.target.value as 'pdf' | 'docx')} aria-label="Formato">
            <option value="pdf">PDF</option>
            <option value="docx">Word</option>
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={missing.length > 0 || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2a4038] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3d5c4e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            Crear y descargar {format === 'pdf' ? 'PDF' : 'Word'}
          </button>
        </div>
      </div>

      {preview && (
        <PaymentAccountViewer
          account={preview}
          title={preview.number ? `Borrador · Cuenta de cobro No. ${String(preview.number).padStart(3, '0')}` : 'Borrador · Cuenta de cobro'}
          initialWithSignature={useSignature}
          onClose={() => setPreview(null)}
          onDownloadPdf={(w) => void download(preview, 'pdf', w)}
          onDownloadWord={(w) => download(preview, 'docx', w)}
        />
      )}
    </div>
  );
}
