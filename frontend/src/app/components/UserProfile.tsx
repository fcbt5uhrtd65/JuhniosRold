import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { LocationPicker } from './ui/LocationPicker';
import { DeliveryLocationSection } from './ui/DeliveryLocationSection';
import { EMPTY_LOCATION, type LocationValue } from '../services/geography.types';
import { EMPTY_DELIVERY_LOCATION, type DeliveryLocationValue } from '../services/delivery-location.types';
import { geographyService, type City } from '../services/geography.service';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOCUMENT_TYPES: Record<string, string> = {
  CC: 'Cédula de Ciudadanía',
  CE: 'Cédula de Extranjería',
  PASSPORT: 'Pasaporte',
  NIT: 'NIT',
  OTHER: 'Otro',
  PENDING: 'Sin definir',
};

const inputBaseClass =
  'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-[#2D3A1F] focus:ring-2 focus:ring-[#2D3A1F]/10';

export function UserProfile({ isOpen, onClose }: UserProfileProps) {
  const { currentUser, updateProfile } = useUser();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    telefono: '',
  });
  const [profileLocation, setProfileLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocationValue>(EMPTY_DELIVERY_LOCATION);
  const [profileCities, setProfileCities] = useState<City[]>([]);
  const profileCityNames = useMemo(() => profileCities.map((city) => city.name), [profileCities]);

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Cuando se abre el modal, sincroniza el formulario con los datos reales del usuario
  // y resuelve país/departamento/ciudad guardados a sus IDs para precargar el selector.
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    setError('');
    setSuccess(false);
    setFormData({
      firstName: currentUser.firstName || '',
      lastName: currentUser.lastName || '',
      telefono: currentUser.telefono || '',
    });
    setDeliveryLocation({
      ...EMPTY_DELIVERY_LOCATION,
      address: currentUser.direccion || '',
      reference: currentUser.referencia || '',
      city: currentUser.ciudad || '',
      state: currentUser.departamento || '',
      country: currentUser.pais || '',
      lat: currentUser.latitud ?? null,
      lng: currentUser.longitud ?? null,
      confirmed: Boolean(currentUser.latitud && currentUser.longitud),
    });

    if (!currentUser.pais && !currentUser.departamento && !currentUser.ciudad) {
      setProfileLocation(EMPTY_LOCATION);
      return;
    }

    let active = true;
    setIsLoadingProfile(true);
    geographyService
      .resolveLocationByNames({
        country: currentUser.pais,
        state: currentUser.departamento,
        city: currentUser.ciudad,
      })
      .then((resolved) => {
        if (active) setProfileLocation(resolved);
      })
      .catch(() => {
        if (active) {
          setProfileLocation({
            ...EMPTY_LOCATION,
            countryName: currentUser.pais ?? '',
            stateName: currentUser.departamento ?? '',
            cityName: currentUser.ciudad ?? '',
          });
        }
      })
      .finally(() => {
        if (active) setIsLoadingProfile(false);
      });

    return () => {
      active = false;
    };
    // Solo se sincroniza al abrir el modal: si dependiera de currentUser, guardar
    // cambios dispararía este efecto de nuevo (currentUser cambia de referencia tras
    // updateProfile) y el setSuccess(false) de aquí pisaría el aviso de éxito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!profileLocation.stateId) {
      setProfileCities([]);
      return;
    }

    let cancelled = false;
    geographyService
      .getCities(profileLocation.stateId)
      .then((cities) => {
        if (!cancelled) setProfileCities(cities);
      })
      .catch(() => {
        if (!cancelled) setProfileCities([]);
      });

    return () => {
      cancelled = true;
    };
  }, [profileLocation.stateId]);

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName.trim()) {
      setError('Por favor ingresa tus nombres.');
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Por favor ingresa tus apellidos.');
      return;
    }

    setIsSaving(true);
    const result = await updateProfile({
      firstName: formData.firstName,
      lastName: formData.lastName,
      telefono: formData.telefono,
      direccion: deliveryLocation.address || undefined,
      referencia: deliveryLocation.reference || undefined,
      ciudad: profileLocation.cityName || deliveryLocation.city || undefined,
      departamento: profileLocation.stateName || deliveryLocation.state || undefined,
      pais: deliveryLocation.country || profileLocation.countryName || undefined,
      latitud: deliveryLocation.lat,
      longitud: deliveryLocation.lng,
    });
    setIsSaving(false);

    if (!result.ok) {
      setError(result.message || 'No fue posible guardar los cambios.');
      return;
    }

    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  const documentLabel = currentUser.tipoDocumento
    ? DOCUMENT_TYPES[currentUser.tipoDocumento] ?? currentUser.tipoDocumento
    : null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-950/45 backdrop-blur-sm z-[200]"
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[210] mx-auto flex h-[100dvh] w-full max-w-4xl flex-col bg-[#F7F5F1] shadow-2xl sm:inset-4 sm:h-[calc(100dvh-2rem)] sm:rounded-[32px] sm:border sm:border-white/70"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 bg-white/95 px-5 py-4 sm:rounded-t-[32px] md:px-8">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2D3A1F]">
                  Mi cuenta
                </div>
                <h2 className="text-lg font-semibold text-stone-950 md:text-xl">Mi perfil</h2>
              </div>
              <button
                onClick={onClose}
                disabled={isSaving}
                className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 disabled:opacity-40"
                aria-label="Cerrar perfil"
              >
                <X className="w-5 h-5" strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 md:p-8 md:space-y-6">
              {/* Resumen de cuenta */}
              <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#2D3A1F]/10 text-[#2D3A1F]">
                    <UserIcon className="h-6 w-6" strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xl font-semibold text-stone-950">{currentUser.nombre || 'Sin nombre'}</h3>
                    <p className="truncate text-sm text-stone-500">{currentUser.email}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2D3A1F]/10 px-3 py-1 text-[11px] font-semibold text-[#2D3A1F]">
                        <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Cuenta de cliente
                      </span>
                      {documentLabel && currentUser.numeroDocumento && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-600">
                          <Hash className="h-3.5 w-3.5" strokeWidth={1.8} />
                          {documentLabel}: {currentUser.numeroDocumento}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2D3A1F]">
                      Beneficios mayoristas
                    </div>
                    <h3 className="text-lg font-semibold text-stone-950">Tu acceso para compras por volumen</h3>
                    <p className="mt-1 text-sm text-stone-500">
                      El descuento se activa automáticamente cuando tu carrito supera la compra mínima configurada.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-[#F8F7F4] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Código mayorista</p>
                    <p className="mt-1 font-mono text-sm font-bold text-stone-950">
                      {currentUser.codigoMayorista || 'JR-MAY-PENDIENTE'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    'Descuento especial por compras al por mayor.',
                    'El descuento se activa automáticamente al superar la compra mínima.',
                    'Acceso a promociones especiales.',
                    'Atención para compras por volumen.',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={2} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </section>

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                  <Check className="h-4 w-4" strokeWidth={2} />
                  Perfil actualizado correctamente
                </motion.div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={1.8} />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Datos personales */}
                <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="mb-5 flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-[#2D3A1F]" strokeWidth={1.7} />
                    <h3 className="text-lg font-semibold text-stone-950">Datos personales</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        <UserIcon className="h-3.5 w-3.5" /> Nombres *
                      </span>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className={inputBaseClass}
                        required
                      />
                    </label>
                    <label>
                      <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        <UserIcon className="h-3.5 w-3.5" /> Apellidos *
                      </span>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className={inputBaseClass}
                        required
                      />
                    </label>
                    <label>
                      <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </span>
                      <input
                        type="email"
                        value={currentUser.email}
                        disabled
                        className={inputBaseClass + ' cursor-not-allowed bg-stone-50 text-stone-400'}
                      />
                    </label>
                    <label>
                      <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        <Phone className="h-3.5 w-3.5" /> Teléfono
                      </span>
                      <input
                        type="tel"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        className={inputBaseClass}
                        placeholder="3001234567"
                      />
                    </label>
                    <label>
                      <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        <Hash className="h-3.5 w-3.5" /> Documento
                      </span>
                      <input
                        type="text"
                        value={
                          currentUser.numeroDocumento
                            ? `${documentLabel ?? ''} · ${currentUser.numeroDocumento}`
                            : 'Sin registrar'
                        }
                        disabled
                        className={inputBaseClass + ' cursor-not-allowed bg-stone-50 text-stone-400'}
                      />
                    </label>
                  </div>
                </section>

                {/* Dirección de envío */}
                <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="mb-5 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#2D3A1F]" strokeWidth={1.7} />
                    <h3 className="text-lg font-semibold text-stone-950">Dirección de envío</h3>
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-[#F8F7F4] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                        <MapPin className="h-4 w-4 text-[#2D3A1F]" strokeWidth={1.7} />
                        Ubicación
                      </div>
                      {isLoadingProfile && (
                        <span className="flex items-center gap-1.5 text-xs text-stone-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Cargando ubicación guardada…
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <LocationPicker value={profileLocation} onChange={setProfileLocation} />
                      <DeliveryLocationSection
                        value={deliveryLocation}
                        onChange={setDeliveryLocation}
                        searchScope={{ state: profileLocation.stateName, country: profileLocation.countryName }}
                        cityOptions={profileCityNames}
                        onCityResolved={(cityName) =>
                          setProfileLocation((prev) => ({ ...prev, cityId: null, cityName }))
                        }
                        onLocationResolved={setProfileLocation}
                      />
                    </div>
                  </div>
                </section>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2D3A1F] px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-[#2D3A1F]/15 transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
