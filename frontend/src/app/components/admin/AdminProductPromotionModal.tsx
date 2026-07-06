import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Field, inputCls, selectCls, Badge, PrimaryButton, SecondaryButton } from './AdminUI';
import { useToast } from '../../contexts/ToastContext';
import { getCategories } from '../../services/products.service';
import {
  getPromotionsForProduct,
  createPromotion,
  updatePromotion,
  deletePromotion,
  type Promotion,
  type DiscountType,
  type PromotionScope,
} from '../../services/promotions.service';

interface AdminProductPromotionModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  categorySlug: string;
}

interface FormState {
  name: string;
  discount_type: DiscountType;
  discount_value: string;
  scope: Extract<PromotionScope, 'PRODUCT' | 'CATEGORY'>;
  starts_at: string;
  ends_at: string;
  priority: string;
  is_active: boolean;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nowLocal(): string {
  return toDatetimeLocal(new Date().toISOString());
}

const EMPTY_FORM: FormState = {
  name: '',
  discount_type: 'PERCENTAGE',
  discount_value: '',
  scope: 'PRODUCT',
  starts_at: nowLocal(),
  ends_at: '',
  priority: '0',
  is_active: true,
};

export function AdminProductPromotionModal({ open, onClose, productId, productName, categorySlug }: AdminProductPromotionModalProps) {
  const toast = useToast();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setIsLoading(true);
    Promise.all([getPromotionsForProduct(productId), getCategories()])
      .then(([promos, categories]) => {
        setPromotions(promos);
        setCategoryId(categories.find(c => c.slug === categorySlug)?.id ?? null);
      })
      .catch(() => toast.error('No se pudieron cargar las promociones del producto.'))
      .finally(() => setIsLoading(false));
  }, [open, productId, categorySlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const discountValue = Number(form.discount_value);
    if (!form.name.trim() || !discountValue || discountValue <= 0) {
      toast.error('Completa el nombre y un valor de descuento válido.');
      return;
    }
    if (form.scope === 'CATEGORY' && !categoryId) {
      toast.error('No se pudo determinar la categoría de este producto.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createPromotion({
        name: form.name.trim(),
        discount_type: form.discount_type,
        discount_value: discountValue,
        scope: form.scope,
        ...(form.scope === 'PRODUCT' ? { product: productId } : { category: categoryId! }),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        priority: Number(form.priority) || 0,
        is_active: form.is_active,
      });
      setPromotions(prev => [created, ...prev]);
      setForm(EMPTY_FORM);
      toast.success('Promoción creada correctamente.');
    } catch {
      toast.error('No se pudo crear la promoción.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(promo: Promotion) {
    try {
      const updated = await updatePromotion(promo.id, { is_active: !promo.is_active });
      setPromotions(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    } catch {
      toast.error('No se pudo actualizar la promoción.');
    }
  }

  async function handleDelete(promo: Promotion) {
    if (!confirm(`¿Eliminar la promoción "${promo.name}"?`)) return;
    try {
      await deletePromotion(promo.id);
      setPromotions(prev => prev.filter(p => p.id !== promo.id));
      toast.success('Promoción eliminada.');
    } catch {
      toast.error('No se pudo eliminar la promoción.');
    }
  }

  return (
    <Modal title={`Promociones · ${productName}`} open={open} onClose={onClose} wide>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Promociones activas</p>
          {isLoading ? (
            <p className="text-xs text-gray-400">Cargando...</p>
          ) : promotions.length === 0 ? (
            <p className="text-xs text-gray-400">Este producto no tiene promociones configuradas.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {promotions.map(promo => (
                <div key={promo.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{promo.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {promo.discount_type === 'PERCENTAGE' ? `${promo.discount_value}%` : `$${promo.discount_value.toLocaleString()}`}
                      {' · '}
                      {promo.scope === 'CATEGORY' ? 'Toda la categoría' : 'Este producto'}
                      {promo.ends_at ? ` · hasta ${new Date(promo.ends_at).toLocaleDateString('es-CO')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => handleToggleActive(promo)}>
                      <Badge label={promo.is_active ? 'Activa' : 'Inactiva'} color={promo.is_active ? 'green' : 'gray'} />
                    </button>
                    <button
                      onClick={() => handleDelete(promo)}
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nueva promoción</p>
          <Field label="Nombre" required>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className={inputCls}
              placeholder="Ej. Verano 20% OFF"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de descuento" required>
              <select
                value={form.discount_type}
                onChange={e => setForm({ ...form, discount_type: e.target.value as DiscountType })}
                className={selectCls}
              >
                <option value="PERCENTAGE">Porcentaje (%)</option>
                <option value="FIXED_AMOUNT">Monto fijo ($)</option>
              </select>
            </Field>
            <Field label={form.discount_type === 'PERCENTAGE' ? 'Porcentaje' : 'Monto'} required>
              <input
                type="number"
                min={0}
                max={form.discount_type === 'PERCENTAGE' ? 100 : undefined}
                value={form.discount_value}
                onChange={e => setForm({ ...form, discount_value: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Aplica a" required>
            <select
              value={form.scope}
              onChange={e => setForm({ ...form, scope: e.target.value as FormState['scope'] })}
              className={selectCls}
            >
              <option value="PRODUCT">Solo este producto</option>
              <option value="CATEGORY">Toda su categoría</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Inicio" required>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={e => setForm({ ...form, starts_at: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Fin (opcional)">
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={e => setForm({ ...form, ends_at: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Prioridad">
            <input
              type="number"
              min={0}
              value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}
              className={inputCls}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <PrimaryButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Crear promoción'}
            </PrimaryButton>
            <SecondaryButton onClick={onClose}>Cerrar</SecondaryButton>
          </div>
        </form>
      </div>
    </Modal>
  );
}
