import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, ChevronRight, CreditCard, Eye, EyeOff, Lock, Mail,
  MapPin, Phone, Shield, User as UserIcon, X,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { LocationPicker } from './ui/LocationPicker';
import { DeliveryLocationSection } from './ui/DeliveryLocationSection';
import { geographyService, type City } from '../services/geography.service';
import { EMPTY_LOCATION, type LocationValue } from '../services/geography.types';
import { EMPTY_DELIVERY_LOCATION, type DeliveryLocationValue } from '../services/delivery-location.types';

const OLIVE = '#2D3A1F';

/* ─── imágenes por pantalla ─── */
const IMAGES = {
  login:    'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=85&fit=crop',   // aceite / gotero natural
  register: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=900&q=85&fit=crop',  // hierbas / ingredientes
  step2:    'https://images.unsplash.com/photo-1599305090598-fe179d501227?w=900&q=85&fit=crop',   // flores / botanico
};

/* ─── input compacto ─── */
const inp = (focused: boolean) =>
  `w-full pl-8 pr-8 py-2 bg-transparent text-[13px] text-stone-800 placeholder:text-stone-300 focus:outline-none rounded-lg`;

function Field({
  label, type = 'text', value, onChange, placeholder, icon: Icon,
  required, minLength, extra, sm,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder: string; icon: React.ElementType; required?: boolean;
  minLength?: number; extra?: React.ReactNode; sm?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold leading-none">
        {label}
      </label>
      <div className="relative flex items-center rounded-lg border transition-all duration-150"
        style={{ borderColor: focused ? OLIVE : '#E5E0D8', background: focused ? '#FAFAF8' : '#fff' }}>
        <Icon className="absolute left-2.5 w-3 h-3 flex-shrink-0" strokeWidth={1.5}
          style={{ color: focused ? OLIVE : '#C4BDB4' }} />
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} required={required} minLength={minLength}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className={inp(focused)} />
        {extra}
      </div>
    </div>
  );
}

/* ─── panel imagen ─── */
function ImagePanel({ src }: { src: string; tab: 'login' | 'register' | 'step2' }) {
  return (
    <div className="hidden md:flex flex-col relative overflow-hidden flex-shrink-0" style={{ width: '42%' }}>
      {/* imagen */}
      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
      {/* overlay sutil */}
      <div className="absolute inset-0" style={{ background: 'rgba(10,14,6,0.18)' }} />

    </div>
  );
}

/* ─── Google ─── */
const GoogleG = () => (
  <svg width="14" height="14" viewBox="0 0 18 18">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

/* ══════════════════════════════════════════════════════ */
interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminAccess: (email: string, password: string) => Promise<boolean>;
}

