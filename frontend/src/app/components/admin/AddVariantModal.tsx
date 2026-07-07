import { useState } from 'react';
import { Modal, Field, inputCls, selectCls, ImageUploader, PrimaryButton, SecondaryButton } from './AdminUI';
import { useToast } from '../../contexts/ToastContext';
import { createProductVariant, getProductById, type Product } from '../../services/products.service';
import { createInitialStock } from '../../services/inventory.service';

interface AddVariantModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onCreated: (product: Product) => void | Promise<void>;
}

const PRESENTATION_UNITS = ['ML', 'LT', 'GR', 'KG', 'UND'] as const;

interface FormState {
  presentacionNumero: string;
  presentacionUnidad: (typeof PRESENTATION_UNITS)[number];
  sku: string;
  precio: string;
  precioCosto: string;
  stockMinimo: string;
  imagen: string;
}

const EMPTY_FORM: FormState = {
  presentacionNumero: '',
  presentacionUnidad: 'ML',
  sku: '',
  precio: '',
  precioCosto: '',
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

    setIsSubmitting(true);
    try {
      await createProductVariant(productId, {
        sku: form.sku || undefined,
        presentation_number: presentacionNumero,
        presentation_unit: form.presentacionUnidad,
        price: precio,
        cost: form.precioCosto ? Number(form.precioCosto) : undefined,
        variant_images: form.imagen ? [form.imagen] : [],
      });
      const full = await getProductById(productId);
      const created = full.variants.find(v => v.presentation_number === presentacionNumero && v.presentation_unit === form.presentacionUnidad)
        ?? full.variants[full.variants.length - 1];
      if (created) {
        const stockMinimo = form.stockMinimo ? Number(form.stockMinimo) : 10;
        await createInitialStock(created.id, stockMinimo);
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
          <Field label="Número de presentación" required>
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

        <Field label="Stock mínimo">
          <input
            type="number"
            min="0"
            value={form.stockMinimo}
            onChange={e => set({ stockMinimo: e.target.value })}
            className={inputCls}
          />
        </Field>

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
