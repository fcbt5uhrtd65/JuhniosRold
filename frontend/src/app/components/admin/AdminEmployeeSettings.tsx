import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Eye, EyeOff, FileUp, HeartPulse, Landmark, LockKeyhole, Save, ShieldCheck, Shirt, UserRound } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  getMyEmployeeProfile,
  updateMyEmployeeProfile,
  type BankAccountType,
  type DocumentType,
  type Employee,
  type EmployeePayload,
  type Gender,
  type MaritalStatus,
} from '../../services/employees.service';
import {
  createMyEmployeeDocument,
  getMyActiveWorkSchedule,
  getMyEmployeeDocuments,
  type EmployeeDocument,
  type EmployeeDocumentType,
  type EmployeeWorkSchedule,
} from '../../services/human-resources.service';
import {
  ARL_OPTIONS,
  ARL_RISK_LEVEL_OPTIONS,
  BANK_OPTIONS,
  COMPENSATION_FUND_OPTIONS,
  EPS_OPTIONS,
  PENSION_FUND_OPTIONS,
  SEVERANCE_FUND_OPTIONS,
} from '../../utils/socialSecurityCatalog';
import { Badge, type BadgeColor, Card, EmptyState, inputCls, LoadingState, selectCls } from './AdminUI';

type SettingsTab = 'personal' | 'dotacion' | 'social' | 'banking' | 'emergency' | 'documents' | 'security';

type ProfileForm = {
  document_type: DocumentType;
  document_number: string;
  document_issue_date: string;
  document_issue_place: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  residence_department: string;
  nationality: string;
  gender: Gender;
  marital_status: MaritalStatus;
  eps: string;
  pension_fund: string;
  severance_fund: string;
  arl: string;
  arl_risk_level: string;
  compensation_fund: string;
  bank_name: string;
  bank_account_type: BankAccountType;
  bank_account_number: string;
  bank_account_holder: string;
  bank_account_holder_document: string;
  uniform_sweater: string;
  uniform_pants: string;
  uniform_shoes: string;
  uniform_other: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_mobile: string;
  emergency_contact_alternate_phone: string;
  emergency_contact_address: string;
};

const EMPTY_PROFILE_FORM: ProfileForm = {
  document_type: '',
  document_number: '',
  document_issue_date: '',
  document_issue_place: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  residence_department: '',
  nationality: '',
  gender: '',
  marital_status: '',
  eps: '',
  pension_fund: '',
  severance_fund: '',
  arl: '',
  arl_risk_level: '',
  compensation_fund: '',
  bank_name: '',
  bank_account_type: '',
  bank_account_number: '',
  bank_account_holder: '',
  bank_account_holder_document: '',
  uniform_sweater: '',
  uniform_pants: '',
  uniform_shoes: '',
  uniform_other: '',
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_mobile: '',
  emergency_contact_alternate_phone: '',
  emergency_contact_address: '',
};

const TABS: Array<{ id: SettingsTab; label: string; icon: ComponentType<{ size?: number; className?: string }> }> = [
  { id: 'personal', label: 'Personal', icon: UserRound },
  { id: 'dotacion', label: 'Dotación', icon: Shirt },
  { id: 'social', label: 'Seguridad social', icon: ShieldCheck },
  { id: 'banking', label: 'Banco', icon: Landmark },
  { id: 'emergency', label: 'Emergencia', icon: HeartPulse },
  { id: 'documents', label: 'Documentos', icon: FileUp },
  { id: 'security', label: 'Contraseña', icon: LockKeyhole },
];

