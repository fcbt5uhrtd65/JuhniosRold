import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Mail } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';

export function AdminLogin() {
  const { login } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(email, password);
    if (!success) {
      setError('Credenciales inválidas');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="text-xs tracking-[0.3em] uppercase mb-4">
            JUHNIOS ROLD
          </div>
          <h1 className="text-3xl mb-2">Panel Admin</h1>
          <div className="w-12 h-px bg-foreground mx-auto"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors"
                placeholder="admin@juhnios.com"
                required
              />
            </div>
          </div>

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
                className="w-full pl-10 pr-4 py-3 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-500 text-center">{error}</div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity"
          >
            Iniciar sesión
          </button>
        </form>

        <div className="mt-6 p-4 bg-secondary border border-border">
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
            Demo - Usuarios de prueba:
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <strong>Admin:</strong> admin@juhnios.com
            </div>
            <div>
              <strong>Vendedor:</strong> vendedor@juhnios.com
            </div>
            <div>
              <strong>Distribuidor:</strong> distribuidor@juhnios.com
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">
              * Cualquier contraseña funciona en modo demo
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
