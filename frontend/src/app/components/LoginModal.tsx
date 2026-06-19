import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Mail, User as UserIcon, Eye, EyeOff, Shield, Phone, CreditCard, MapPin } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { LocationPicker } from './ui/LocationPicker';
import { AddressMap } from './ui/AddressMap';
import { EMPTY_LOCATION, type LocationValue } from '../services/geography.types';

const OLIVE = '#2D3A1F';

// Logo SVG botánico inline
const BrandLogo = () => (
  <div className="flex flex-col items-center gap-1 mb-6">
    
    
  </div>
);

// Campo de input reutilizable
function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon: Icon,
  required,
  minLength,
  extra,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ElementType;
  required?: boolean;
  minLength?: number;
  extra?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[9px] tracking-[0.28em] uppercase text-stone-400 font-medium mb-1.5">
        {label}
      </label>
      <div
        className="relative flex items-center rounded-xl border transition-all duration-200"
        style={{
          borderColor: focused ? OLIVE : '#E7E3DC',
          backgroundColor: focused ? '#FAFAF8' : 'white',
        }}
      >
        <Icon
          className="absolute left-3.5 w-4 h-4 flex-shrink-0 transition-colors"
          strokeWidth={1.3}
          style={{ color: focused ? OLIVE : '#C4BDB4' }}
        />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full pl-10 pr-10 py-3 bg-transparent text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none rounded-xl"
        />
        {extra}
      </div>
    </div>
  );
}

// Botones sociales
function SocialButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="w-full flex items-center justify-center gap-3 py-3 border border-stone-200 rounded-xl text-sm text-stone-700 font-medium hover:bg-stone-50 transition-colors"
    >
      {children}
    </button>
  );
}

// Google G
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

// Apple logo
const AppleLogo = () => (
  <svg width="17" height="17" viewBox="0 0 814 1000" fill="currentColor">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-43.4-150.3-109.2c-52.1-73.1-96.2-187.6-96.2-295.1C172 151.1 359.4 75 542.8 75c81.1 0 148.1 32.1 200.8 84.4 30.4 29.7 60.4 65.2 63.5 181.5z" />
    <path d="M554.2 0c2.6 27.2-7.7 55.8-21.6 76.1-15.2 22.5-42.5 40.7-71.3 38.3-3.7-28.4 9.2-58.1 24-77.2 16.4-21.2 43.6-38.9 68.9-37.2z" />
  </svg>
);

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminAccess: (email: string, password: string) => Promise<boolean>;
}

