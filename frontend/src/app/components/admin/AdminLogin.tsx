import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Mail } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { inputCls } from './AdminUI';

export function AdminLogin() {
  const { login } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);
    if (!success) {
      setError('Credenciales inválidas');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/40 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">Juhnios Rold</p>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Panel interno</h1>
          <div className="w-12 h-0.5 bg-[#2a4038] mx-auto rounded-full" />
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls + ' pl-9'}
                placeholder="usuario@juhnios.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Contraseña</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + ' pl-9'}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Validando...' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Demo - Usuarios internos:</p>
          <div className="space-y-2 text-xs text-gray-600">
            <p><strong className="text-gray-900">Admin:</strong> admin@juhnios.com</p>
            <p><strong className="text-gray-900">RRHH:</strong> rrhh@juhnios.com</p>
            <p><strong className="text-gray-900">Pedidos:</strong> pedidos@juhnios.com</p>
            <p><strong className="text-gray-900">Empleado:</strong> empleado@juhnios.com</p>
            <p className="text-[11px] text-gray-400 mt-2">Contraseña demo: Admin123!</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
