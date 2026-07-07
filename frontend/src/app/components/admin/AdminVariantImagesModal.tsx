import { useEffect, useRef, useState } from 'react';
import { Modal, ImageUploader, SecondaryButton } from './AdminUI';
import { useToast } from '../../contexts/ToastContext';
import { getProductById, updateVariantImages, type ProductVariant } from '../../services/products.service';

interface AdminVariantImagesModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onChanged?: () => void | Promise<void>;
}

const MAX_VARIANT_IMAGES = 3;

export function AdminVariantImagesModal({ open, onClose, productId, productName, onChanged }: AdminVariantImagesModalProps) {
  const toast = useToast();
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const lastLoadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      lastLoadKeyRef.current = null;
      return;
    }
    if (lastLoadKeyRef.current === productId) return;
    lastLoadKeyRef.current = productId;

    setIsLoading(true);
    getProductById(productId)
      .then(product => {
        setVariants(product.variants);
        setDrafts(
          Object.fromEntries(
            product.variants.map(variant => [
              variant.id,
              variant.images.length > 0 ? variant.images.map(img => img.image) : (variant.image_url ? [variant.image_url] : []),
            ]),
          ),
        );
      })
      .catch(() => toast.error('No se pudieron cargar las variantes de este producto.'))
      .finally(() => setIsLoading(false));
  }, [open, productId, toast]);

  const handleSave = async (variantId: string) => {
    setSavingVariantId(variantId);
    try {
      await updateVariantImages(variantId, (drafts[variantId] ?? []).filter(Boolean));
      await onChanged?.();
      toast.success('Imágenes de la presentación actualizadas.');
    } catch {
      toast.error('No se pudieron guardar las imágenes de esta presentación.');
    } finally {
      setSavingVariantId(null);
    }
  };

  return (
    <Modal title={`Imágenes por presentación · ${productName}`} open={open} onClose={onClose} wide>
      <div className="flex flex-col gap-8">
        {isLoading ? (
          <p className="text-xs text-gray-400">Cargando presentaciones...</p>
        ) : variants.length === 0 ? (
          <p className="text-xs text-gray-400">Este producto no tiene presentaciones/variantes registradas.</p>
        ) : (
          variants.map(variant => {
            const images = drafts[variant.id] ?? [];
            return (
              <div key={variant.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900">{variant.presentation}</p>
                  <span className="text-[11px] text-gray-400 font-mono">{variant.sku}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[0, 1, 2].map(slot => (
                    <ImageUploader
                      key={slot}
                      value={images[slot] ?? ''}
                      onChange={v => {
                        const next = [...images];
                        if (v) {
                          next[slot] = v;
                        } else {
                          next.splice(slot, 1);
                        }
                        setDrafts(prev => ({ ...prev, [variant.id]: next.filter(Boolean).slice(0, MAX_VARIANT_IMAGES) }));
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => handleSave(variant.id)}
                    disabled={savingVariantId === variant.id}
                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#2a4038] text-white hover:bg-[#1f2f29] transition-colors disabled:opacity-50"
                  >
                    {savingVariantId === variant.id ? 'Guardando...' : 'Guardar imágenes de esta presentación'}
                  </button>
                </div>
              </div>
            );
          })
        )}
        <div className="flex justify-end">
          <SecondaryButton onClick={onClose}>Cerrar</SecondaryButton>
        </div>
      </div>
    </Modal>
  );
}