const DOCUMENT_TYPE_OPTIONS: Array<{ value: EmployeeDocumentType; label: string }> = [
  { value: 'ID_COPY', label: 'Cédula de Ciudadanía' },
  { value: 'RESUME', label: 'Hoja de vida con soportes' },
  { value: 'SIGNED_CONTRACT', label: 'Contrato firmado' },
  { value: 'BANK_CERTIFICATE', label: 'Certificado bancario' },
  { value: 'EPS_CERTIFICATE', label: 'Certificado EPS' },
  { value: 'PENSION_CERTIFICATE', label: 'Certificado de pensión' },
  { value: 'SEVERANCE_CERTIFICATE', label: 'Certificado de cesantías' },
  { value: 'ARL_CERTIFICATE', label: 'Certificado ARL' },
  { value: 'COMPENSATION_CERTIFICATE', label: 'Certificado Caja de Compensación' },
  { value: 'WORK_CERTIFICATE', label: 'Certificados laborales' },
  { value: 'OTHER', label: 'Otros documentos' },
];

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const REQUIRED_DOCUMENT_TYPES = new Set<EmployeeDocumentType>([
  'ID_COPY',
  'RESUME',
  'SIGNED_CONTRACT',
  'BANK_CERTIFICATE',
  'EPS_CERTIFICATE',
  'PENSION_CERTIFICATE',
  'SEVERANCE_CERTIFICATE',
  'ARL_CERTIFICATE',
  'COMPENSATION_CERTIFICATE',
]);

const EMPTY_DOCUMENT_FORM = {
  document_type: 'ID_COPY' as EmployeeDocumentType,
  name: 'Cédula de Ciudadanía',
  file: null as File | null,
  issued_at: '',
  expires_at: '',
  observations: '',
};

function employeeToForm(employee: Employee): ProfileForm {
  return {
    document_type: employee.document_type ?? '',
    document_number: employee.document_number ?? '',
    document_issue_date: employee.document_issue_date ?? '',
    document_issue_place: employee.document_issue_place ?? '',
    first_name: employee.first_name ?? '',
    last_name: employee.last_name ?? '',
    date_of_birth: employee.date_of_birth ?? '',
    email: employee.email ?? '',
    phone: employee.phone ?? '',
    address: employee.address ?? '',
    city: employee.city ?? '',
    residence_department: employee.residence_department ?? '',
    nationality: employee.nationality ?? '',
    gender: employee.gender ?? '',
    marital_status: employee.marital_status ?? '',
    eps: employee.eps ?? '',
    pension_fund: employee.pension_fund ?? '',
    severance_fund: employee.severance_fund ?? '',
    arl: employee.arl ?? '',
    arl_risk_level: employee.arl_risk_level ?? '',
    compensation_fund: employee.compensation_fund ?? '',
    bank_name: employee.bank_name ?? '',
    bank_account_type: employee.bank_account_type ?? '',
    bank_account_number: employee.bank_account_number ?? '',
    bank_account_holder: employee.bank_account_holder ?? '',
    bank_account_holder_document: employee.bank_account_holder_document ?? '',
    uniform_sweater: employee.uniform_sweater ?? '',
    uniform_pants: employee.uniform_pants ?? '',
    uniform_shoes: employee.uniform_shoes ?? '',
    uniform_other: employee.uniform_other ?? '',
    emergency_contact_name: employee.emergency_contact_name ?? '',
    emergency_contact_relationship: employee.emergency_contact_relationship ?? '',
    emergency_contact_mobile: employee.emergency_contact_mobile ?? '',
    emergency_contact_alternate_phone: employee.emergency_contact_alternate_phone ?? '',
    emergency_contact_address: employee.emergency_contact_address ?? '',
  };
}

function optionalDate(value: string) {
  return value || null;
}

function optionLabel(options: Array<{ value: string; label: string }>, value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function parseDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-CO');
  }
  return new Date(value).toLocaleDateString('es-CO');
}

function documentStatusBadge(status: EmployeeDocument['status']): BadgeColor {
  switch (status) {
    case 'LOADED':
      return 'green';
    case 'REJECTED':
    case 'EXPIRED':
      return 'red';
    case 'NOT_APPLICABLE':
      return 'gray';
    default:
      return 'yellow';
  }
}

