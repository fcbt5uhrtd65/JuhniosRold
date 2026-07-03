import { useEffect, useRef, useState } from 'react';
import { Truck, Plus, Trash2, Loader2, Save, Search, MapPin, Route, Gift, Warehouse } from 'lucide-react';
import {
  getShippingSettings,
  updateShippingSettings,
  getShippingZones,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  type ShippingSettings,
  type ShippingZone,
  type ShippingZoneType,
} from '../../services/shipping.service';
import { PageHeader, Card, Field, inputCls, selectCls, PrimaryButton, SecondaryButton, Table, Th, Td, Badge, LoadingState, type BadgeColor } from './AdminUI';
import { useToast } from '../../contexts/ToastContext';
import { InteractiveLocationMap } from '../ui/InteractiveLocationMap';
import { LocationPicker } from '../ui/LocationPicker';
import { reverseGeocode, searchAddress } from '../../services/nominatim.service';
import { geographyService } from '../../services/geography.service';
import { EMPTY_LOCATION, type LocationValue } from '../../services/geography.types';
import type { NominatimResult } from '../../services/nominatim.types';

const ORIGIN_SEARCH_DEBOUNCE_MS = 400;

// origin_latitude/origin_longitude are DecimalField(max_digits=9, decimal_places=6) on the backend
function toDecimalString(value: number | string): string {
  return Number(value).toFixed(6);
}

const ZONE_TYPE_LABEL: Record<ShippingZoneType, string> = {
  LOCAL: 'Local',
  REGIONAL: 'Regional',
  NATIONAL: 'Nacional',
};

const ZONE_TYPE_COLOR: Record<ShippingZoneType, BadgeColor> = {
  LOCAL: 'green',
  REGIONAL: 'blue',
  NATIONAL: 'purple',
};

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-[#2a4038]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </label>
  );
}

function SectionCard({ icon: Icon, title, hint, children, actions }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; hint?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#2a4038]/8 flex items-center justify-center text-[#2a4038] flex-shrink-0">
            <Icon size={15} />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {actions}
      </div>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">{hint}</p>}
    </Card>
  );
}

const EMPTY_ZONE_FORM = {
  name: '',
  zone_type: 'REGIONAL' as ShippingZoneType,
  department: '',
  city: '',
  surcharge: '0',
  requires_manual_quote: false,
  is_active: true,
};

