import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Check, ChevronRight, CreditCard, MapPin, Phone, User as UserIcon, X } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { LocationPicker } from './ui/LocationPicker';
import { DeliveryLocationSection } from './ui/DeliveryLocationSection';
import { geographyService, type City } from '../services/geography.service';
import { EMPTY_LOCATION, type LocationValue } from '../services/geography.types';
import { EMPTY_DELIVERY_LOCATION, type DeliveryLocationValue } from '../services/delivery-location.types';

const OLIVE = '#2D3A1F';

function Field({
  label, type = 'text', value, onChange, placeholder, icon: Icon, required, sm,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder: string; icon: React.ElementType; required?: boolean; sm?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`flex flex-col gap-1 ${sm ? '' : 'flex-1'} min-w-0`}>
      <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold leading-none">
        {label}
      </label>
      <div className="relative flex items-center rounded-lg border transition-all duration-150"
        style={{ borderColor: focused ? OLIVE : '#E5E0D8', background: focused ? '#FAFAF8' : '#fff' }}>
        <Icon className="absolute left-2.5 w-3 h-3 flex-shrink-0" strokeWidth={1.5}
          style={{ color: focused ? OLIVE : '#C4BDB4' }} />
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full pl-8 pr-3 py-2 bg-transparent text-[13px] text-stone-800 placeholder:text-stone-300 focus:outline-none rounded-lg"
        />
      </div>
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (
        <div key={n} className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all text-white"
            style={{ backgroundColor: n <= current ? OLIVE : '#e5e0d8' }}>
            {n < current ? <Check className="w-3 h-3" strokeWidth={2.5} /> : n}
          </div>
          {n < total && <div className="w-6 h-px bg-stone-200" />}
        </div>
      ))}
    </div>
  );
}

interface Props {
  isOpen: boolean;
  initialFirstName?: string;
  initialLastName?: string;
  onClose: () => void;
}