function documentStatusLabel(status: EmployeeDocument['status']): string {
  const labels: Record<EmployeeDocument['status'], string> = {
    PENDING: 'Pendiente',
    LOADED: 'Cargado',
    REJECTED: 'Rechazado',
    EXPIRED: 'Vencido',
    NOT_APPLICABLE: 'No aplica',
  };
  return labels[status];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function DataListInput({
  label,
  value,
  options,
  listId,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  listId: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input value={value} onChange={(event) => onChange(event.target.value)} list={listId} className={inputCls} />
      <datalist id={listId}>
        {options.map((option) => <option key={option} value={option} />)}
      </datalist>
    </Field>
  );
}

export function AdminEmployeeSettings() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('personal');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [documentInputKey, setDocumentInputKey] = useState(0);
  const [documentForm, setDocumentForm] = useState({ ...EMPTY_DOCUMENT_FORM });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    user_password: '',
    user_password_confirm: '',
  });

  const [workSchedule, setWorkSchedule] = useState<EmployeeWorkSchedule | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      try {
        const [profileRes, documentsRes, scheduleRes] = await Promise.allSettled([
          getMyEmployeeProfile(),
          getMyEmployeeDocuments(),
          getMyActiveWorkSchedule(),
        ]);
        if (profileRes.status !== 'fulfilled') throw profileRes.reason;
        setEmployee(profileRes.value);
        setForm(employeeToForm(profileRes.value));
        setDocuments(documentsRes.status === 'fulfilled' ? documentsRes.value : []);
        setWorkSchedule(scheduleRes.status === 'fulfilled' ? scheduleRes.value : null);
      } catch (error) {
        console.error(error);
        toast.error('No se pudo cargar tu configuración');
      } finally {
        setIsLoading(false);
      }
    }
    void loadProfile();
  }, [toast]);

  const workSummary = useMemo(() => {
    if (!employee) return [];
    return [
      ['Código', employee.employee_code],
      ['Estado', employee.status],
      ['Ingreso', employee.hire_date || 'Pendiente'],
      ['Tipo de contrato', employee.contract_type],
    ];
  }, [employee]);

  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()),
    [documents],
  );

  const setField = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetDocumentForm = () => {
    setDocumentForm({ ...EMPTY_DOCUMENT_FORM });
    setDocumentInputKey((current) => current + 1);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    const payload: Partial<EmployeePayload> = {
      document_type: form.document_type,
      document_number: form.document_number.trim() || null,
      document_issue_date: optionalDate(form.document_issue_date),
      document_issue_place: form.document_issue_place.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      date_of_birth: optionalDate(form.date_of_birth),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      residence_department: form.residence_department.trim(),
      nationality: form.nationality.trim(),
      gender: form.gender,
      marital_status: form.marital_status,
      eps: form.eps.trim(),
      pension_fund: form.pension_fund.trim(),
      severance_fund: form.severance_fund.trim(),
      arl: form.arl.trim(),
      arl_risk_level: form.arl_risk_level.trim(),
      compensation_fund: form.compensation_fund.trim(),
      bank_name: form.bank_name.trim(),
      bank_account_type: form.bank_account_type,
      bank_account_number: form.bank_account_number.trim(),
      bank_account_holder: form.bank_account_holder.trim(),
      bank_account_holder_document: form.bank_account_holder_document.trim(),
      uniform_sweater: form.uniform_sweater.trim(),
      uniform_pants: form.uniform_pants.trim(),
      uniform_shoes: form.uniform_shoes.trim(),
      uniform_other: form.uniform_other.trim(),
      emergency_contact_name: form.emergency_contact_name.trim(),
      emergency_contact_relationship: form.emergency_contact_relationship.trim(),
      emergency_contact_mobile: form.emergency_contact_mobile.trim(),
      emergency_contact_alternate_phone: form.emergency_contact_alternate_phone.trim(),
      emergency_contact_address: form.emergency_contact_address.trim(),
    };
    try {
      const updated = await updateMyEmployeeProfile(payload);
      setEmployee(updated);
      setForm(employeeToForm(updated));
      toast.success('Configuración actualizada');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la configuración');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (passwordForm.user_password.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (passwordForm.user_password !== passwordForm.user_password_confirm) {
      toast.error('La confirmación de contraseña no coincide');
      return;
    }
    setSavingPassword(true);
    try {
      const updated = await updateMyEmployeeProfile({
        current_password: passwordForm.current_password,
        user_password: passwordForm.user_password,
        user_password_confirm: passwordForm.user_password_confirm,
      });
      setEmployee(updated);
      setPasswordForm({ current_password: '', user_password: '', user_password_confirm: '' });
      toast.success('Contraseña actualizada');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña');
    } finally {
      setSavingPassword(false);
    }
  };

  const uploadDocument = async () => {
    if (!documentForm.document_type) {
      toast.error('Selecciona el tipo de documento');
      return;
    }
    if (!documentForm.file) {
      toast.error('Selecciona un archivo para subir');
      return;
    }

    setSavingDocument(true);
    try {
      await createMyEmployeeDocument({
        document_type: documentForm.document_type,
        name: documentForm.name.trim() || optionLabel(DOCUMENT_TYPE_OPTIONS, documentForm.document_type),
        file: documentForm.file,
        issued_at: optionalDate(documentForm.issued_at),
        expires_at: optionalDate(documentForm.expires_at),
        observations: documentForm.observations.trim(),
      });
      const refreshed = await getMyEmployeeDocuments();
      setDocuments(refreshed);
      resetDocumentForm();
      toast.success('Documento enviado a tu expediente');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el documento');
    } finally {
      setSavingDocument(false);
    }
  };

  if (isLoading) return <LoadingState label="Cargando configuración..." />;

  if (!employee) {
    return (
      <Card className="p-8">
        <EmptyState title="No hay perfil de empleado vinculado." description="RRHH debe vincular tu usuario a una ficha de empleado para editar tu información." />
      </Card>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'personal':
        return (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Tipo de documento">
              <select value={form.document_type} onChange={(event) => setField('document_type', event.target.value as DocumentType)} className={selectCls}>
                <option value="">Selecciona...</option>
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="PASSPORT">Pasaporte</option>
                <option value="NIT">NIT</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>
            <Field label="Número de documento"><input value={form.document_number} onChange={(event) => setField('document_number', event.target.value)} className={inputCls} /></Field>
            <Field label="Fecha de expedición"><input type="date" value={form.document_issue_date} onChange={(event) => setField('document_issue_date', event.target.value)} className={inputCls} /></Field>
            <Field label="Lugar de expedición"><input value={form.document_issue_place} onChange={(event) => setField('document_issue_place', event.target.value)} className={inputCls} /></Field>
            <Field label="Nombres"><input value={form.first_name} onChange={(event) => setField('first_name', event.target.value)} className={inputCls} /></Field>
            <Field label="Apellidos"><input value={form.last_name} onChange={(event) => setField('last_name', event.target.value)} className={inputCls} /></Field>
            <Field label="Fecha de nacimiento"><input type="date" value={form.date_of_birth} onChange={(event) => setField('date_of_birth', event.target.value)} className={inputCls} /></Field>
            <Field label="Celular"><input type="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} className={inputCls} /></Field>
            <Field label="Correo electrónico"><input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} className={inputCls} /></Field>
            <Field label="Nacionalidad"><input value={form.nationality} onChange={(event) => setField('nationality', event.target.value)} className={inputCls} /></Field>
            <Field label="Género">
              <select value={form.gender} onChange={(event) => setField('gender', event.target.value as Gender)} className={selectCls}>
                <option value="">Selecciona...</option>
                <option value="FEMALE">Femenino</option>
                <option value="MALE">Masculino</option>
                <option value="NON_BINARY">No binario</option>
                <option value="OTHER">Otro</option>
                <option value="NOT_SPECIFIED">Prefiere no decir</option>
              </select>
            </Field>
            <Field label="Estado civil">
              <select value={form.marital_status} onChange={(event) => setField('marital_status', event.target.value as MaritalStatus)} className={selectCls}>
                <option value="">Selecciona...</option>
                <option value="SINGLE">Soltero/a</option>
                <option value="MARRIED">Casado/a</option>
                <option value="FREE_UNION">Unión libre</option>
                <option value="DIVORCED">Divorciado/a</option>
                <option value="WIDOWED">Viudo/a</option>
                <option value="OTHER">Otro</option>
              </select>
            </Field>
            <Field label="Ciudad"><input value={form.city} onChange={(event) => setField('city', event.target.value)} className={inputCls} /></Field>
            <Field label="Departamento de residencia"><input value={form.residence_department} onChange={(event) => setField('residence_department', event.target.value)} className={inputCls} /></Field>
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dirección de residencia</span>
              <textarea value={form.address} onChange={(event) => setField('address', event.target.value)} rows={3} className={`${inputCls} resize-none`} />
            </label>
          </div>
        );
      case 'dotacion':
        return (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Suéter">
                <input value={form.uniform_sweater} onChange={(event) => setField('uniform_sweater', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Pantalón">
                <input value={form.uniform_pants} onChange={(event) => setField('uniform_pants', event.target.value)} className={inputCls} />
              </Field>
              <Field label="Zapato">
                <input value={form.uniform_shoes} onChange={(event) => setField('uniform_shoes', event.target.value)} className={inputCls} />
              </Field>
            </div>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Otro</span>
              <textarea value={form.uniform_other} onChange={(event) => setField('uniform_other', event.target.value)} rows={3} className={`${inputCls} resize-none`} />
            </label>
          </div>
        );
      case 'social':
        return (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DataListInput label="EPS" value={form.eps} onChange={(value) => setField('eps', value)} options={EPS_OPTIONS} listId="settings-eps-options" />
            <DataListInput label="Fondo de pensiones" value={form.pension_fund} onChange={(value) => setField('pension_fund', value)} options={PENSION_FUND_OPTIONS} listId="settings-pension-options" />
            <DataListInput label="Fondo de cesantías" value={form.severance_fund} onChange={(value) => setField('severance_fund', value)} options={SEVERANCE_FUND_OPTIONS} listId="settings-severance-options" />
            <DataListInput label="ARL" value={form.arl} onChange={(value) => setField('arl', value)} options={ARL_OPTIONS} listId="settings-arl-options" />
            <Field label="Nivel de riesgo ARL">
              <select value={form.arl_risk_level} onChange={(event) => setField('arl_risk_level', event.target.value)} className={selectCls}>
                <option value="">Selecciona...</option>
                {ARL_RISK_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <DataListInput label="Caja de compensación" value={form.compensation_fund} onChange={(value) => setField('compensation_fund', value)} options={COMPENSATION_FUND_OPTIONS} listId="settings-compensation-options" />
          </div>
        );
      case 'banking':
        return (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DataListInput label="Banco" value={form.bank_name} onChange={(value) => setField('bank_name', value)} options={BANK_OPTIONS} listId="settings-bank-options" />
            <Field label="Tipo de cuenta">
              <select value={form.bank_account_type} onChange={(event) => setField('bank_account_type', event.target.value as BankAccountType)} className={selectCls}>
                <option value="">Selecciona...</option>
                <option value="SAVINGS">Ahorros</option>
                <option value="CHECKING">Corriente</option>
              </select>
            </Field>
            <Field label="Número de cuenta"><input value={form.bank_account_number} onChange={(event) => setField('bank_account_number', event.target.value)} className={inputCls} /></Field>
            <Field label="Titular de la cuenta"><input value={form.bank_account_holder} onChange={(event) => setField('bank_account_holder', event.target.value)} className={inputCls} /></Field>
            <Field label="Documento del titular"><input value={form.bank_account_holder_document} onChange={(event) => setField('bank_account_holder_document', event.target.value)} className={inputCls} /></Field>
          </div>
        );
      case 'emergency':
        return (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Nombre completo"><input value={form.emergency_contact_name} onChange={(event) => setField('emergency_contact_name', event.target.value)} className={inputCls} /></Field>
            <Field label="Parentesco"><input value={form.emergency_contact_relationship} onChange={(event) => setField('emergency_contact_relationship', event.target.value)} className={inputCls} /></Field>
            <Field label="Celular"><input type="tel" value={form.emergency_contact_mobile} onChange={(event) => setField('emergency_contact_mobile', event.target.value)} className={inputCls} /></Field>
            <Field label="Teléfono alternativo"><input type="tel" value={form.emergency_contact_alternate_phone} onChange={(event) => setField('emergency_contact_alternate_phone', event.target.value)} className={inputCls} /></Field>
            <label className="block sm:col-span-2 lg:col-span-4">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Dirección</span>
              <textarea value={form.emergency_contact_address} onChange={(event) => setField('emergency_contact_address', event.target.value)} rows={3} className={`${inputCls} resize-none`} />
            </label>
          </div>
        );
      case 'documents':
        return (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DOCUMENT_TYPE_OPTIONS.map((docType) => {
                const docs = sortedDocuments.filter((document) => document.document_type === docType.value);
                const latest = docs[0];
                const active = documentForm.document_type === docType.value;
                return (
                  <button
                    type="button"
                    key={docType.value}
                    onClick={() => {
                      setDocumentForm((current) => ({
                        ...current,
                        document_type: docType.value,
                        name: docType.label,
                      }));
                    }}
                    className={`text-left border rounded-xl p-3 transition-colors ${
                      active ? 'border-[#2a4038] bg-[#2a4038]/5' : 'border-gray-200 hover:border-[#2a4038]'
                    }`}
                  >
                    <div className="text-xs font-medium text-gray-900 mb-1.5">
                      {docType.label}
                      {REQUIRED_DOCUMENT_TYPES.has(docType.value) && (
                        <span className="text-red-500 ml-0.5" title="Documento obligatorio" aria-label="Documento obligatorio">*</span>
                      )}
                    </div>
                    <Badge label={latest ? documentStatusLabel(latest.status) : 'Pendiente'} color={documentStatusBadge(latest?.status ?? 'PENDING')} />
                    {docs.length > 1 && <div className="text-[10px] text-gray-400 mt-2">{docs.length} adjuntos</div>}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-gray-400">
              <span className="text-red-500">*</span> Documento obligatorio para completar el expediente.
            </p>

            <div className="rounded-xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FileUp size={16} />
                Subir documento al expediente
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Tipo de documento">
                  <select
                    value={documentForm.document_type}
                    onChange={(event) => {
                      const docType = event.target.value as EmployeeDocumentType;
                      setDocumentForm((current) => ({
                        ...current,
                        document_type: docType,
                        name: optionLabel(DOCUMENT_TYPE_OPTIONS, docType),
                      }));
                    }}
                    className={selectCls}
                  >
                    {DOCUMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Nombre">
                  <input
                    value={documentForm.name}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label={documentForm.document_type === 'ID_COPY' ? 'Fecha de expedición' : 'Fecha del documento'}>
                  <input
                    type="date"
                    value={documentForm.issued_at}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, issued_at: event.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Fecha de vencimiento">
                  <input
                    type="date"
                    value={documentForm.expires_at}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, expires_at: event.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <label className="block sm:col-span-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Archivo</span>
                  <input
                    key={documentInputKey}
                    type="file"
                    onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                    className={inputCls}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Observaciones</span>
                  <textarea
                    value={documentForm.observations}
                    onChange={(event) => setDocumentForm((current) => ({ ...current, observations: event.target.value }))}
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void uploadDocument()}
                disabled={savingDocument}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2a4038] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#3d5c4e] disabled:opacity-50"
              >
                <FileUp size={14} />
                {savingDocument ? 'Subiendo...' : 'Subir documento'}
              </button>
            </div>

            <div className="space-y-2">
              {sortedDocuments.map((document) => (
                <div key={document.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{document.name}</div>
                    <div className="text-xs text-gray-400">
                      {optionLabel(DOCUMENT_TYPE_OPTIONS, document.document_type)} · Subido: {parseDate(document.uploaded_at)} · Vence: {parseDate(document.expires_at)}
                    </div>
                    {document.observations && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{document.observations}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {document.file && (
                      <a
                        href={document.file}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Ver archivo
                      </a>
                    )}
                    <Badge label={documentStatusLabel(document.status)} color={documentStatusBadge(document.status)} />
                  </div>
                </div>
              ))}
              {sortedDocuments.length === 0 && <EmptyState title="Sin documentos cargados todavía." />}
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="max-w-xl space-y-4">
            <Field label="Contraseña actual">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.current_password}
                onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                className={inputCls}
                autoComplete="current-password"
              />
            </Field>
            <Field label="Nueva contraseña">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.user_password}
                onChange={(event) => setPasswordForm((current) => ({ ...current, user_password: event.target.value }))}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmar nueva contraseña">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.user_password_confirm}
                onChange={(event) => setPasswordForm((current) => ({ ...current, user_password_confirm: event.target.value }))}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPassword ? 'Ocultar' : 'Ver'} contraseñas
              </button>
              <button
                type="button"
                onClick={() => void savePassword()}
                disabled={savingPassword}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2a4038] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#3d5c4e] disabled:opacity-50"
              >
                <LockKeyhole size={14} />
                {savingPassword ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Configuración</h2>
          <p className="text-xs text-gray-500 mt-0.5">Actualiza tu información personal, documentos, seguridad social, datos bancarios, emergencia y contraseña.</p>
        </div>
        {activeTab !== 'security' && activeTab !== 'documents' && (
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={savingProfile}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2a4038] px-4 py-3 sm:py-2.5 text-xs font-semibold text-white hover:bg-[#3d5c4e] disabled:opacity-50"
          >
            <Save size={14} />
            {savingProfile ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_1fr] items-start">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                <UserRound size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{`${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code}</p>
                <p className="text-xs text-gray-400 truncate">{employee.email || employee.employee_code}</p>
              </div>
            </div>
          </Card>

          <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 xl:grid-cols-1 gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
                    active ? 'bg-white text-[#2a4038] shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <Card className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Información laboral</p>
            <dl className="space-y-2 text-xs">
              {workSummary.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <dt className="text-gray-400">{label}</dt>
                  <dd className="font-medium text-gray-800 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Horario asignado</p>
            {workSchedule ? (
              <>
                <p className="text-[10px] text-gray-400 mb-2">Vigente desde {new Date(`${workSchedule.start_date}T00:00:00`).toLocaleDateString('es-CO')}</p>
                <div className="space-y-1">
                  {WEEKDAY_LABELS.map((label, weekday) => {
                    const day = workSchedule.days.find((d) => d.weekday === weekday);
                    return (
                      <div key={weekday} className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-500">{label}</span>
                        {day ? (
                          <span className="font-mono text-gray-800">{day.expected_start_time.slice(0, 5)} - {day.expected_end_time.slice(0, 5)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-400 mt-3">Este horario lo define RRHH. Si necesitas cambiarlo, usa "Solicitar cambio de horario" en Mis solicitudes.</p>
              </>
            ) : (
              <p className="text-xs text-gray-400">Aún no tienes un horario asignado.</p>
            )}
          </Card>
        </div>

        <Card className="p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-900">{TABS.find((tab) => tab.id === activeTab)?.label}</p>
          </div>
          {renderActiveTab()}
        </Card>
      </div>
    </div>
  );
}
