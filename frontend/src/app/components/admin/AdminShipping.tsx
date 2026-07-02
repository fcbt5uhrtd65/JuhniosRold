import { useEffect, useState } from 'react';
import { Truck, Plus, Trash2, Loader2, Save } from 'lucide-react';
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

  const loadData = () => {
    setIsLoading(true);
    Promise.all([getShippingSettings(), getShippingZones()])
      .then(([settingsRes, zonesRes]) => {
        setSettings(settingsRes);
        setForm(settingsRes);
        setZones(zonesRes);
      })
      .catch(() => toast.error('No se pudo cargar la configuración de envíos.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadData, []);

  const updateField = <K extends keyof ShippingSettings>(key: K, value: ShippingSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateShippingSettings(form);
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
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={16} className="text-[#2a4038]" />
            <h3 className="text-sm font-semibold text-gray-900">Tarifas por zona</h3>
          </div>
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
          <p className="text-[11px] text-gray-400 mt-3">
            Local: Barranquilla y área metropolitana. Regional: resto del Atlántico. Nacional: resto de Colombia.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Cálculo por distancia</h3>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={Boolean(form.enable_distance_calc)} onChange={(e) => updateField('enable_distance_calc', e.target.checked)} />
              Activar
            </label>
          </div>
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
          <p className="text-[11px] text-gray-400 mt-3">costo = valor base + (distancia_km × valor por km)</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Envío gratis</h3>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={Boolean(form.enable_free_shipping)} onChange={(e) => updateField('enable_free_shipping', e.target.checked)} />
              Activar
            </label>
          </div>
          <Field label="Monto mínimo para envío gratis">
            <input type="number" className={inputCls} value={form.free_shipping_threshold ?? ''} onChange={(e) => updateField('free_shipping_threshold', e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-4">
            <input type="checkbox" checked={Boolean(form.enable_manual_quote_fallback)} onChange={(e) => updateField('enable_manual_quote_fallback', e.target.checked)} />
            Cotización manual para zonas sin cobertura
          </label>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Origen (bodega)</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ciudad de origen">
              <input className={inputCls} value={form.origin_city ?? ''} onChange={(e) => updateField('origin_city', e.target.value)} />
            </Field>
            <Field label="Departamento de origen">
              <input className={inputCls} value={form.origin_department ?? ''} onChange={(e) => updateField('origin_department', e.target.value)} />
            </Field>
            <Field label="Dirección de origen">
              <input className={inputCls} value={form.origin_address ?? ''} onChange={(e) => updateField('origin_address', e.target.value)} />
            </Field>
            <Field label="Latitud">
              <input type="number" step="any" className={inputCls} value={form.origin_latitude ?? ''} onChange={(e) => updateField('origin_latitude', e.target.value)} />
            </Field>
            <Field label="Longitud">
              <input type="number" step="any" className={inputCls} value={form.origin_longitude ?? ''} onChange={(e) => updateField('origin_longitude', e.target.value)} />
            </Field>
          </div>
        </Card>
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