export function LoginModal({ isOpen, onClose, onAdminAccess }: LoginModalProps) {
  const { login: customerLogin, register: customerRegister, verifyRegistration,
    resendRegistrationCode, resetPassword, verifyPasswordReset, confirmPasswordReset } = useUser();

  type Screen = 'login' | 'reg1' | 'reg2' | 'verify' | 'forgot';
  const [screen, setScreen] = useState<Screen>('login');

  /* campos */
  const [nombre,    setNombre]    = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [terms,     setTerms]     = useState(false);
  const [tipoDoc,   setTipoDoc]   = useState('CC');
  const [documento, setDocumento] = useState('');
  const [telefono,  setTelefono]  = useState('');
  const [mode,      setMode]      = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');

  /* dirección */
  const [regLoc, setRegLoc] = useState<LocationValue>(EMPTY_LOCATION);
  const [delLoc, setDelLoc] = useState<DeliveryLocationValue>(EMPTY_DELIVERY_LOCATION);
  const [cities, setCities] = useState<City[]>([]);
  const cityNames = useMemo(() => cities.map(c => c.name), [cities]);

  /* flujo */
  const [verificationId,    setVerificationId]    = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode,  setVerificationCode]  = useState('');
  const [debugCode,         setDebugCode]         = useState('');
  const [resetVid,          setResetVid]          = useState('');
  const [resetCode,         setResetCode]         = useState('');
  const [resetDbg,          setResetDbg]          = useState('');
  const [resetToken,        setResetToken]        = useState('');
  const [newPass,           setNewPass]           = useState('');
  const [confNewPass,       setConfNewPass]       = useState('');

  /* campos mayorista */
  const [tipoIdEmpresa,     setTipoIdEmpresa]     = useState<'NIT' | 'OTRO'>('NIT');
  const [otroTipoId,        setOtroTipoId]        = useState('');
  const [numIdEmpresa,      setNumIdEmpresa]       = useState('');
  const [razonSocial,       setRazonSocial]        = useState('');
  const [tipoNegocio,       setTipoNegocio]        = useState('TIENDA');
  const [esDistribIntl,     setEsDistribIntl]      = useState(false);
  const [telefonoEmpresa,   setTelefonoEmpresa]    = useState('');

  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const clear = () => {
    setError(''); setSuccess('');
    setNombre(''); setApellidos(''); setEmail(''); setPassword(''); setConfirm('');
    setShowPass(false); setShowConf(false); setTerms(false);
    setTipoDoc('CC'); setDocumento(''); setTelefono(''); setMode('RETAIL');
    setTipoIdEmpresa('NIT'); setOtroTipoId(''); setNumIdEmpresa('');
    setRazonSocial(''); setTipoNegocio('TIENDA'); setEsDistribIntl(false); setTelefonoEmpresa('');
    setRegLoc(EMPTY_LOCATION); setDelLoc(EMPTY_DELIVERY_LOCATION); setCities([]);
    setVerificationId(''); setVerificationEmail(''); setVerificationCode(''); setDebugCode('');
    setResetVid(''); setResetCode(''); setResetDbg(''); setResetToken(''); setNewPass(''); setConfNewPass('');
  };

  const handleClose = () => { clear(); setScreen('login'); onClose(); };
  const goScreen = (s: Screen) => { setError(''); setSuccess(''); setScreen(s); };

  useEffect(() => {
    if (!regLoc.stateId) { setCities([]); return; }
    let c = true;
    geographyService.getCities(regLoc.stateId)
      .then(r => { if (c) setCities(r); })
      .catch(() => { if (c) setCities([]); });
    return () => { c = false; };
  }, [regLoc.stateId]);

  /* ── paso 1 registro: validar antes de avanzar ── */
  const handleReg1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'WHOLESALE') {
      if (tipoIdEmpresa === 'OTRO' && !otroTipoId.trim()) { setError('Especifica el tipo de identificación de la empresa.'); return; }
      if (!numIdEmpresa.trim()) { setError('Ingresa el número de identificación de la empresa.'); return; }
      if (!razonSocial.trim())  { setError('Ingresa la razón social o nombre de la empresa.'); return; }
    }
    if (!nombre.trim())    { setError('Ingresa tu nombre.'); return; }
    if (!apellidos.trim()) { setError('Ingresa tus apellidos.'); return; }
    if (!email.trim())     { setError('Ingresa tu email.'); return; }
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    if (!terms) { setError('Acepta los términos para continuar.'); return; }
    goScreen('reg2');
  };

  /* ── submit final ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      /* recuperar contraseña */
      if (screen === 'forgot') {
        if (resetToken) {
          if (newPass.length < 8) { setError('Mínimo 8 caracteres.'); return; }
          if (newPass !== confNewPass) { setError('Las contraseñas no coinciden.'); return; }
          const r = await confirmPasswordReset(resetToken, newPass);
          if (r.ok) { setSuccess('Contraseña actualizada.'); setTimeout(() => { clear(); goScreen('login'); }, 1800); }
          else setError(r.message || 'Error al restablecer.');
          return;
        }
        if (resetVid) {
          if (!resetCode.trim()) { setError('Ingresa el código.'); return; }
          const r = await verifyPasswordReset(resetVid, resetCode.trim());
          if (r.ok && r.resetToken) { setResetToken(r.resetToken); setResetCode(''); setSuccess('Código verificado. Crea tu contraseña.'); }
          else setError(r.message || 'Código inválido.');
          return;
        }
        if (!email.trim()) { setError('Ingresa tu email.'); return; }
        const r = await resetPassword(email);
        if (r.ok && r.verificationId) { setResetVid(r.verificationId); setResetDbg(r.debugCode || ''); setSuccess(r.message || 'Código enviado.'); }
        else setError(r.message || 'Error al enviar.');
        return;
      }
      /* verificar código de registro */
      if (screen === 'verify') {
        if (!verificationCode.trim()) { setError('Ingresa el código.'); return; }
        const r = await verifyRegistration(verificationId, verificationCode.trim());
        if (r.ok) { clear(); setScreen('login'); onClose(); }
        else setError(r.message || 'Código inválido.');
        return;
      }
      /* login */
      if (screen === 'login') {
        const isAdmin = await onAdminAccess(email, password);
        if (isAdmin) return;
        const r = await customerLogin(email, password);
        if (r.ok) { clear(); setScreen('login'); onClose(); }
        else setError(r.message || 'Email o contraseña incorrectos.');
        return;
      }
      /* registro paso 2 (dirección) */
      if (screen === 'reg2') {
        if (!delLoc.confirmed || delLoc.lat === null || delLoc.lng === null) {
          setError('Confirma tu ubicación de entrega.'); return;
        }
        const r = await customerRegister(nombre, apellidos, email, password, {
          phone: telefono || undefined, address: delLoc.address || undefined,
          city: regLoc.cityName || delLoc.city || undefined,
          document_type: tipoDoc || undefined, document_number: documento || undefined,
          purchase_mode: mode, state: delLoc.state || undefined,
          country: delLoc.country || regLoc.countryName || undefined,
          latitude: delLoc.lat, longitude: delLoc.lng,
          reference: delLoc.reference || undefined,
          ...(mode === 'WHOLESALE' && {
            company_id_type: tipoIdEmpresa,
            company_id_type_other: tipoIdEmpresa === 'OTRO' ? otroTipoId : undefined,
            company_id_number: numIdEmpresa || undefined,
            company_name: razonSocial || undefined,
            business_type: tipoNegocio || undefined,
            is_international_distributor: esDistribIntl,
            company_phone: telefonoEmpresa || undefined,
          }),
        });
        if (r.ok && r.verificationId) {
          setVerificationId(r.verificationId);
          setVerificationEmail(r.email || email.trim().toLowerCase());
          setVerificationCode(''); setDebugCode(r.debugCode || '');
          setSuccess(r.message || 'Código enviado a tu correo.');
          goScreen('verify');
        } else setError(r.message || 'No fue posible crear la cuenta.');
      }
    } finally { setSubmitting(false); }
  };

  const handleResend = async () => {
    if (!verificationId) return;
    setError(''); setSuccess(''); setSubmitting(true);
    try {
      const r = await resendRegistrationCode(verificationId);
      if (r.ok) {
        setVerificationId(r.verificationId || verificationId);
        setVerificationEmail(r.email || verificationEmail);
        setVerificationCode(''); setDebugCode(r.debugCode || '');
        setSuccess(r.message || 'Nuevo código enviado.');
      } else setError(r.message || 'No fue posible reenviar.');
    } finally { setSubmitting(false); }
  };

  /* ── imagen según pantalla ── */
  const imgSrc = screen === 'login' || screen === 'forgot' ? IMAGES.login
    : screen === 'reg2' ? IMAGES.step2
    : IMAGES.register;

  const imgTab: 'login' | 'register' | 'step2' =
    screen === 'login' || screen === 'forgot' ? 'login'
    : screen === 'reg2' ? 'step2'
    : 'register';

  /* ── ancho del modal ── */
  const modalMaxW = (screen === 'reg1' || screen === 'reg2') ? 820 : 660;

  /* ── botón submit label ── */
  const submitLabel = submitting ? 'Procesando…'
    : screen === 'verify' ? 'Verificar código'
    : screen === 'forgot' ? (resetToken ? 'Restablecer contraseña' : resetVid ? 'Verificar código' : 'Enviar código')
    : screen === 'login' ? 'Iniciar sesión'
    : screen === 'reg2' ? 'Crear cuenta'
    : ''; // reg1 tiene su propio handler

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
          style={{ backgroundColor: 'rgba(14,12,8,0.82)', backdropFilter: 'blur(12px)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative flex w-full overflow-hidden rounded-3xl bg-white shadow-2xl"
            style={{ maxWidth: modalMaxW, height: 'min(94dvh, 580px)' }}
          >
            {/* imagen izquierda */}
            <ImagePanel src={imgSrc} tab={imgTab} />

            {/* formulario derecho */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

              {/* cerrar */}
              <button onClick={handleClose}
                className="absolute top-3.5 right-3.5 z-20 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-stone-100 transition-colors shadow-sm">
                <X className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.6} />
              </button>

              {/* contenido scrollable solo si hace falta */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-6 pb-5 sm:px-7 flex flex-col gap-4">

                {/* ── tabs login/register ── */}
                {(screen === 'login' || screen === 'reg1') && (
                  <div className="flex gap-0.5 p-0.5 rounded-lg bg-stone-100 w-fit">
                    {(['login', 'reg1'] as const).map(s => (
                      <button key={s} type="button" onClick={() => goScreen(s)}
                        className={`px-3.5 py-1.5 rounded-md text-[11px] font-semibold tracking-wide transition-all ${screen === s ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>
                        {s === 'login' ? 'Ingresar' : 'Registrarse'}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── paso indicador (registro) ── */}
                {(screen === 'reg1' || screen === 'reg2') && (
                  <div className="flex items-center gap-2">
                    {[1, 2].map(n => (
                      <div key={n} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                          (n === 1 && screen === 'reg1') || (n === 2 && screen === 'reg2')
                            ? 'text-white' : n < (screen === 'reg2' ? 2 : 1) ? 'text-white' : 'bg-stone-100 text-stone-400'
                        }`} style={{ backgroundColor: n === 1 ? (screen === 'reg2' ? OLIVE : OLIVE) : screen === 'reg2' ? OLIVE : '#e5e0d8' }}>
                          {n < (screen === 'reg2' ? 2 : 0) ? <Check className="w-3 h-3" strokeWidth={2.5} /> : n}
                        </div>
                        {n < 2 && <div className="w-6 h-px bg-stone-200" />}
                      </div>
                    ))}
                    <span className="text-[10px] text-stone-400 ml-1">
                      {screen === 'reg1' ? 'Datos personales' : 'Dirección de entrega'}
                    </span>
                  </div>
                )}

                {/* ── título ── */}
                <AnimatePresence mode="wait">
                  <motion.div key={screen} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <h2 className="text-lg font-semibold text-stone-900 leading-tight">
                      {screen === 'login'  && 'Bienvenida de nuevo'}
                      {screen === 'reg1'  && 'Crea tu cuenta'}
                      {screen === 'reg2'  && 'Tu dirección de entrega'}
                      {screen === 'verify' && 'Verifica tu correo'}
                      {screen === 'forgot' && (resetToken ? 'Nueva contraseña' : resetVid ? 'Ingresa el código' : '¿Olvidaste tu contraseña?')}
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {screen === 'login'  && 'Ingresa para continuar.'}
                      {screen === 'reg1'  && 'Paso 1 de 2 · Información básica'}
                      {screen === 'reg2'  && 'Paso 2 de 2 · ¿Dónde te enviamos?'}
                      {screen === 'verify' && `Código enviado a ${verificationEmail || email}`}
                      {screen === 'forgot' && (resetToken ? 'Crea una nueva contraseña segura.' : resetVid ? `Código enviado a ${email}` : 'Te enviamos un código de recuperación.')}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* ── alertas ── */}
                <AnimatePresence>
                  {error && (
                    <motion.p key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2 text-xs text-rose-700 leading-relaxed flex-shrink-0">
                      {error}
                    </motion.p>
                  )}
                  {success && (
                    <motion.div key="ok" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-700 flex-shrink-0">
                      <Check className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} /> {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ════ PANTALLAS ════ */}

                {/* LOGIN */}
                {screen === 'login' && (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" icon={Mail} required />
                    <Field label="Contraseña" type={showPass ? 'text' : 'password'} value={password} onChange={setPassword} placeholder="••••••••" icon={Lock} required
                      extra={<button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 text-stone-300 hover:text-stone-500">{showPass ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.3} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.3} />}</button>} />
                    <div className="flex justify-end -mt-1">
                      <button type="button" onClick={() => goScreen('forgot')} className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors">
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <button type="submit" disabled={submitting}
                      className="w-full py-2.5 rounded-xl text-white text-[11px] tracking-[0.2em] uppercase font-bold transition-opacity disabled:opacity-50 mt-1"
                      style={{ backgroundColor: OLIVE }}>
                      {submitting ? 'Procesando…' : 'Iniciar sesión'}
                    </button>

                    {/* sociales */}
                    <div className="flex items-center gap-2 my-0.5">
                      <div className="flex-1 h-px bg-stone-100" />
                      <span className="text-[10px] text-stone-400">o continúa con</span>
                      <div className="flex-1 h-px bg-stone-100" />
                    </div>
                    <div className="flex gap-2">
                      {[
                        { icon: <GoogleG />, label: 'Google' },
                        { icon: <svg width="13" height="13" viewBox="0 0 814 1000" fill="currentColor"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-43.4-150.3-109.2c-52.1-73.1-96.2-187.6-96.2-295.1C172 151.1 359.4 75 542.8 75c81.1 0 148.1 32.1 200.8 84.4 30.4 29.7 60.4 65.2 63.5 181.5z"/><path d="M554.2 0c2.6 27.2-7.7 55.8-21.6 76.1-15.2 22.5-42.5 40.7-71.3 38.3-3.7-28.4 9.2-58.1 24-77.2 16.4-21.2 43.6-38.9 68.9-37.2z"/></svg>, label: 'Apple' },
                      ].map(({ icon, label }) => (
                        <button key={label} type="button" className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-stone-200 rounded-lg text-xs text-stone-600 font-medium hover:bg-stone-50 transition-colors">
                          {icon} {label}
                        </button>
                      ))}
                    </div>

                    <p className="text-center text-[11px] text-stone-400">
                      ¿Sin cuenta?{' '}
                      <button type="button" onClick={() => goScreen('reg1')} className="font-semibold underline underline-offset-2 transition-colors" style={{ color: OLIVE }}>
                        Regístrate gratis
                      </button>
                    </p>

                    {/* demo admin */}
                    <div className="border-t border-stone-100 pt-3 mt-auto">
                      <p className="text-[9px] tracking-[0.2em] uppercase text-stone-300 mb-1.5 text-center">Demo Admin</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[{ label: 'Admin 1', email: 'admin@juhnios.com' }, { label: 'Admin 2', email: 'administrador2@juhnios.com' }].map(({ label, email: ae }) => (
                          <button key={ae} type="button" onClick={() => setEmail(ae)} className="px-2.5 py-1.5 rounded-lg border border-stone-100 hover:bg-stone-50 transition-colors text-left">
                            <span className="block text-[9px] text-stone-400">{label}</span>
                            <span className="block text-[10px] font-medium text-stone-600 truncate">{ae}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-stone-300 text-center mt-1">Pass: Admin123!</p>
                    </div>
                  </form>
                )}

                {/* REGISTRO PASO 1 */}
                {screen === 'reg1' && (
                  <form onSubmit={handleReg1Next} className="flex flex-col gap-3">
                    {/* modo compra — primero */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold">¿Cómo deseas comprar?</label>
                      <div className="flex gap-2">
                        {[
                          { v: 'RETAIL' as const, l: 'Personal', s: 'Minorista' },
                          { v: 'WHOLESALE' as const, l: 'Por volumen', s: 'Mayorista' },
                        ].map(o => (
                          <button key={o.v} type="button" onClick={() => setMode(o.v)}
                            className={`flex-1 rounded-lg border px-3 py-2 text-left transition-all ${mode === o.v ? 'border-[#2D3A1F] bg-[#2D3A1F]/5' : 'border-stone-200 hover:bg-stone-50'}`}>
                            <span className={`block text-[11px] font-semibold leading-none ${mode === o.v ? 'text-stone-900' : 'text-stone-500'}`}>{o.l}</span>
                            <span className="block text-[10px] text-stone-400 mt-0.5">{o.s}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── SECCIÓN EMPRESA (solo mayorista) ── */}
                    {mode === 'WHOLESALE' && (
                      <div className="flex flex-col gap-3 rounded-xl border border-[#2D3A1F]/20 bg-[#2D3A1F]/[0.03] p-3">
                        <p className="text-[9px] tracking-[0.22em] uppercase text-[#2D3A1F] font-bold">Información de la empresa</p>

                        {/* tipo identificación empresa */}
                        <div className="flex gap-2.5">
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold">Tipo de identificación *</label>
                            <select value={tipoIdEmpresa} onChange={e => setTipoIdEmpresa(e.target.value as 'NIT' | 'OTRO')}
                              className="w-full px-2.5 py-2 rounded-lg border border-[#E5E0D8] bg-white text-[13px] text-stone-800 focus:outline-none focus:border-[#2D3A1F] transition appearance-none"
                              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23A8A29E' stroke-width='1.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}>
                              <option value="NIT">NIT</option>
                              <option value="OTRO">Otro</option>
                            </select>
                          </div>
                          {tipoIdEmpresa === 'OTRO' && (
                            <Field label="Especifica el tipo *" value={otroTipoId} onChange={setOtroTipoId} placeholder="Ej: RUT, RFC…" icon={CreditCard} required />
                          )}
                        </div>

                        {/* número id empresa + razón social */}
                        <div className="flex gap-2.5">
                          <Field label="N° de identificación *" value={numIdEmpresa} onChange={setNumIdEmpresa} placeholder="900123456-7" icon={CreditCard} required />
                          <Field label="Nombre empresa / Razón social *" value={razonSocial} onChange={setRazonSocial} placeholder="Mi Empresa S.A.S." icon={UserIcon} required />
                        </div>

                        {/* tipo de negocio */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold">Tipo de negocio *</label>
                          <select value={tipoNegocio} onChange={e => { setTipoNegocio(e.target.value); if (e.target.value !== 'DISTRIBUIDOR') setEsDistribIntl(false); }}
                            className="w-full px-2.5 py-2 rounded-lg border border-[#E5E0D8] bg-white text-[13px] text-stone-800 focus:outline-none focus:border-[#2D3A1F] transition appearance-none"
                            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23A8A29E' stroke-width='1.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}>
                            <option value="TIENDA">Tienda</option>
                            <option value="DISTRIBUIDOR">Distribuidor</option>
                            <option value="RESTAURANTE">Restaurante</option>
                            <option value="FARMACIA">Farmacia / Droguería</option>
                            <option value="SPA">Spa / Estética</option>
                            <option value="OTRO">Otro</option>
                          </select>
                          {tipoNegocio === 'DISTRIBUIDOR' && (
                            <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                              <div className="relative flex-shrink-0" onClick={() => setEsDistribIntl(v => !v)}>
                                <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all"
                                  style={{ borderColor: esDistribIntl ? OLIVE : '#D6D0C8', backgroundColor: esDistribIntl ? OLIVE : 'transparent' }}>
                                  {esDistribIntl && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                              </div>
                              <span className="text-[11px] text-stone-500 leading-tight">¿Es distribuidor internacional?</span>
                            </label>
                          )}
                        </div>

                        {/* teléfono empresa */}
                        <Field label="Teléfono empresa" type="tel" value={telefonoEmpresa} onChange={setTelefonoEmpresa} placeholder="6011234567" icon={Phone} />
                      </div>
                    )}

                    {/* ── SECCIÓN REPRESENTANTE LEGAL / DATOS PERSONALES ── */}
                    {mode === 'WHOLESALE' && (
                      <p className="text-[9px] tracking-[0.22em] uppercase text-stone-500 font-bold -mb-1">Representante legal</p>
                    )}

                    {/* nombre + apellidos */}
                    <div className="flex gap-2.5">
                      <Field label="Nombre *" value={nombre} onChange={setNombre} placeholder="María" icon={UserIcon} required />
                      <Field label="Apellidos *" value={apellidos} onChange={setApellidos} placeholder="García" icon={UserIcon} required />
                    </div>
                    {/* email + teléfono */}
                    <div className="flex gap-2.5">
                      <Field label="Email *" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" icon={Mail} required />
                      <Field label="Teléfono" type="tel" value={telefono} onChange={setTelefono} placeholder="3001234567" icon={Phone} />
                    </div>
                    {/* contraseñas */}
                    <div className="flex gap-2.5">
                      <Field label="Contraseña * (mín. 8)" type={showPass ? 'text' : 'password'} value={password} onChange={setPassword} placeholder="••••••••" icon={Lock} required minLength={8}
                        extra={<button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 text-stone-300 hover:text-stone-500">{showPass ? <EyeOff className="w-3 h-3" strokeWidth={1.3} /> : <Eye className="w-3 h-3" strokeWidth={1.3} />}</button>} />
                      <Field label="Confirmar contraseña *" type={showConf ? 'text' : 'password'} value={confirm} onChange={setConfirm} placeholder="Repite" icon={Lock} required
                        extra={<button type="button" onClick={() => setShowConf(p => !p)} className="absolute right-2.5 text-stone-300 hover:text-stone-500">{showConf ? <EyeOff className="w-3 h-3" strokeWidth={1.3} /> : <Eye className="w-3 h-3" strokeWidth={1.3} />}</button>} />
                    </div>
                    {/* documento */}
                    <div className="flex gap-2.5">
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 font-semibold">Tipo doc.</label>
                        <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-[#E5E0D8] bg-white text-[13px] text-stone-800 focus:outline-none focus:border-[#2D3A1F] transition appearance-none"
                          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23A8A29E' stroke-width='1.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' }}>
                          <option value="CC">Cédula</option>
                          <option value="CE">Cédula Ext.</option>
                          <option value="PASSPORT">Pasaporte</option>
                          <option value="NIT">NIT</option>
                          <option value="OTHER">Otro</option>
                        </select>
                      </div>
                      <Field label="N° de documento" value={documento} onChange={setDocumento} placeholder="1000000001" icon={CreditCard} />
                    </div>
                    {/* términos */}
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <div className="relative flex-shrink-0 mt-0.5" onClick={() => setTerms(t => !t)}>
                        <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all"
                          style={{ borderColor: terms ? OLIVE : '#D6D0C8', backgroundColor: terms ? OLIVE : 'transparent' }}>
                          {terms && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </div>
                      <span className="text-[11px] text-stone-500 leading-tight">
                        Acepto los <a href="#" className="underline" onClick={e => e.preventDefault()}>Términos</a> y la <a href="#" className="underline" onClick={e => e.preventDefault()}>Política de privacidad</a>
                      </span>
                    </label>
                    {/* siguiente */}
                    <button type="submit" disabled={submitting}
                      className="w-full py-2.5 rounded-xl text-white text-[11px] tracking-[0.2em] uppercase font-bold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ backgroundColor: OLIVE }}>
                      Siguiente <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                    <p className="text-center text-[11px] text-stone-400">
                      ¿Ya tienes cuenta?{' '}
                      <button type="button" onClick={() => goScreen('login')} className="font-semibold underline underline-offset-2" style={{ color: OLIVE }}>
                        Ingresar
                      </button>
                    </p>
                  </form>
                )}

                {/* REGISTRO PASO 2 — dirección */}
                {screen === 'reg2' && (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
                      <button type="button" onClick={() => goScreen('reg1')}
                        className="flex-1 py-2.5 rounded-xl border border-stone-200 text-[11px] font-semibold text-stone-600 tracking-wide hover:bg-stone-50 transition-colors">
                        ← Atrás
                      </button>
                      <button type="submit" disabled={submitting}
                        className="flex-2 flex-1 py-2.5 rounded-xl text-white text-[11px] tracking-[0.2em] uppercase font-bold transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: OLIVE, flexGrow: 2 }}>
                        {submitting ? 'Creando…' : 'Crear cuenta'}
                      </button>
                    </div>
                  </form>
                )}

                {/* VERIFICAR CÓDIGO */}
                {screen === 'verify' && (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <Field label="Código de 6 dígitos" value={verificationCode}
                      onChange={v => setVerificationCode(v.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" icon={Shield} required />
                    {debugCode && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-600 text-center">
                        Dev: <span className="font-mono font-bold text-stone-800">{debugCode}</span>
                      </div>
                    )}
                    <button type="submit" disabled={submitting}
                      className="w-full py-2.5 rounded-xl text-white text-[11px] tracking-[0.2em] uppercase font-bold disabled:opacity-50"
                      style={{ backgroundColor: OLIVE }}>
                      {submitting ? 'Verificando…' : 'Verificar código'}
                    </button>
                    <button type="button" onClick={handleResend} disabled={submitting}
                      className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors text-center">
                      Reenviar código
                    </button>
                    <button type="button" onClick={() => { setVerificationId(''); setVerificationCode(''); setDebugCode(''); goScreen('reg1'); }}
                      className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors text-center">
                      ← Cambiar datos de registro
                    </button>
                  </form>
                )}

                {/* RECUPERAR CONTRASEÑA */}
                {screen === 'forgot' && (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    {resetToken ? (
                      <>
                        <Field label="Nueva contraseña" type={showPass ? 'text' : 'password'} value={newPass} onChange={setNewPass} placeholder="Mín. 8 caracteres" icon={Lock} required minLength={8}
                          extra={<button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 text-stone-300 hover:text-stone-500">{showPass ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.3} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.3} />}</button>} />
                        <Field label="Confirmar contraseña" type={showConf ? 'text' : 'password'} value={confNewPass} onChange={setConfNewPass} placeholder="Repite" icon={Lock} required
                          extra={<button type="button" onClick={() => setShowConf(p => !p)} className="absolute right-2.5 text-stone-300 hover:text-stone-500">{showConf ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.3} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.3} />}</button>} />
                      </>
                    ) : resetVid ? (
                      <>
                        <Field label="Código de verificación" value={resetCode} onChange={v => setResetCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="000000" icon={Shield} required />
                        {resetDbg && (
                          <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs text-stone-600 text-center">
                            Dev: <span className="font-mono font-bold text-stone-800">{resetDbg}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" icon={Mail} required />
                    )}
                    <button type="submit" disabled={submitting}
                      className="w-full py-2.5 rounded-xl text-white text-[11px] tracking-[0.2em] uppercase font-bold disabled:opacity-50"
                      style={{ backgroundColor: OLIVE }}>
                      {submitting ? 'Procesando…' : resetToken ? 'Restablecer contraseña' : resetVid ? 'Verificar código' : 'Enviar código'}
                    </button>
                    <button type="button" onClick={() => { setError(''); setSuccess(''); setResetVid(''); setResetToken(''); setResetCode(''); setNewPass(''); setConfNewPass(''); goScreen('login'); }}
                      className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors text-center">
                      ← Volver a iniciar sesión
                    </button>
                  </form>
                )}

              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
