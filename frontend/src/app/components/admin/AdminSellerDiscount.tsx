import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Ticket } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { getMyEmployeeProfile, type Employee } from '../../services/employees.service';
import {
  createSellerDiscountCode,
  getSellerDiscountCodes,
  updateSellerDiscountCode,
  type DiscountType,
  type SellerDiscountCode,
} from '../../services/promotions.service';
import { Card, PageHeader, Field, inputCls, selectCls, LoadingState, EmptyState } from './AdminUI';
import { format } from 'date-fns';

interface CodeFormState {
  discountType: DiscountType;
  discountValue: number;
  durationHours: number;
  minOrderAmount: number;
  maxUses: number;
}

const EMPTY_FORM: CodeFormState = {
  discountType: 'PERCENTAGE',
  discountValue: 10,
  durationHours: 24,
  minOrderAmount: 0,
  maxUses: 1,
};

function formatMoney(value: number): string {
  return `$${Math.max(0, value).toLocaleString('es-CO')}`;
}

export function AdminSellerDiscount() {
  const toast = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [myCode, setMyCode] = useState<SellerDiscountCode | null>(null);
  const [form, setForm] = useState<CodeFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const me = await getMyEmployeeProfile();
      setEmployee(me);
      const codes = await getSellerDiscountCodes({ seller: me.id });
      setMyCode(codes[0] ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar tu codigo de descuento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateCode = async () => {
    if (form.discountValue <= 0) {
      toast.error('El descuento debe ser mayor a cero.');
      return;
    }
    if (form.durationHours <= 0) {
      toast.error('Indica por cuantas horas estara vigente el codigo.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        discount_type: form.discountType,
        discount_value: form.discountValue,
        duration_hours: form.durationHours,
        min_order_amount: form.minOrderAmount,
        max_uses: form.maxUses,
        is_active: true,
      };
      // El backend ignora cualquier "seller" enviado por un vendedor y usa
      // siempre su propio registro de empleado: solo puede generar/regenerar
      // el código asociado a sí mismo, nunca el de otro vendedor.
      const saved = myCode
        ? await updateSellerDiscountCode(myCode.id, payload)
        : await createSellerDiscountCode(payload);
      setMyCode(saved);
      toast.success(myCode ? `Codigo regenerado: ${saved.code}` : `Codigo generado: ${saved.code}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el codigo.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState label="Cargando tu codigo de descuento..." />;
  }

  if (!employee) {
    return (
      <EmptyState
        title="Sin perfil de empleado"
        description="Tu usuario no tiene un registro de empleado asociado, por lo que no puedes generar codigos de descuento."
      />
    );
  }

  const isExpired = myCode ? new Date(myCode.ends_at).getTime() <= Date.now() : false;

  return (
    <div>
      <PageHeader
        title="Mi codigo de descuento"
        subtitle="Genera un codigo temporal para tus clientes. Solo tu puedes usarlo y regenerarlo; la factura queda asociada a tu nombre."
      />

      {myCode && (
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef4f1] text-[#2a4038]">
                <Ticket size={18} />
              </div>
              <div>
                <p className="font-mono text-sm font-bold text-gray-900">{myCode.code}</p>
                <p className="text-[11px] text-gray-500">
                  {myCode.discount_type === 'PERCENTAGE' ? `${myCode.discount_value}%` : formatMoney(myCode.discount_value)}
                  {' · '}
                  {myCode.uses_count}/{myCode.max_uses ?? '∞'} usos
                </p>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                  myCode.is_active && !isExpired ? 'bg-[#eef4f1] text-[#2a4038]' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {isExpired ? 'Vencido' : myCode.is_active ? 'Activo' : 'Inactivo'}
              </span>
              <p className="mt-1 text-[11px] text-gray-400">
                Vence {format(new Date(myCode.ends_at), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {myCode ? 'Regenerar mi codigo' : 'Generar mi codigo'}
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Tipo">
            <select
              value={form.discountType}
              onChange={event => setForm(prev => ({ ...prev, discountType: event.target.value as DiscountType }))}
              className={selectCls}
            >
              <option value="PERCENTAGE">Porcentaje</option>
              <option value="FIXED_AMOUNT">Monto fijo</option>
            </select>
          </Field>
          <Field label={form.discountType === 'PERCENTAGE' ? 'Descuento %' : 'Descuento $'}>
            <input
              type="number"
              min="0"
              max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
              value={form.discountValue}
              onChange={event => setForm(prev => ({ ...prev, discountValue: Number(event.target.value) }))}
              className={inputCls}
            />
          </Field>
          <Field label="Vigencia (horas)">
            <input
              type="number"
              min="1"
              max="720"
              value={form.durationHours}
              onChange={event => setForm(prev => ({ ...prev, durationHours: Number(event.target.value) }))}
              className={inputCls}
            />
          </Field>
          <Field label="Usos maximos">
            <input
              type="number"
              min="1"
              value={form.maxUses}
              onChange={event => setForm(prev => ({ ...prev, maxUses: Number(event.target.value) }))}
              className={inputCls}
            />
          </Field>
          <Field label="Compra minima">
            <input
              type="number"
              min="0"
              step="1000"
              value={form.minOrderAmount}
              onChange={event => setForm(prev => ({ ...prev, minOrderAmount: Number(event.target.value) }))}
              className={inputCls}
            />
          </Field>
        </div>
        <p className="mt-3 text-[11px] text-gray-400">
          Elige el rango de tiempo que quieras (entre 1 y 720 horas, es decir hasta 30 dias). Al regenerar, tu codigo actual se reemplaza por uno nuevo con esta vigencia.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void generateCode()}
            disabled={isSaving}
            className="flex h-10 items-center gap-2 rounded-lg bg-[#2a4038] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#3d5c4e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {isSaving ? 'Guardando...' : myCode ? 'Regenerar codigo' : 'Generar codigo'}
          </button>
        </div>
      </Card>
    </div>
  );
}
