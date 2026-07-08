import { useEffect, useState } from 'react';
import { FileUp, KeyRound, Save, User, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  getMyEmployeeProfile,
  updateMyEmployeeProfile,
  type Employee,
  type EmployeePayload,
} from '../../services/employees.service';
import {
  createMyEmployeeDocument,
  getMyEmployeeDocuments,
  type EmployeeDocument,
  type EmployeeDocumentType,
} from '../../services/human-resources.service';
import { getRoleLabel } from '../../utils/permissions';
import { Badge, type BadgeColor, Card, EmptyState, LoadingState } from './AdminUI';
import { TextInput, SelectInput, TextareaInput } from './AdminHR';
import { LocationPicker } from '../ui/LocationPicker';
import { EMPTY_LOCATION, type LocationValue } from '../../services/geography.types';

type ProfileTab = 'personal' | 'social' | 'banking' | 'emergency' | 'documents' | 'access' | 'history';

const TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: 'personal', label: 'Información Personal' },
  { id: 'social', label: 'Seguridad Social' },
  { id: 'banking', label: 'Datos Bancarios' },
  { id: 'emergency', label: 'Emergencia' },
  { id: 'documents', label: 'Documentos' },
  { id: 'access', label: 'Acceso' },
  { id: 'history', label: 'Historial' },
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

function parseDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CO');
}

interface FormState {
  document_type: string;
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
  gender: string;
  marital_status: string;
  eps: string;
  pension_fund: string;
  severance_fund: string;
  arl: string;
  arl_risk_level: string;
  compensation_fund: string;
  bank_name: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_account_holder: string;
  bank_account_holder_document: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_mobile: string;
  emergency_contact_alternate_phone: string;
  emergency_contact_address: string;
  user_email: string;
  user_email_confirm: string;
  user_password: string;
  user_password_confirm: string;
}

function mapEmployeeToForm(employee: Employee): FormState {
  return {
    document_type: employee.document_type || 'CC',
    document_number: employee.document_number ?? '',
    document_issue_date: employee.document_issue_date ?? '',
    document_issue_place: employee.document_issue_place,
    first_name: employee.first_name,
    last_name: employee.last_name,
    date_of_birth: employee.date_of_birth ?? '',
    email: employee.email,
    phone: employee.phone,
    address: employee.address,
    city: employee.city,
    residence_department: employee.residence_department,
    nationality: employee.nationality || 'Colombiana',
    gender: employee.gender,
    marital_status: employee.marital_status,
    eps: employee.eps,
    pension_fund: employee.pension_fund,
    severance_fund: employee.severance_fund,
    arl: employee.arl,
    arl_risk_level: employee.arl_risk_level,
    compensation_fund: employee.compensation_fund,
    bank_name: employee.bank_name,
    bank_account_type: employee.bank_account_type,
    bank_account_number: employee.bank_account_number,
    bank_account_holder: employee.bank_account_holder,
    bank_account_holder_document: employee.bank_account_holder_document,
    emergency_contact_name: employee.emergency_contact_name,
    emergency_contact_relationship: employee.emergency_contact_relationship,
    emergency_contact_mobile: employee.emergency_contact_mobile,
    emergency_contact_alternate_phone: employee.emergency_contact_alternate_phone,
    emergency_contact_address: employee.emergency_contact_address,
    user_email: employee.email,
    user_email_confirm: employee.email,
    user_password: '',
    user_password_confirm: '',
  };
}