export function GoogleOnboardingModal({ isOpen, initialFirstName = '', initialLastName = '', onClose }: Props) {
  const { updateProfile, currentUser } = useUser();

  type Step = 'identity' | 'location' | 'wholesale';
  const [step, setStep] = useState<Step>('identity');

  // Paso 1 — identidad
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName]   = useState(initialLastName);
  const [tipoDoc, setTipoDoc]     = useState('CC');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono]   = useState('');

  // Paso 2 — ubicación
  const [regLoc, setRegLoc] = useState<LocationValue>(EMPTY_LOCATION);
  const [delLoc, setDelLoc] = useState<DeliveryLocationValue>(EMPTY_DELIVERY_LOCATION);
  const [cities, setCities] = useState<City[]>([]);
  const cityNames = useMemo(() => cities.map(c => c.name), [cities]);

  // Paso 3 — mayorista
  const [wantsWholesale, setWantsWholesale] = useState<boolean | null>(null);
  const [tipoIdEmpresa, setTipoIdEmpresa]   = useState<'NIT' | 'CC' | 'OTRO'>('NIT');
  const [otroTipoId, setOtroTipoId]         = useState('');
  const [numIdEmpresa, setNumIdEmpresa]     = useState('');
  const [razonSocial, setRazonSocial]       = useState('');
  const [tipoNegocio, setTipoNegocio]       = useState('TIENDA');
  const [esDistribIntl, setEsDistribIntl]   = useState(false);
  const [telefonoEmpresa, setTelefonoEmpresa] = useState('');

  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('identity');
      setFirstName(initialFirstName);
      setLastName(initialLastName);
      setTipoDoc('CC'); setDocumento(''); setTelefono('');
      setRegLoc(EMPTY_LOCATION); setDelLoc(EMPTY_DELIVERY_LOCATION); setCities([]);
      setWantsWholesale(null);
      setTipoIdEmpresa('NIT'); setOtroTipoId(''); setNumIdEmpresa('');
      setRazonSocial(''); setTipoNegocio('TIENDA'); setEsDistribIntl(false); setTelefonoEmpresa('');
      setError('');
    }
  }, [isOpen, initialFirstName, initialLastName]);

  useEffect(() => {
    if (!regLoc.stateId) { setCities([]); return; }
    let active = true;
    geographyService.getCities(regLoc.stateId)
      .then(r => { if (active) setCities(r); })
      .catch(() => { if (active) setCities([]); });
    return () => { active = false; };
  }, [regLoc.stateId]);

  const stepNumber = step === 'identity' ? 1 : step === 'location' ? 2 : 3;

  const handleIdentityNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim()) { setError('Ingresa tu nombre.'); return; }
    if (!lastName.trim())  { setError('Ingresa tus apellidos.'); return; }
    if (!documento.trim()) { setError('Ingresa tu número de documento.'); return; }
    setSubmitting(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        tipoDocumento: tipoDoc,
        numeroDocumento: documento.trim(),
        telefono: telefono.trim() || undefined,
      });
      setStep('location');
    } catch {
      setError('No fue posible guardar tus datos. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLocationNext = async (skipLocation = false) => {
    setError('');
    if (!skipLocation) {
      if (!delLoc.confirmed || delLoc.lat === null || delLoc.lng === null) {
        setError('Confirma tu ubicación de entrega o selecciona "Completar más tarde".');
        return;
      }
      setSubmitting(true);
      try {
        await updateProfile({
          direccion: delLoc.address || undefined,
          ciudad: regLoc.cityName || delLoc.city || undefined,
          departamento: delLoc.state || undefined,
          pais: delLoc.country || regLoc.countryName || undefined,
          latitud: delLoc.lat,
          longitud: delLoc.lng,
          referencia: delLoc.reference || undefined,
        });
      } catch {
        setError('No fue posible guardar la ubicación. Intenta de nuevo.');
        setSubmitting(false);
        return;
      } finally {
        setSubmitting(false);
      }
    }
    setStep('wholesale');
  };

  const handleWholesaleNo = async () => {
    setSubmitting(true);
    try {
      await updateProfile({ modoCompra: 'RETAIL' });
    } finally {
      setSubmitting(false);
    }
    onClose();
  };

  const handleWholesaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (tipoIdEmpresa === 'OTRO' && !otroTipoId.trim()) { setError('Especifica el tipo de identificación.'); return; }
    if (!numIdEmpresa.trim()) { setError('Ingresa el número de identificación de la empresa.'); return; }
    if (!razonSocial.trim())  { setError('Ingresa la razón social o nombre de la empresa.'); return; }
    setSubmitting(true);
    try {
      await updateProfile({
        modoCompra: 'WHOLESALE',
        companyIdType: tipoIdEmpresa,
        companyIdTypeOther: tipoIdEmpresa === 'OTRO' ? otroTipoId : undefined,
        companyIdNumber: numIdEmpresa.trim(),
        companyName: razonSocial.trim(),
        businessType: tipoNegocio,
        isInternationalDistributor: esDistribIntl,
        companyPhone: telefonoEmpresa.trim() || undefined,
      });
      onClose();
    } catch {
      setError('No fue posible guardar los datos de empresa. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectStyle = "w-full px-2.5 py-2 rounded-lg border border-[#E5E0D8] bg-white text-[13px] text-stone-800 focus:outline-none focus:border-[#2D3A1F] transition appearance-none";
  const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23A8A29E' stroke-width='1.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 0.5rem center`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
          style={{ backgroundColor: 'rgba(14,12,8,0.82)', backdropFilter: 'blur(12px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full overflow-hidden rounded-3xl bg-white shadow-2xl"
            style={{ maxWidth: step === 'location' ? 560 : 480, maxHeight: '92dvh', overflowY: 'auto' }}
          >
            <div className="px-6 pt-6 pb-6 sm:px-7 flex flex-col gap-4">

              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <StepIndicator current={stepNumber} total={3} />
                  <h2 className="mt-3 text-lg font-semibold text-stone-900 leading-tight">
                    {step === 'identity'  && 'Completa tu perfil'}
                    {step === 'location'  && 'Tu dirección de entrega'}
                    {step === 'wholesale' && (wantsWholesale ? 'Datos de tu empresa' : '¿Compras a gran escala?')}
                  </h2>
                  <p className="mt-0.5 text-xs text-stone-400">
                    {step === 'identity'  && 'Confirma tus datos y añade tu documento.'}
                    {step === 'location'  && '¿Dónde te enviamos tus pedidos?'}
                    {step === 'wholesale' && (wantsWholesale ? 'Cuéntanos sobre tu negocio.' : 'Accede a precios especiales por volumen.')}
                  </p>
                </div>
                <button onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-stone-100 transition-colors flex-shrink-0 mt-0.5">
                  <X className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.6} />
                </button>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p key="err"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2 text-xs text-rose-700 leading-relaxed">
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* ── PASO 1: Identidad ── */}
              {step === 'identity' && (
                <form onSubmit={handleIdentityNext} className="flex flex-col gap-3">
                  <div className="flex gap-2.5">
                    <Field label="Nombre *" value={firstName} onChange={setFirstName} placeholder="María" icon={UserIcon} required />
                    <Field label="Apellidos *" value={lastName} onChange={setLastName} placeholder="García" icon={UserIcon} required />
                  </div>
                  <div className="flex gap-2.5">
                    <div className="flex flex-col gap-1 w-28 flex-shrink-0">
                      <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold">Tipo doc.</label>
                      <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}
                        className={selectStyle} style={{ backgroundImage: chevronBg }}>
                        <option value="CC">Cédula</option>
                        <option value="CE">Cédula Ext.</option>
                        <option value="PASSPORT">Pasaporte</option>
                        <option value="NIT">NIT</option>
                        <option value="OTHER">Otro</option>
                      </select>
                    </div>
                    <Field label="N° de documento *" value={documento} onChange={setDocumento} placeholder="1000000001" icon={CreditCard} required />
                  </div>
                  <Field label="Teléfono (opcional)" type="tel" value={telefono} onChange={setTelefono} placeholder="3001234567" icon={Phone} />
                  <button type="submit" disabled={submitting}
                    className="w-full py-2.5 rounded-xl text-white text-[11px] tracking-[0.2em] uppercase font-bold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                    style={{ backgroundColor: OLIVE }}>
                    {submitting ? 'Guardando…' : <>Siguiente <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} /></>}
                  </button>
                </form>
              )}

              {/* ── PASO 2: Ubicación ── */}
              {step === 'location' && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl border border-stone-200 p-3.5 space-y-3">
                    <LocationPicker value={regLoc} onChange={setRegLoc} />
                    <DeliveryLocationSection
                      value={delLoc} onChange={setDelLoc}
                      searchScope={{ state: regLoc.stateName, country: regLoc.countryName }}
                      cityOptions={cityNames}
                      onCityResolved={cn => setRegLoc(p => ({ ...p, cityId: null, cityName: cn }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleLocationNext(true)} disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 text-[11px] font-semibold text-stone-500 tracking-wide hover:bg-stone-50 transition-colors disabled:opacity-50">
                      Completar más tarde
                    </button>
                    <button type="button" onClick={() => handleLocationNext(false)} disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl text-white text-[11px] tracking-[0.2em] uppercase font-bold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ backgroundColor: OLIVE }}>
                      {submitting ? 'Guardando…' : <><MapPin className="w-3.5 h-3.5" strokeWidth={2} /> Confirmar</>}
                    </button>
                  </div>
                </div>
              )}

              {/* ── PASO 3: ¿Mayorista? ── */}
              {step === 'wholesale' && wantsWholesale === null && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-stone-500 leading-relaxed">
                    Si realizas compras frecuentes o en grandes cantidades, puedes acceder a precios especiales y beneficios exclusivos para mayoristas.
                  </p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setWantsWholesale(true)}
                      className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-stone-200 hover:border-[#2D3A1F] hover:bg-[#2D3A1F]/[0.03] transition-all">
                      <Building2 className="w-6 h-6 text-stone-400" strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold text-stone-700">Sí, soy mayorista</span>
                      <span className="text-[10px] text-stone-400 text-center">Accede a precios por volumen</span>
                    </button>
                    <button type="button" onClick={handleWholesaleNo} disabled={submitting}
                      className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-stone-200 hover:border-stone-400 hover:bg-stone-50 transition-all disabled:opacity-50">
                      <UserIcon className="w-6 h-6 text-stone-400" strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold text-stone-700">No, compro personal</span>
                      <span className="text-[10px] text-stone-400 text-center">Precios de minorista</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── PASO 3b: Datos empresa ── */}
              {step === 'wholesale' && wantsWholesale === true && (
                <form onSubmit={handleWholesaleSubmit} className="flex flex-col gap-3">
                  <div className="flex gap-2.5">
                    <div className="flex flex-col gap-1 w-28 flex-shrink-0">
                      <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold">Tipo ID empresa *</label>
                      <select value={tipoIdEmpresa} onChange={e => setTipoIdEmpresa(e.target.value as 'NIT' | 'CC' | 'OTRO')}
                        className={selectStyle} style={{ backgroundImage: chevronBg }}>
                        <option value="NIT">NIT</option>
                        <option value="CC">Cédula</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>
                    {tipoIdEmpresa === 'OTRO' ? (
                      <Field label="Especifica *" value={otroTipoId} onChange={setOtroTipoId} placeholder="Ej: RUT…" icon={CreditCard} required />
                    ) : (
                      <Field label="N° de identificación *" value={numIdEmpresa} onChange={setNumIdEmpresa} placeholder="900123456-7" icon={CreditCard} required />
                    )}
                  </div>
                  {tipoIdEmpresa === 'OTRO' && (
                    <Field label="N° de identificación *" value={numIdEmpresa} onChange={setNumIdEmpresa} placeholder="900123456-7" icon={CreditCard} required />
                  )}
                  <Field label="Razón social / Nombre empresa *" value={razonSocial} onChange={setRazonSocial} placeholder="Mi Empresa S.A.S." icon={Building2} required />
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold">Tipo de negocio *</label>
                    <select value={tipoNegocio} onChange={e => { setTipoNegocio(e.target.value); if (e.target.value !== 'DISTRIBUIDOR') setEsDistribIntl(false); }}
                      className={selectStyle} style={{ backgroundImage: chevronBg }}>
                      <option value="TIENDA">Tienda</option>
                      <option value="DISTRIBUIDOR">Distribuidor</option>
                      <option value="RESTAURANTE">Restaurante</option>
                      <option value="FARMACIA">Farmacia / Droguería</option>
                      <option value="SPA">Spa / Estética</option>
                      <option value="OTRO">Otro</option>
                    </select>
                    {tipoNegocio === 'DISTRIBUIDOR' && (
                      <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                        <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
                          style={{ borderColor: esDistribIntl ? OLIVE : '#D6D0C8', backgroundColor: esDistribIntl ? OLIVE : 'transparent' }}
                          onClick={() => setEsDistribIntl(v => !v)}>
                          {esDistribIntl && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span className="text-[11px] text-stone-500">¿Es distribuidor internacional?</span>
                      </label>
                    )}
                  </div>
                  <Field label="Teléfono empresa (opcional)" type="tel" value={telefonoEmpresa} onChange={setTelefonoEmpresa} placeholder="6011234567" icon={Phone} />
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setWantsWholesale(null)}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 text-[11px] font-semibold text-stone-500 hover:bg-stone-50 transition-colors">
                      ← Volver
                    </button>
                    <button type="submit" disabled={submitting}
                      className="flex-[2] py-2.5 rounded-xl text-white text-[11px] tracking-[0.2em] uppercase font-bold transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: OLIVE }}>
                      {submitting ? 'Guardando…' : 'Finalizar'}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