export function LoginModal({ isOpen, onClose, onAdminAccess }: LoginModalProps) {
  const {
    login: customerLogin,
    register: customerRegister,
    verifyRegistration,
    resendRegistrationCode,
    resetPassword,
  } = useUser();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [isForgot, setIsForgot] = useState(false);
  // common
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [terms, setTerms] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [debugCode, setDebugCode] = useState('');
  // extra registro
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [regLocation, setRegLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setError(''); setSuccess('');
    setNombre(''); setEmail(''); setPassword(''); setConfirm('');
    setShowPass(false); setShowConfirm(false); setTerms(false);
    setTipoDocumento('CC'); setDocumento(''); setTelefono(''); setDireccion('');
    setRegLocation(EMPTY_LOCATION);
    setVerificationId(''); setVerificationEmail(''); setVerificationCode(''); setDebugCode('');
    setIsForgot(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const switchTab = (t: 'login' | 'register') => {
    setTab(t);
    setIsForgot(false);
    setError('');
    setSuccess('');
    setVerificationId('');
    setVerificationEmail('');
    setVerificationCode('');
    setDebugCode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setSubmitting(true);
    try {
      if (isForgot) {
        const result = await resetPassword(email);
        if (result.ok) {
          setSuccess('Si el correo existe, recibirás instrucciones para cambiar tu contraseña.');
          setTimeout(() => { setIsForgot(false); setEmail(''); setSuccess(''); }, 3000);
        } else {
          setError(result.message || 'No fue posible solicitar la recuperación.');
        }
        return;
      }
      if (verificationId) {
        if (!verificationCode.trim()) { setError('Ingresa el codigo de verificacion.'); return; }
        const result = await verifyRegistration(verificationId, verificationCode.trim());
        if (result.ok) { reset(); onClose(); }
        else setError(result.message || 'No fue posible verificar el codigo. Usa el codigo mas reciente que recibiste por correo.');
        return;
      }
      if (tab === 'login') {
        const isAdmin = await onAdminAccess(email, password);
        if (isAdmin) return;
        const result = await customerLogin(email, password);
        if (result.ok) { reset(); onClose(); }
        else setError(result.message || 'Email o contraseña incorrectos.');
      } else {
        if (!nombre.trim()) { setError('Por favor ingresa tu nombre completo.'); return; }
        if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
        if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
        if (!terms) { setError('Debes aceptar los términos y condiciones.'); return; }
        const result = await customerRegister(nombre, email, password, {
          phone: telefono || undefined,
          address: direccion || undefined,
          city: regLocation.cityName || undefined,
          document_type: tipoDocumento || undefined,
          document_number: documento || undefined,
        });
        if (result.ok && result.verificationId) {
          setVerificationId(result.verificationId);
          setVerificationEmail(result.email || email.trim().toLowerCase());
          setVerificationCode('');
          setDebugCode(result.debugCode || '');
          setSuccess(result.message || 'Enviamos un codigo de verificacion a tu correo.');
        }
        else setError(result.message || 'No fue posible crear la cuenta.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!verificationId) return;
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const result = await resendRegistrationCode(verificationId);
      if (result.ok) {
        setVerificationId(result.verificationId || verificationId);
        setVerificationEmail(result.email || verificationEmail);
        setVerificationCode('');
        setDebugCode(result.debugCode || '');
        setSuccess(result.message || 'Enviamos un nuevo codigo de verificacion.');
      } else {
        setError(result.message || 'No fue posible reenviar el codigo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(30,28,24,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[440px] rounded-3xl overflow-y-auto max-h-[95vh]"
            style={{ backgroundColor: 'white' }}
          >
            {/* Botón cerrar */}
            <button
              onClick={handleClose}
              className="absolute top-5 right-5 z-10 p-1.5 rounded-full hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
            </button>

            <div className="px-8 pt-10 pb-8">

              {/* Logo */}
              <BrandLogo />

              {/* ── TÍTULO ── */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={verificationId ? 'verify' : isForgot ? 'forgot' : tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  className="text-center mb-6"
                >
                  {verificationId ? (
                    <>
                      <p className="text-xs text-stone-400 mb-1">Verifica tu correo</p>
                      <h2
                        className="text-3xl font-light text-stone-900"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Codigo de{' '}
                        <em className="not-italic font-semibold" style={{ fontStyle: 'italic', color: OLIVE }}>
                          seguridad
                        </em>
                      </h2>
                      <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                        Enviamos un codigo de 6 digitos a {verificationEmail || email}.
                        Si pediste reenviarlo, usa el correo mas reciente.
                      </p>
                    </>
                  ) : isForgot ? (
                    <>
                      <p className="text-xs text-stone-400 mb-1">Recuperar acceso</p>
                      <h2
                        className="text-3xl font-light text-stone-900"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        ¿Olvidaste tu{' '}
                        <em className="not-italic font-semibold" style={{ fontStyle: 'italic', color: OLIVE }}>
                          contraseña?
                        </em>
                      </h2>
                      <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                        Ingresa tu email y te enviaremos las instrucciones.
                      </p>
                    </>
                  ) : tab === 'login' ? (
                    <>
                      <p className="text-xs text-stone-400 mb-1">Bienvenido de nuevo</p>
                      <h2
                        className="text-3xl font-light text-stone-900"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Iniciar{' '}
                        <em className="not-italic font-semibold" style={{ fontStyle: 'italic', color: OLIVE }}>
                          sesión
                        </em>
                      </h2>
                      <p className="text-xs text-stone-400 mt-2">Ingresa para continuar con tu experiencia.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-stone-400 mb-1">Bienvenida</p>
                      <h2
                        className="text-3xl font-light text-stone-900"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Crear{' '}
                        <em className="not-italic font-semibold" style={{ fontStyle: 'italic', color: OLIVE }}>
                          tu cuenta
                        </em>
                      </h2>
                      <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                        Únete a Juhnios Rold y descubre lo mejor para tu cabello.
                      </p>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* ── TABS ── */}
              {!isForgot && !verificationId && (
                <div className="flex border-b border-stone-100 mb-6">
                  {(['login', 'register'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => switchTab(t)}
                      className="relative flex-1 pb-3 text-[10px] tracking-[0.22em] uppercase font-semibold transition-colors"
                      style={{ color: tab === t ? OLIVE : '#C4BDB4' }}
                    >
                      {t === 'login' ? 'Ingresar' : 'Registrarse'}
                      {tab === t && (
                        <motion.div
                          layoutId="modal-tab"
                          className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                          style={{ backgroundColor: OLIVE }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* ── FORMULARIO ── */}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Error / éxito */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 leading-relaxed"
                    >
                      {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 leading-relaxed"
                    >
                      {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={verificationId ? 'verify' : isForgot ? 'forgot' : tab}
                    initial={{ opacity: 0, x: tab === 'login' || isForgot ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    {verificationId ? (
                      <div className="space-y-3">
                        <Field
                          label="Codigo de verificacion"
                          value={verificationCode}
                          onChange={(value) => setVerificationCode(value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          icon={Shield}
                          required
                        />
                        <button
                          type="button"
                          onClick={handleResendCode}
                          disabled={submitting}
                          className="w-full text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
                        >
                          Reenviar codigo
                        </button>
                        {debugCode && (
                          <div className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 text-center">
                            Codigo de desarrollo: <span className="font-mono text-stone-900">{debugCode}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                    {/* Campos solo registro */}
                    {tab === 'register' && !isForgot && (
                      <>
                        <Field
                          label="Nombre completo"
                          value={nombre} onChange={setNombre}
                          placeholder="Ej: María González"
                          icon={UserIcon}
                          required
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] tracking-[0.28em] uppercase text-stone-400 font-medium mb-1.5">
                              Tipo de documento
                            </label>
                            <select
                              value={tipoDocumento}
                              onChange={e => setTipoDocumento(e.target.value)}
                              className="w-full pl-3.5 pr-9 py-3 rounded-xl border border-[#E7E3DC] bg-white text-sm text-stone-800 focus:outline-none focus:border-[#2D3A1F] transition-all duration-200 appearance-none bg-no-repeat"
                              style={{
                                backgroundImage:
                                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23A8A29E' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                                backgroundPosition: 'right 0.875rem center',
                              }}
                            >
                              <option value="CC">Cédula de Ciudadanía</option>
                              <option value="CE">Cédula de Extranjería</option>
                              <option value="PASSPORT">Pasaporte</option>
                              <option value="NIT">NIT</option>
                              <option value="OTHER">Otro</option>
                            </select>
                          </div>
                          <Field
                            label="Número de documento"
                            value={documento} onChange={setDocumento}
                            placeholder="Ej: 1000000001"
                            icon={CreditCard}
                          />
                        </div>
                        <Field
                          label="Teléfono"
                          type="tel"
                          value={telefono} onChange={setTelefono}
                          placeholder="3001234567"
                          icon={Phone}
                        />
                      </>
                    )}

                    {/* Email */}
                    <Field
                      label="Email"
                      type="email"
                      value={email} onChange={setEmail}
                      placeholder="tu@email.com"
                      icon={Mail}
                      required
                    />

                    {/* Contraseña */}
                    {!isForgot && (
                      <Field
                        label="Contraseña"
                        type={showPass ? 'text' : 'password'}
                        value={password} onChange={setPassword}
                        placeholder={tab === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
                        icon={Lock}
                        required
                        minLength={tab === 'register' ? 8 : undefined}
                        extra={
                          <button
                            type="button"
                            onClick={() => setShowPass(p => !p)}
                            className="absolute right-3.5 text-stone-300 hover:text-stone-500 transition-colors"
                          >
                            {showPass
                              ? <EyeOff className="w-4 h-4" strokeWidth={1.3} />
                              : <Eye className="w-4 h-4" strokeWidth={1.3} />
                            }
                          </button>
                        }
                      />
                    )}

                    {/* Confirmar contraseña (solo registro) */}
                    {tab === 'register' && !isForgot && (
                      <Field
                        label="Confirmar contraseña"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirm} onChange={setConfirm}
                        placeholder="Repite tu contraseña"
                        icon={Lock}
                        required
                        extra={
                          <button
                            type="button"
                            onClick={() => setShowConfirm(p => !p)}
                            className="absolute right-3.5 text-stone-300 hover:text-stone-500 transition-colors"
                          >
                            {showConfirm
                              ? <EyeOff className="w-4 h-4" strokeWidth={1.3} />
                              : <Eye className="w-4 h-4" strokeWidth={1.3} />
                            }
                          </button>
                        }
                      />
                    )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* ¿Olvidaste? */}
                {tab === 'login' && !isForgot && !verificationId && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setIsForgot(true); setError(''); setSuccess(''); }}
                      className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}

                {/* Ubicación y dirección (solo registro) */}
                {tab === 'register' && !isForgot && !verificationId && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-stone-200 overflow-hidden p-4 space-y-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" style={{ color: OLIVE }} strokeWidth={1.5} />
                        <span className="text-[10px] tracking-[0.22em] uppercase font-semibold" style={{ color: OLIVE }}>
                          Ubicación
                        </span>
                      </div>

                      {/* LocationPicker adapts to the LoginModal style */}
                      <div className="[&_span]:text-[9px] [&_span]:tracking-[0.2em] [&_span]:uppercase [&_span]:text-stone-400 [&_input]:text-sm [&_input]:rounded-xl [&_input]:border-stone-200 [&_input]:py-3 [&_input]:pl-4 [&_input]:bg-white [&_.hover\\:bg-secondary\\/60]:hover:bg-stone-50">
                        <LocationPicker
                          value={regLocation}
                          onChange={setRegLocation}
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] tracking-[0.28em] uppercase text-stone-400 font-medium mb-1.5">
                          Dirección
                        </label>
                        <div
                          className="relative flex items-center rounded-xl border border-stone-200 bg-white"
                        >
                          <MapPin
                            className="absolute left-3.5 w-4 h-4 text-stone-300"
                            strokeWidth={1.3}
                          />
                          <input
                            type="text"
                            value={direccion}
                            onChange={e => setDireccion(e.target.value)}
                            placeholder="Calle 123 #45-67, Apto 8"
                            className="w-full pl-10 pr-4 py-3 bg-transparent text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none rounded-xl"
                          />
                        </div>
                      </div>

                      {/* Map preview */}
                      {(direccion || regLocation.cityName) && (
                        <AddressMap
                          address={direccion}
                          city={regLocation.cityName}
                          country={regLocation.countryName || 'Colombia'}
                          className="h-48 rounded-xl overflow-hidden border border-stone-200"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Términos (solo registro) */}
                {tab === 'register' && !isForgot && !verificationId && (
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={terms}
                        onChange={e => setTerms(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                        style={{
                          borderColor: terms ? OLIVE : '#D6D0C8',
                          backgroundColor: terms ? OLIVE : 'transparent',
                        }}
                      >
                        {terms && (
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-stone-500 leading-relaxed">
                      Acepto los{' '}
                      <a href="#" className="underline hover:text-stone-800 transition-colors" onClick={e => e.preventDefault()}>
                        Términos y Condiciones
                      </a>{' '}
                      y la{' '}
                      <a href="#" className="underline hover:text-stone-800 transition-colors" onClick={e => e.preventDefault()}>
                        Política de Privacidad
                      </a>
                    </span>
                  </label>
                )}

                {/* Botón principal */}
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ opacity: submitting ? 0.5 : 0.88 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl text-white text-[11px] tracking-[0.28em] uppercase font-semibold transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: OLIVE }}
                >
                  {submitting
                    ? 'Procesando...'
                    : verificationId
                      ? 'Verificar codigo'
                    : isForgot
                      ? 'Enviar instrucciones'
                      : tab === 'login'
                        ? 'Iniciar sesión'
                        : 'Crear cuenta'
                  }
                </motion.button>

                {/* Volver (olvidé contraseña) */}
                {isForgot && (
                  <button
                    type="button"
                    onClick={() => { setIsForgot(false); setError(''); setSuccess(''); }}
                    className="w-full text-[11px] text-stone-400 hover:text-stone-700 transition-colors pt-1"
                  >
                    ← Volver a iniciar sesión
                  </button>
                )}
                {verificationId && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationId('');
                      setVerificationEmail('');
                      setVerificationCode('');
                      setDebugCode('');
                      setError('');
                      setSuccess('');
                    }}
                    className="w-full text-[11px] text-stone-400 hover:text-stone-700 transition-colors pt-1"
                  >
                    Cambiar datos de registro
                  </button>
                )}
              </form>

              {/* ── SOCIALES ── */}
              {!isForgot && !verificationId && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-stone-100" />
                    <span className="text-[10px] text-stone-400">o continúa con</span>
                    <div className="flex-1 h-px bg-stone-100" />
                  </div>
                  <div className="space-y-2.5">
                    <SocialButton>
                      <GoogleG />
                      <span>Continuar con Google</span>
                    </SocialButton>
                    <SocialButton>
                      <AppleLogo />
                      <span>Continuar con Apple</span>
                    </SocialButton>
                  </div>
                </div>
              )}

              {/* Pie */}
              {tab === 'login' && !isForgot && !verificationId && (
                <div className="mt-6 flex items-center justify-center gap-1 text-[11px] text-stone-400">
                  <Shield className="w-3 h-3 text-stone-300" strokeWidth={1.5} />
                  Tu información está protegida y encriptada
                </div>
              )}

              {tab === 'register' && !isForgot && !verificationId && (
                <p className="mt-5 text-center text-[11px] text-stone-400">
                  ¿Ya tienes una cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => switchTab('login')}
                    className="font-semibold hover:text-stone-700 transition-colors underline underline-offset-2"
                    style={{ color: OLIVE }}
                  >
                    Iniciar sesión
                  </button>
                </p>
              )}

              {/* Acceso admin demo (login) */}
              {tab === 'login' && !isForgot && !verificationId && (
                <div className="mt-6 pt-5 border-t border-stone-100">
                  <div className="text-[9px] tracking-[0.22em] uppercase text-stone-300 mb-2 text-center">
                    Demo Admin
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Admin principal', email: 'admin@juhnios.com' },
                      { label: 'Admin 2', email: 'administrador2@juhnios.com' },
                    ].map(({ label, email: adminEmail }) => (
                      <button
                        key={adminEmail}
                        type="button"
                        onClick={() => { setEmail(adminEmail); }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-stone-100 hover:bg-stone-50 transition-colors"
                      >
                        <span className="text-[10px] text-stone-500">
                          <strong className="text-stone-700">{label}:</strong> {adminEmail}
                        </span>
                      </button>
                    ))}
                    <p className="text-[9px] text-stone-300 text-center pt-1">Contraseña demo: Admin123!</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