function buildPayload(form: FormState, location: LocationValue): Partial<EmployeePayload> {
  return {
    document_type: form.document_type as EmployeePayload['document_type'],
    document_number: form.document_number.trim() || null,
    document_issue_date: form.document_issue_date || null,
    document_issue_place: form.document_issue_place.trim(),
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    date_of_birth: form.date_of_birth || null,
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    city: (location.cityName || form.city).trim(),
    residence_department: (location.stateName || form.residence_department).trim(),
    nationality: form.nationality.trim(),
    gender: form.gender as EmployeePayload['gender'],
    marital_status: form.marital_status as EmployeePayload['marital_status'],
    eps: form.eps.trim(),
    pension_fund: form.pension_fund.trim(),
    severance_fund: form.severance_fund.trim(),
    arl: form.arl.trim(),
    arl_risk_level: form.arl_risk_level.trim(),
    compensation_fund: form.compensation_fund.trim(),
    bank_name: form.bank_name.trim(),
    bank_account_type: form.bank_account_type as EmployeePayload['bank_account_type'],
    bank_account_number: form.bank_account_number.trim(),
    bank_account_holder: form.bank_account_holder.trim(),
    bank_account_holder_document: form.bank_account_holder_document.trim(),
    emergency_contact_name: form.emergency_contact_name.trim(),
    emergency_contact_relationship: form.emergency_contact_relationship.trim(),
    emergency_contact_mobile: form.emergency_contact_mobile.trim(),
    emergency_contact_alternate_phone: form.emergency_contact_alternate_phone.trim(),
    emergency_contact_address: form.emergency_contact_address.trim(),
    ...(form.user_email ? { user_email: form.user_email.trim().toLowerCase() } : {}),
    ...(form.user_email_confirm ? { user_email_confirm: form.user_email_confirm.trim().toLowerCase() } : {}),
    ...(form.user_password ? { user_password: form.user_password } : {}),
    ...(form.user_password_confirm ? { user_password_confirm: form.user_password_confirm } : {}),
  };
}

