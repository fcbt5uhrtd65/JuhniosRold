import { useState } from 'react';
import { motion } from 'motion/react';
import { X, User, Mail, Phone, MapPin, Save } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfile({ isOpen, onClose }: UserProfileProps) {
  const { currentUser, updateProfile } = useUser();
  const [formData, setFormData] = useState({
    nombre: currentUser?.nombre || '',
    email: currentUser?.email || '',
    telefono: currentUser?.telefono || '',
    direccion: currentUser?.direccion || '',
    ciudad: currentUser?.ciudad || '',
  });
  const [success, setSuccess] = useState(false);

  if (!isOpen || !currentUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 2000);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-foreground/40 z-50"
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-background z-50 flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs tracking-[0.2em] uppercase mb-2">
              Mi Perfil
            </div>
            <div className="text-xs text-muted-foreground">
              Edita tu información personal
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:opacity-50 transition-opacity"
          >
            <X className="w-5 h-5" strokeWidth={1} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-50 border border-green-200 text-xs text-green-900"
            >
              ✓ Perfil actualizado correctamente
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre */}
            <div>
              <label className="block text-[10px] tracking-wider uppercase text-muted-foreground mb-2">
                Nombre completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1} />
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] tracking-wider uppercase text-muted-foreground mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                  required
                />
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-[10px] tracking-wider uppercase text-muted-foreground mb-2">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1} />
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                  placeholder="3001234567"
                />
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-[10px] tracking-wider uppercase text-muted-foreground mb-2">
                Dirección
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" strokeWidth={1} />
                <textarea
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors resize-none"
                  rows={2}
                  placeholder="Calle 123 #45-67"
                />
              </div>
            </div>

            {/* Ciudad */}
            <div>
              <label className="block text-[10px] tracking-wider uppercase text-muted-foreground mb-2">
                Ciudad
              </label>
              <input
                type="text"
                value={formData.ciudad}
                onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                placeholder="Bogotá"
              />
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" strokeWidth={1} />
              Guardar cambios
            </motion.button>
          </form>

          {/* Account Info */}
          <div className="mt-8 pt-8 border-t border-border">
            <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-4">
              Información de cuenta
            </div>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>ID de usuario:</span>
                <span className="font-mono">{currentUser.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Cuenta creada:</span>
                <span>Demo</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
