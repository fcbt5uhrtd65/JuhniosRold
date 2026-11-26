import { useState } from 'react';
import { Modal, Field, inputCls, selectCls, ImageUploader, PrimaryButton, SecondaryButton } from './AdminUI';
import { useToast } from '../../contexts/ToastContext';
import { createProductVariant, generateShortSku, getProductByIdForAdmin as getProductById, type Product } from '../../services/products.service';
import { createInitialStock, setInventoryQuantity } from '../../services/inventory.service';

interface AddVariantModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onCreated: (product: Product) => void | Promise<void>;
}

const PRESENTATION_UNITS = ['ML', 'LT', 'GR', 'KG', 'UND'] as const;

// Tipo de venta de la presentación. 'UNIDAD' es el comportamiento de siempre;
// los demás son empaques que traen varias unidades (se guardan en attributes).
const PACK_TYPES = [
  { value: 'UNIDAD', label: 'Unidad individual' },
  { value: 'DISPLAY', label: 'Display' },
  { value: 'CAJA', label: 'Caja' },
  { value: 'PAQUETE', label: 'Paquete' },
] as const;

type PackType = (typeof PACK_TYPES)[number]['value'];

interface FormState {
  tipoVenta: PackType;
  unidadesPorEmpaque: string;
  presentacionNumero: string;
  presentacionUnidad: (typeof PRESENTATION_UNITS)[number];
  sku: string;
  precio: string;
  precioCosto: string;
  stockInicial: string;
  stockMinimo: string;
  imagen: string;
}

const EMPTY_FORM: FormState = {
  tipoVenta: 'UNIDAD',
  unidadesPorEmpaque: '',
  presentacionNumero: '',
  presentacionUnidad: 'ML',
  sku: '',
  precio: '',
  precioCosto: '',
  stockInicial: '0',
  stockMinimo: '10',
  imagen: '',
};

export function AddVariantModal({ open, onClose, productId, productName, onCreated }: AddVariantModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const packName = PACK_TYPES.find(t => t.value === form.tipoVenta)?.label ?? 'Display';
  const contenido = form.presentacionNumero ? `${form.presentacionNumero} ${form.presentacionUnidad}` : '';
  const packLabel = form.tipoVenta === 'UNIDAD'
    ? contenido
    : `${packName} x${form.unidadesPorEmpaque || '?'}${contenido ? ` · ${contenido}` : ''}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const presentacionNumero = form.presentacionNumero ? Number(form.presentacionNumero) : undefined;
    const precio = Number(form.precio);
    if (!presentacionNumero || presentacionNumero <= 0) {
      toast.error('Ingresa un número de presentación válido.');
      return;
    }
    if (!precio || precio <= 0) {
      toast.error('Ingresa un precio de venta válido.');
      return;
    }
    const isPack = form.tipoVenta !== 'UNIDAD';
    const unidadesPorEmpaque = Number(form.unidadesPorEmpaque);
    if (isPack && (!Number.isInteger(unidadesPorEmpaque) || unidadesPorEmpaque < 2)) {
      toast.error('Indica cuántas unidades trae el empaque (mínimo 2).');
      return;
    }
    // El SKU se fija aquí para poder ubicar con certeza la presentación creada
    // (un display puede tener el mismo contenido, p.ej. 50 ML, que la unidad).
    const sku = form.sku.trim() || generateShortSku();

    setIsSubmitting(true);
    try {
      await createProductVariant(productId, {
        sku,
        ...(isPack ? { variant_name: packLabel } : {}),
        presentation_number: presentacionNumero,
        presentation_unit: form.presentacionUnidad,
        ...(isPack ? { variant_attributes: { pack_type: form.tipoVenta, pack_units: unidadesPorEmpaque } } : {}),
        price: precio,
        cost: form.precioCosto ? Number(form.precioCosto) : undefined,
        variant_images: form.imagen ? [form.imagen] : [],
      });
      const full = await getProductById(productId);
      const created = full.variants.find(v => v.sku === sku)
        ?? full.variants.find(v => v.presentation_number === presentacionNumero && v.presentation_unit === form.presentacionUnidad)
        ?? full.variants[full.variants.length - 1];
      if (created) {
        const stockMinimo = form.stockMinimo ? Number(form.stockMinimo) : 10;
        const stockInicial = form.stockInicial ? Number(form.stockInicial) : 0;
        const stock = await createInitialStock(created.id, stockMinimo);
        if (stock && stockInicial > 0) {
          await setInventoryQuantity(
            { variantId: created.id, locationId: stock.locationId, quantity: 0 },
            stockInicial,
            'Stock inicial al crear la presentación',
          );
        }
      }
      await onCreated(full);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo agregar la presentación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Nueva presentación · ${productName}`} open={open} onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo de venta" required>
            <select
              value={form.tipoVenta}
              onChange={e => set({ tipoVenta: e.target.value as PackType })}
              className={selectCls}
            >
              {PACK_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </Field>
          {form.tipoVenta !== 'UNIDAD' && (
            <Field label="Unidades que trae" required>
              <input
                type="number"
                min="2"
                step="1"
                value={form.unidadesPorEmpaque}
                onChange={e => set({ unidadesPorEmpaque: e.target.value })}
                className={inputCls}
                placeholder="12, 24..."
                required
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={form.tipoVenta === 'UNIDAD' ? 'Número de presentación' : 'Contenido de cada unidad'} required>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.presentacionNumero}
              onChange={e => set({ presentacionNumero: e.target.value })}
              className={inputCls}
              placeholder="50, 120..."
              required
            />
          </Field>
          <Field label="Unidad" required>
            <select
              value={form.presentacionUnidad}
              onChange={e => set({ presentacionUnidad: e.target.value as FormState['presentacionUnidad'] })}
              className={selectCls}
            >
              {PRESENTATION_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </Field>
        </div>

        {form.tipoVenta !== 'UNIDAD' && (
          <p className="-mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Se mostrará como <span className="font-semibold text-gray-800">{packLabel}</span>.
            El precio y el stock son por {packName.toLowerCase()} completo.
          </p>
        )}

        <Field label="Código / SKU (opcional, se genera uno si lo dejas vacío)">
          <input
            type="text"
            value={form.sku}
            onChange={e => set({ sku: e.target.value })}
            className={inputCls}
            placeholder="SKU-001"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio de venta (COP)" required>
            <input
              type="number"
              min="0"
              step="100"
              value={form.precio}
              onChange={e => set({ precio: e.target.value })}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Precio de costo (COP)">
            <input
              type="number"
              min="0"
              step="100"
              value={form.precioCosto}
              onChange={e => set({ precioCosto: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Stock inicial">
            <input
              type="number"
              min="0"
              value={form.stockInicial}
              onChange={e => set({ stockInicial: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Stock mínimo">
            <input
              type="number"
              min="0"
              value={form.stockMinimo}
              onChange={e => set({ stockMinimo: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Imagen de esta presentación</p>
          <div className="max-w-[220px]">
            <ImageUploader value={form.imagen} onChange={v => set({ imagen: v })} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creando...' : 'Crear presentación'}
          </PrimaryButton>
          <SecondaryButton onClick={handleClose}>Cancelar</SecondaryButton>
        </div>
      </form>
    </Modal>
  );
}