export function EmployeeSelfProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [documentType, setDocumentType] = useState<EmployeeDocumentType>('ID_COPY');
  const [documentName, setDocumentName] = useState('Cédula de Ciudadanía');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setActiveTab('personal');
    Promise.allSettled([getMyEmployeeProfile(), getMyEmployeeDocuments()]).then(([profileRes, documentsRes]) => {
      if (cancelled) return;
      if (profileRes.status === 'fulfilled') {
        const data = profileRes.value;
        setEmployee(data);
        setForm(mapEmployeeToForm(data));
        setLocation({
          countryId: null,
          countryName: 'Colombia',
          stateId: null,
          stateName: data.residence_department ?? '',
          cityId: null,
          cityName: data.city ?? '',
        });
      } else {
        toast.error('No se pudo cargar tu perfil de empleado');
      }
      setDocuments(documentsRes.status === 'fulfilled' ? documentsRes.value : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  if (!open) return null;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const updated = await updateMyEmployeeProfile(buildPayload(form, location));
      setEmployee(updated);
      setForm(mapEmployeeToForm(updated));
      toast.success('Perfil actualizado');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo actualizar tu perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async () => {
    if (!documentFile) {
      toast.error('Selecciona un archivo para subir');
      return;
    }
    setSavingDocument(true);
    try {
      await createMyEmployeeDocument({ document_type: documentType, name: documentName, file: documentFile });
      toast.success('Documento enviado');
      setDocumentFile(null);
      const refreshed = await getMyEmployeeDocuments();
      setDocuments(refreshed);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo subir el documento');
    } finally {
      setSavingDocument(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white max-w-6xl w-full max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <User size={16} className="text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900">Mi perfil</h3>
              <p className="text-xs text-gray-500 mt-0.5">Consulta y actualiza tu información personal.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200">
            <X size={16} />
          </button>
        </div>

        {loading || !form ? (
          <div className="flex-1 flex items-center justify-center p-10">
            <LoadingState label="Cargando tu perfil..." />
          </div>
        ) : !employee ? (
          <div className="flex-1 p-8">
            <EmptyState title="Tu usuario no tiene un perfil de empleado asociado." />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 pt-4 border-b border-gray-100">
              <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
                {TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${active ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid md:grid-cols-4 gap-4 mb-5">
                <Card className="p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Perfil completado</div>
                  <div className="text-xl font-bold text-gray-900">{employee.profile_completion_percentage}%</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Pendientes</div>
                  <div className="text-xl font-bold text-gray-900">{employee.pending_documents_count}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Vencidos</div>
                  <div className="text-xl font-bold text-gray-900">{employee.expired_documents_count}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Contrato restante</div>
                  <div className="text-xl font-bold text-gray-900">
                    {employee.remaining_contract_days == null ? 'Contrato indefinido' : `${employee.remaining_contract_days} días`}
                  </div>
                </Card>
              </div>

              {activeTab === 'personal' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SelectInput
                      label="Tipo de documento"
                      value={form.document_type}
                      onChange={(value) => setField('document_type', value)}
                      options={[
                        { value: 'CC', label: 'Cédula de ciudadanía' },
                        { value: 'CE', label: 'Cédula de extranjería' },
                        { value: 'PASSPORT', label: 'Pasaporte' },
                        { value: 'NIT', label: 'NIT' },
                        { value: 'OTHER', label: 'Otro' },
                      ]}
                    />
                    <TextInput label="Número de documento" value={form.document_number} onChange={(value) => setField('document_number', value)} />
                    <TextInput label="Fecha de expedición" type="date" value={form.document_issue_date} onChange={(value) => setField('document_issue_date', value)} />
                    <TextInput label="Lugar de expedición" value={form.document_issue_place} onChange={(value) => setField('document_issue_place', value)} />
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <TextInput label="Nombres" value={form.first_name} onChange={(value) => setField('first_name', value)} />
                    <TextInput label="Apellidos" value={form.last_name} onChange={(value) => setField('last_name', value)} />
                    <TextInput label="Fecha de nacimiento" type="date" value={form.date_of_birth} onChange={(value) => setField('date_of_birth', value)} />
                    <TextInput label="Celular" type="tel" value={form.phone} onChange={(value) => setField('phone', value)} />
                    <TextInput label="Correo electrónico" type="email" value={form.email} onChange={(value) => setField('email', value)} />
                    <TextInput label="Nacionalidad" value={form.nationality} onChange={(value) => setField('nationality', value)} />
                    <div className="sm:col-span-2 lg:col-span-2">
                      <LocationPicker value={location} onChange={setLocation} />
                    </div>
                    <SelectInput
                      label="Sexo / Género"
                      value={form.gender}
                      onChange={(value) => setField('gender', value)}
                      options={[
                        { value: 'FEMALE', label: 'Femenino' },
                        { value: 'MALE', label: 'Masculino' },
                        { value: 'NON_BINARY', label: 'No binario' },
                        { value: 'OTHER', label: 'Otro' },
                        { value: 'NOT_SPECIFIED', label: 'Prefiere no decir' },
                      ]}
                    />
                    <SelectInput
                      label="Estado civil"
                      value={form.marital_status}
                      onChange={(value) => setField('marital_status', value)}
                      options={[
                        { value: 'SINGLE', label: 'Soltero/a' },
                        { value: 'MARRIED', label: 'Casado/a' },
                        { value: 'FREE_UNION', label: 'Unión libre' },
                        { value: 'DIVORCED', label: 'Divorciado/a' },
                        { value: 'WIDOWED', label: 'Viudo/a' },
                        { value: 'OTHER', label: 'Otro' },
                      ]}
                    />
                  </div>
                  <TextareaInput label="Dirección de residencia" value={form.address} onChange={(value) => setField('address', value)} />
                </div>
              )}

              {activeTab === 'social' && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <TextInput label="EPS" value={form.eps} onChange={(value) => setField('eps', value)} />
                  <TextInput label="Fondo de pensiones" value={form.pension_fund} onChange={(value) => setField('pension_fund', value)} />
                  <TextInput label="Fondo de cesantías" value={form.severance_fund} onChange={(value) => setField('severance_fund', value)} />
                  <TextInput label="ARL" value={form.arl} onChange={(value) => setField('arl', value)} />
                  <TextInput label="Nivel de riesgo ARL" value={form.arl_risk_level} onChange={(value) => setField('arl_risk_level', value)} />
                  <TextInput label="Caja de compensación" value={form.compensation_fund} onChange={(value) => setField('compensation_fund', value)} />
                </div>
              )}

              {activeTab === 'banking' && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <TextInput label="Banco" value={form.bank_name} onChange={(value) => setField('bank_name', value)} />
                  <SelectInput
                    label="Tipo de cuenta"
                    value={form.bank_account_type}
                    onChange={(value) => setField('bank_account_type', value)}
                    options={[
                      { value: 'SAVINGS', label: 'Ahorros' },
                      { value: 'CHECKING', label: 'Corriente' },
                    ]}
                  />
                  <TextInput label="Número de cuenta" value={form.bank_account_number} onChange={(value) => setField('bank_account_number', value)} />
                  <TextInput label="Titular de la cuenta" value={form.bank_account_holder} onChange={(value) => setField('bank_account_holder', value)} />
                  <TextInput label="Documento del titular" value={form.bank_account_holder_document} onChange={(value) => setField('bank_account_holder_document', value)} />
                </div>
              )}

              {activeTab === 'emergency' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <TextInput label="Nombre completo" value={form.emergency_contact_name} onChange={(value) => setField('emergency_contact_name', value)} />
                    <TextInput label="Parentesco" value={form.emergency_contact_relationship} onChange={(value) => setField('emergency_contact_relationship', value)} />
                    <TextInput label="Celular" value={form.emergency_contact_mobile} onChange={(value) => setField('emergency_contact_mobile', value)} />
                    <TextInput label="Teléfono alternativo" value={form.emergency_contact_alternate_phone} onChange={(value) => setField('emergency_contact_alternate_phone', value)} />
                  </div>
                  <TextareaInput label="Dirección" value={form.emergency_contact_address} onChange={(value) => setField('emergency_contact_address', value)} />
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-5">
                  <div className="grid md:grid-cols-3 gap-3">
                    {DOCUMENT_TYPE_OPTIONS.map((docType) => {
                      const docs = documents.filter((document) => document.document_type === docType.value);
                      const latest = docs[0];
                      return (
                        <button
                          type="button"
                          key={docType.value}
                          onClick={() => {
                            setDocumentType(docType.value);
                            setDocumentName(docType.label);
                          }}
                          className="text-left border border-gray-200 rounded-xl p-3 hover:border-[#2a4038] transition-colors"
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
                    <span className="text-red-500">*</span> Documento obligatorio para completar tu expediente.
                  </p>

                  <Card className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <FileUp size={16} />
                      Subir documento de soporte
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <SelectInput
                        label="Tipo de documento"
                        value={documentType}
                        onChange={(value) => {
                          const docType = value as EmployeeDocumentType;
                          setDocumentType(docType);
                          setDocumentName(DOCUMENT_TYPE_OPTIONS.find((option) => option.value === docType)?.label ?? '');
                        }}
                        options={DOCUMENT_TYPE_OPTIONS}
                      />
                      <TextInput label="Nombre" value={documentName} onChange={setDocumentName} />
                      <label className="block">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Archivo</span>
                        <input
                          type="file"
                          onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDocumentUpload()}
                      disabled={savingDocument}
                      className="px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
                    >
                      {savingDocument ? 'Subiendo...' : 'Subir documento'}
                    </button>
                  </Card>

                  <div className="space-y-2">
                    {documents.map((document) => (
                      <div key={document.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl p-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{document.name}</div>
                          <div className="text-xs text-gray-400">Vence: {parseDate(document.expires_at)}</div>
                        </div>
                        <Badge label={documentStatusLabel(document.status)} color={documentStatusBadge(document.status)} />
                      </div>
                    ))}
                    {documents.length === 0 && <EmptyState title="Sin documentos cargados todavía." />}
                  </div>
                </div>
              )}

              {activeTab === 'access' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                        <KeyRound size={12} /> Rol dentro del sistema
                      </span>
                      <input
                        value={employee.user_role_code ? getRoleLabel(employee.user_role_code) : 'Sin acceso al sistema'}
                        disabled
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
                      />
                    </label>
                    <TextInput label="Correo" type="email" value={form.user_email} onChange={(value) => setField('user_email', value)} />
                    <TextInput label="Confirmar correo" type="email" value={form.user_email_confirm} onChange={(value) => setField('user_email_confirm', value)} />
                    <TextInput label="Nueva contraseña" type="password" value={form.user_password} onChange={(value) => setField('user_password', value)} placeholder="Dejar vacío para conservar" />
                    <TextInput label="Confirmar contraseña" type="password" value={form.user_password_confirm} onChange={(value) => setField('user_password_confirm', value)} />
                  </div>
                  <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl text-xs text-amber-800">
                    Tu rol dentro del sistema solo puede ser modificado por RRHH o un administrador.
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="grid md:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Creación</div>
                    <div className="text-sm text-gray-700">{parseDate(employee.created_at)}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Última modificación</div>
                    <div className="text-sm text-gray-700">{parseDate(employee.updated_at)}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Edad</div>
                    <div className="text-sm text-gray-700">{employee.age ?? 'Pendiente'}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Antigüedad</div>
                    <div className="text-sm text-gray-700">{employee.seniority_days ?? 0} días</div>
                  </Card>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cerrar
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
