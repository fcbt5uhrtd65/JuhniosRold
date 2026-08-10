import { Check, MapPin, Pencil } from 'lucide-react';
import type { DeliveryLocationValue } from '../../services/delivery-location.types';

const OLIVE = '#2D3A1F';

interface DeliveryLocationSectionProps {
  value: DeliveryLocationValue;
  onChange: (value: DeliveryLocationValue) => void;
  /** Department/state and country selected in the LocationPicker above — copied onto the
   * delivery location as-is (no geocoding) so it stays consistent with what the shipping
   * cost calculation and the rest of the address use. */
  searchScope?: { state?: string; country?: string; city?: string };
}

export function DeliveryLocationSection({ value, onChange, searchScope }: DeliveryLocationSectionProps) {
  const canConfirm = value.address.trim().length > 0;

  function handleAddressChange(address: string) {
    onChange({
      ...value,
      address,
      city: searchScope?.city ?? value.city,
      state: searchScope?.state ?? value.state,
      country: searchScope?.country ?? value.country,
      confirmed: false,
    });
  }

  return (
    <div className="space-y-3">
      {/* Dirección */}
      <div>
        <label className="block text-[9px] tracking-[0.28em] uppercase text-stone-400 font-medium mb-1.5">
          Dirección
        </label>
        <div className="relative flex items-center rounded-xl border border-stone-200 bg-white">
          <MapPin className="absolute left-3.5 w-4 h-4 text-stone-300" strokeWidth={1.3} />
          <input
            type="text"
            value={value.address}
            onChange={(e) => handleAddressChange(e.target.value)}
            placeholder="Calle, número, barrio..."
            className="w-full pl-10 pr-4 py-3 bg-transparent text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none rounded-xl"
          />
        </div>
      </div>

      {/* Referencia adicional */}
      <div>
        <label className="block text-[9px] tracking-[0.28em] uppercase text-stone-400 font-medium mb-1.5">
          Referencia adicional (opcional)
        </label>
        <div className="relative flex items-center rounded-xl border border-stone-200 bg-white">
          <input
            type="text"
            value={value.reference}
            onChange={(e) => onChange({ ...value, reference: e.target.value })}
            placeholder="Ej: Casa azul, portón negro, frente al parque"
            className="w-full px-4 py-3 bg-transparent text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none rounded-xl"
          />
        </div>
      </div>

      {/* Confirmar ubicación */}
      {value.confirmed ? (
        <div className="flex items-center justify-between gap-2 px-3.5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
            Dirección confirmada
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...value, confirmed: false })}
            className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 transition-colors"
          >
            <Pencil className="w-3 h-3" strokeWidth={1.5} />
            Cambiar
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onChange({ ...value, confirmed: true })}
          className="w-full py-3 text-white text-[11px] tracking-[0.18em] uppercase font-medium rounded-xl transition-opacity disabled:opacity-40"
          style={{ backgroundColor: OLIVE }}
        >
          Confirmar dirección
        </button>
      )}
    </div>
  );
}