export function AdminShipping() {
  const toast = useToast();
  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [form, setForm] = useState<Partial<ShippingSettings>>({});
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [zoneForm, setZoneForm] = useState(EMPTY_ZONE_FORM);
  const [showZoneForm, setShowZoneForm] = useState(false);

  const [originLoc, setOriginLoc] = useState<LocationValue>(EMPTY_LOCATION);
  const [originQuery, setOriginQuery] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState<NominatimResult[]>([]);
  const [originSearching, setOriginSearching] = useState(false);
  const [originSuggestionsOpen, setOriginSuggestionsOpen] = useState(false);
  const [originReverseLoading, setOriginReverseLoading] = useState(false);
  const originDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originSearchContainerRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    setIsLoading(true);
    Promise.all([getShippingSettings(), getShippingZones()])
      .then(([settingsRes, zonesRes]) => {
        setSettings(settingsRes);
        setForm(settingsRes);
        setZones(zonesRes);
        geographyService
          .resolveLocationByNames({ country: 'Colombia', state: settingsRes.origin_department, city: settingsRes.origin_city })
          .then(setOriginLoc);
      })
      .catch(() => toast.error('No se pudo cargar la configuración de envíos.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadData, []);

  const updateField = <K extends keyof ShippingSettings>(key: K, value: ShippingSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  // Close origin suggestions dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (originSearchContainerRef.current && !originSearchContainerRef.current.contains(e.target as Node)) {
        setOriginSuggestionsOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Debounced origin address search — scoped strictly to the selected país/departamento above
  useEffect(() => {
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    if (!originQuery.trim()) {
      setOriginSuggestions([]);
      return;
    }
    originDebounceRef.current = setTimeout(async () => {
      setOriginSearching(true);
      const results = await searchAddress(originQuery, {
        country: originLoc.countryName || 'Colombia',
        state: originLoc.stateName,
        strictScope: true,
      });
      setOriginSearching(false);
      setOriginSuggestions(results);
    }, ORIGIN_SEARCH_DEBOUNCE_MS);
    return () => {
      if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    };
  }, [originQuery, originLoc.countryName, originLoc.stateName]);

  const handleSelectOriginSuggestion = async (result: NominatimResult) => {
    const resolvedLocation = await geographyService.resolveLocationFromGeocode(result);
    setOriginLoc(resolvedLocation);
    setForm((current) => ({
      ...current,
      origin_address: result.display_name,
      origin_city: resolvedLocation.cityName || current.origin_city,
      origin_department: resolvedLocation.stateName || current.origin_department,
      origin_latitude: toDecimalString(result.lat),
      origin_longitude: toDecimalString(result.lon),
    }));
    setOriginQuery('');
    setOriginSuggestions([]);
    setOriginSuggestionsOpen(false);
  };

  const handleOriginMarkerMove = (lat: number, lng: number) => {
    setForm((current) => ({ ...current, origin_latitude: toDecimalString(lat), origin_longitude: toDecimalString(lng) }));
    setOriginReverseLoading(true);
    reverseGeocode(lat, lng).then(async (result) => {
      if (!result) {
        setOriginReverseLoading(false);
        return;
      }
      const resolvedLocation = await geographyService.resolveLocationFromGeocode(result);
      setOriginReverseLoading(false);
      setOriginLoc(resolvedLocation);
      setForm((current) => ({
        ...current,
        origin_address: result.display_name,
        origin_city: resolvedLocation.cityName || current.origin_city,
        origin_department: resolvedLocation.stateName || current.origin_department,
      }));
    });
  };

  const handleOriginLocationChange = (loc: LocationValue) => {
    setOriginLoc(loc);
    setForm((current) => ({
      ...current,
      origin_city: loc.cityName || current.origin_city,
      origin_department: loc.stateName || current.origin_department,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Partial<ShippingSettings> = {
        ...form,
        origin_latitude: form.origin_latitude ? toDecimalString(form.origin_latitude) : null,
        origin_longitude: form.origin_longitude ? toDecimalString(form.origin_longitude) : null,
      };
      const updated = await updateShippingSettings(payload);
      setSettings(updated);
      setForm(updated);
      toast.success('Configuración de envíos actualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateZone = async () => {
    if (!zoneForm.name.trim()) {
      toast.warning('Ingresa un nombre para la zona.');
      return;
    }
    try {
      const created = await createShippingZone(zoneForm);
      setZones((current) => [...current, created]);
      setZoneForm(EMPTY_ZONE_FORM);
      setShowZoneForm(false);
      toast.success('Zona de envío creada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la zona.');
    }
  };

  const handleToggleZone = async (zone: ShippingZone, field: 'is_active' | 'requires_manual_quote') => {
    try {
      const updated = await updateShippingZone(zone.id, { [field]: !zone[field] });
      setZones((current) => current.map((z) => (z.id === zone.id ? updated : z)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la zona.');
    }
  };

  const handleDeleteZone = async (zone: ShippingZone) => {
    if (!window.confirm(`¿Eliminar la zona "${zone.name}"?`)) return;
    try {
      await deleteShippingZone(zone.id);
      setZones((current) => current.filter((z) => z.id !== zone.id));
      toast.info('Zona eliminada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la zona.');
    }
  };

  if (isLoading || !settings) {
    return <LoadingState label="Cargando configuración de envíos…" />;
  }

  return (
    <div>
      <PageHeader
        title="Configuración de Envíos"
        subtitle="Tarifas, cálculo por distancia, envío gratis y zonas especiales de cobertura."
        actions={
          <PrimaryButton onClick={handleSave} disabled={isSaving} icon={isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
            Guardar cambios
          </PrimaryButton>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <SectionCard
          icon={Truck}
          title="Tarifas por zona"
          hint="Local: Barranquilla y área metropolitana. Regional: resto del Atlántico. Nacional: resto de Colombia."
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tarifa local">
              <input type="number" className={inputCls} value={form.local_rate ?? ''} onChange={(e) => updateField('local_rate', e.target.value)} />
            </Field>
            <Field label="Tarifa regional">
              <input type="number" className={inputCls} value={form.regional_rate ?? ''} onChange={(e) => updateField('regional_rate', e.target.value)} />
            </Field>
            <Field label="Tarifa nacional">
              <input type="number" className={inputCls} value={form.national_rate ?? ''} onChange={(e) => updateField('national_rate', e.target.value)} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          icon={Route}
          title="Cálculo por distancia"
          hint="costo = valor base + (distancia_km × valor por km)"
          actions={<Switch checked={Boolean(form.enable_distance_calc)} onChange={(v) => updateField('enable_distance_calc', v)} label="Activar" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor base">
              <input type="number" className={inputCls} value={form.base_rate ?? ''} onChange={(e) => updateField('base_rate', e.target.value)} />
            </Field>
            <Field label="Valor por km">
              <input type="number" className={inputCls} value={form.rate_per_km ?? ''} onChange={(e) => updateField('rate_per_km', e.target.value)} />
            </Field>
            <Field label="Cobro mínimo">
              <input type="number" className={inputCls} value={form.min_charge ?? ''} onChange={(e) => updateField('min_charge', e.target.value)} />
            </Field>
            <Field label="Cobro máximo">
              <input type="number" className={inputCls} value={form.max_charge ?? ''} onChange={(e) => updateField('max_charge', e.target.value)} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          icon={Gift}
          title="Envío gratis"
          actions={<Switch checked={Boolean(form.enable_free_shipping)} onChange={(v) => updateField('enable_free_shipping', v)} label="Activar" />}
        >
          <Field label="Monto mínimo para envío gratis">
            <input type="number" className={inputCls} value={form.free_shipping_threshold ?? ''} onChange={(e) => updateField('free_shipping_threshold', e.target.value)} />
          </Field>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Switch checked={Boolean(form.enable_manual_quote_fallback)} onChange={(v) => updateField('enable_manual_quote_fallback', v)} label="Cotización manual para zonas sin cobertura" />
          </div>
        </SectionCard>
      </div>

      <div className="mb-6">
        <SectionCard icon={Warehouse} title="Origen (bodega)">
          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <div className="mb-3">
                <LocationPicker value={originLoc} onChange={handleOriginLocationChange} />
              </div>

              <div className="relative mb-3" ref={originSearchContainerRef}>
                <div className="relative flex items-center rounded-lg border border-gray-200 bg-white">
                  <Search className="absolute left-3 w-4 h-4 text-gray-300" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={originQuery}
                    disabled={!originLoc.stateId}
                    onChange={(e) => { setOriginQuery(e.target.value); setOriginSuggestionsOpen(true); }}
                    onFocus={() => setOriginSuggestionsOpen(true)}
                    placeholder={originLoc.stateId ? `Buscar dirección en ${originLoc.stateName}` : 'Selecciona país y departamento primero'}
                    className="w-full pl-9 pr-8 py-2.5 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none rounded-lg disabled:cursor-not-allowed"
                  />
                  {originSearching && <Loader2 className="absolute right-3 w-3.5 h-3.5 animate-spin text-gray-300" strokeWidth={1.5} />}
                </div>
                {originSuggestionsOpen && originSuggestions.length > 0 && (
                  <div className="absolute z-[1100] left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {originSuggestions.map((result) => (
                      <button
                        key={result.place_id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleSelectOriginSuggestion(result); }}
                        className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        {result.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {form.origin_address && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 leading-relaxed mb-3">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#2a4038]" strokeWidth={1.5} />
                  <span className="flex-1">
                    {form.origin_address}
                    {originReverseLoading && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin" strokeWidth={1.5} />}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Dirección de origen">
                  <input className={inputCls} value={form.origin_address ?? ''} onChange={(e) => updateField('origin_address', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Latitud">
                    <input type="number" step="any" className={inputCls} value={form.origin_latitude ?? ''} onChange={(e) => updateField('origin_latitude', e.target.value)} />
                  </Field>
                  <Field label="Longitud">
                    <input type="number" step="any" className={inputCls} value={form.origin_longitude ?? ''} onChange={(e) => updateField('origin_longitude', e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>

            <InteractiveLocationMap
              lat={form.origin_latitude ? Number(form.origin_latitude) : null}
              lng={form.origin_longitude ? Number(form.origin_longitude) : null}
              onMarkerMove={handleOriginMarkerMove}
              className="h-full min-h-[280px] rounded-lg overflow-hidden border border-gray-200"
            />
          </div>
        </SectionCard>
      </div>

      <PageHeader
        title="Zonas especiales"
        subtitle="Recargos o cotización manual obligatoria por ciudad/departamento."
        onNew={() => setShowZoneForm((v) => !v)}
        newLabel="Nueva zona"
      />

      {showZoneForm && (
        <Card className="p-5 mb-4">
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <Field label="Nombre" required>
              <input className={inputCls} value={zoneForm.name} onChange={(e) => setZoneForm((c) => ({ ...c, name: e.target.value }))} />
            </Field>
            <Field label="Tipo de zona">
              <select className={selectCls} value={zoneForm.zone_type} onChange={(e) => setZoneForm((c) => ({ ...c, zone_type: e.target.value as ShippingZoneType }))}>
                <option value="LOCAL">Local</option>
                <option value="REGIONAL">Regional</option>
                <option value="NATIONAL">Nacional</option>
              </select>
            </Field>
            <Field label="Recargo">
              <input type="number" className={inputCls} value={zoneForm.surcharge} onChange={(e) => setZoneForm((c) => ({ ...c, surcharge: e.target.value }))} />
            </Field>
            <Field label="Departamento">
              <input className={inputCls} value={zoneForm.department} onChange={(e) => setZoneForm((c) => ({ ...c, department: e.target.value }))} />
            </Field>
            <Field label="Ciudad (opcional)">
              <input className={inputCls} value={zoneForm.city} onChange={(e) => setZoneForm((c) => ({ ...c, city: e.target.value }))} />
            </Field>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer pb-2.5">
                <input type="checkbox" checked={zoneForm.requires_manual_quote} onChange={(e) => setZoneForm((c) => ({ ...c, requires_manual_quote: e.target.checked }))} />
                Requiere cotización manual
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <PrimaryButton onClick={handleCreateZone} icon={<Plus size={14} />}>Crear zona</PrimaryButton>
            <SecondaryButton onClick={() => setShowZoneForm(false)}>Cancelar</SecondaryButton>
          </div>
        </Card>
      )}

      <Table>
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th>Tipo</Th>
            <Th>Departamento</Th>
            <Th>Ciudad</Th>
            <Th>Recargo</Th>
            <Th>Cotización manual</Th>
            <Th>Activa</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone.id}>
              <Td>{zone.name}</Td>
              <Td><Badge label={ZONE_TYPE_LABEL[zone.zone_type]} color={ZONE_TYPE_COLOR[zone.zone_type]} /></Td>
              <Td>{zone.department || '—'}</Td>
              <Td>{zone.city || '—'}</Td>
              <Td>${Number(zone.surcharge).toLocaleString('es-CO')}</Td>
              <Td>
                <button onClick={() => handleToggleZone(zone, 'requires_manual_quote')} className="text-xs underline text-gray-500 hover:text-gray-800">
                  {zone.requires_manual_quote ? 'Sí' : 'No'}
                </button>
              </Td>
              <Td>
                <button onClick={() => handleToggleZone(zone, 'is_active')} className="text-xs underline text-gray-500 hover:text-gray-800">
                  {zone.is_active ? 'Activa' : 'Inactiva'}
                </button>
              </Td>
              <Td>
                <button onClick={() => handleDeleteZone(zone)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </Td>
            </tr>
          ))}
          {zones.length === 0 && (
            <tr><Td className="text-center text-gray-400 py-6">Sin zonas especiales configuradas.</Td></tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
