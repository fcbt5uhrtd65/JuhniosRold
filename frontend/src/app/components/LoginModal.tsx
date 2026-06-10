import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminAccess: (email: string, password: string) => void | Promise<void>;
}

export function LoginModal({ isOpen, onClose, onAdminAccess }: LoginModalProps) {
  const { login: customerLogin, register: customerRegister, resetPassword } = useUser();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAdminHint, setShowAdminHint] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      // Handle forgot password
      if (isForgotPassword) {
        const ok = resetPassword(email);
        if (ok) {
          setSuccess('Se ha enviado una contraseña temporal a tu correo');
          setTimeout(() => {
            setIsForgotPassword(false);
            setEmail('');
          }, 3000);
        } else {
          setError('No existe una cuenta con este email');
        }
        return;
      }

      // Check if it's an admin email
      const adminEmails = ['admin@juhnios.com', 'vendedor@juhnios.com', 'distribuidor@juhnios.com'];
      if (adminEmails.includes(email.toLowerCase())) {
        await onAdminAccess(email, password);
        return;
      }

      // Handle customer login/register
      if (isLogin) {
        const ok = await customerLogin(email, password);
        if (ok) {
          onClose();
          setEmail('');
          setPassword('');
        } else {
          setError('Email o contraseña incorrectos');
        }
      } else {
        if (!nombre.trim()) {
          setError('Por favor ingresa tu nombre completo');
          return;
        }
        const ok = await customerRegister(nombre, email, password);
        if (ok) {
          onClose();
          setNombre('');
          setEmail('');
          setPassword('');
        } else {
          setError('Este email ya está registrado');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-foreground/90 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-background p-8 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 hover:opacity-50 transition-opacity"
            >
              <X className="w-4 h-4" strokeWidth={1} />
            </button>

            <div className="mb-8">
              <div className="text-xs tracking-[0.3em] uppercase mb-4 text-muted-foreground">
                JUHNIOS ROLD
              </div>
              <h2 className="text-3xl mb-2">
                {isForgotPassword ? 'Recuperar Contraseña' : isLogin ? 'Iniciar Sesión' : 'Registrarse'}
              </h2>
              <div className="w-12 h-px bg-foreground"></div>
            </div>

            {!isForgotPassword && (
              <div className="flex gap-2 mb-6 border-b border-border">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 pb-3 text-xs tracking-wider uppercase transition-all relative ${
                    isLogin ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                  }`}
                >
                  Ingresar
                  {isLogin && (
                    <motion.div
                      layoutId="loginTab"
                      className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                    />
                  )}
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 pb-3 text-xs tracking-wider uppercase transition-all relative ${
                    !isLogin ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                  }`}
                >
                  Registrarse
                  {!isLogin && (
                    <motion.div
                      layoutId="loginTab"
                      className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                    />
                  )}
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 bg-red-50 border border-red-200 text-xs text-red-900"
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 bg-green-50 border border-green-200 text-xs text-green-900"
                >
                  {success}
                </motion.div>
              )}

              {isForgotPassword && (
                <div className="text-xs text-muted-foreground mb-4">
                  Ingresa tu email y te enviaremos una contraseña temporal
                </div>
              )}

              {!isLogin && !isForgotPassword && (
                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1} />
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors"
                      placeholder="María González"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      const adminEmails = ['admin@juhnios.com', 'vendedor@juhnios.com', 'distribuidor@juhnios.com'];
                      setShowAdminHint(adminEmails.includes(e.target.value.toLowerCase()));
                    }}
                    className="w-full pl-10 pr-3 py-3 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors"
                    placeholder="tu@email.com"
                    required
                  />
                </div>
              </div>

              {!isForgotPassword && (
                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              )}

              {showAdminHint && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-600" strokeWidth={1} />
                  <div className="text-[10px] text-blue-900">
                    Acceso administrativo detectado
                  </div>
                </motion.div>
              )}

              {isLogin && !isForgotPassword && (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError('');
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Procesando...'
                  : isForgotPassword
                    ? 'Enviar contraseña temporal'
                    : isLogin
                      ? 'Iniciar Sesión'
                      : 'Crear Cuenta'}
              </button>

              {isForgotPassword && (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Volver a iniciar sesión
                </button>
              )}
            </form>

            {isLogin && !isForgotPassword && (
              <div className="mt-6 pt-6 border-t border-border">
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                  Acceso Admin - Demo:
                </div>
                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => setEmail('admin@juhnios.com')}
                    className="w-full text-left px-3 py-2 border border-border hover:bg-secondary transition-colors"
                  >
                    <strong>Admin:</strong> admin@juhnios.com
                  </button>
                  <button
                    onClick={() => setEmail('vendedor@juhnios.com')}
                    className="w-full text-left px-3 py-2 border border-border hover:bg-secondary transition-colors"
                  >
                    <strong>Vendedor:</strong> vendedor@juhnios.com
                  </button>
                  <button
                    onClick={() => setEmail('distribuidor@juhnios.com')}
                    className="w-full text-left px-3 py-2 border border-border hover:bg-secondary transition-colors"
                  >
                    <strong>Distribuidor:</strong> distribuidor@juhnios.com
                  </button>
                  <div className="text-[10px] text-muted-foreground mt-2 px-3">
                    * Cualquier contraseña funciona en modo demo
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}