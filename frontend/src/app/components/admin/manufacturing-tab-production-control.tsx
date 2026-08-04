import { useCallback, useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, selectCls } from './AdminUI';
import { SignaturePad } from './SignaturePad';
import {
  exportProductionControl,
  getProductionControl,
  signProductionControl,
  type BatchRecord,
  type ProductionControlRecord,
  type ProductionControlSigner,
} from '../../services/manufacturing.service';
import type { Employee } from '../../services/employees.service';
import { getEmployeeName, getMediaUrl } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Control de producción" del expediente de lote
   (solicitud y conciliación de materiales de acondicionamiento).
═══════════════════════════════════════════════════════ */

export function ProductionControlTab({
  batch,
  employeeById,
  employees,
}: {
  batch: BatchRecord;
  employeeById: Map<string, Employee>;
  employees: Employee[];
}) {
  const toast = useToast();
  const [control, setControl] = useState<ProductionControlRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setControl(await getProductionControl(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    if (!control) return;
    try {
      await exportProductionControl(control.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el control de producción');
    }
  };

  if (loading) return <LoadingState label="Cargando control de producción..." />;
  if (!control) return <EmptyState title="Sin control de producción registrado" description="Se genera automáticamente al crear el lote." />;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Control de producción (materiales de acondicionamiento)</p>
        {control.materials.length > 0 && (
          <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
        )}
      </div>
      {control.materials.length === 0 ? (
        <EmptyState title="Sin materiales registrados" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3">Material</th>
                <th className="py-2 pr-3">Entregado</th>
                <th className="py-2 pr-3">Consumido</th>
                <th className="py-2 pr-3">Buenas</th>
                <th className="py-2 pr-3">Malas proceso</th>
                <th className="py-2 pr-3">Malas fábrica</th>
                <th className="py-2 pr-3">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {control.materials.map((material) => (
                <tr key={material.id} className="border-b border-gray-50">
                  <td className="py-2 pr-3">{material.item}</td>
                  <td className="py-2 pr-3">{material.delivered_quantity}</td>
                  <td className="py-2 pr-3">{material.consumed_quantity}</td>
                  <td className="py-2 pr-3">{material.good_units}</td>
                  <td className="py-2 pr-3">{material.process_rejects}</td>
                  <td className="py-2 pr-3">{material.factory_rejects}</td>
                  <td className={`py-2 pr-3 ${Number(material.reconciliation_difference) !== 0 ? 'text-amber-600 font-semibold' : ''}`}>
                    {material.reconciliation_difference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-gray-100">
        <ProductionControlSignerBlock
          control={control}
          signer="warehouse"
          label="Bodega"
          signature={control.warehouse_signature}
          signedBy={control.warehouse_signed_by}
          employeeById={employeeById}
          employees={employees}
          onSigned={load}
        />
        <ProductionControlSignerBlock
          control={control}
          signer="responsible"
          label="Responsable"
          signature={control.responsible_signature}
          signedBy={control.responsible_signed_by}
          employeeById={employeeById}
          employees={employees}
          onSigned={load}
        />
        <ProductionControlSignerBlock
          control={control}
          signer="quality"
          label="Calidad"
          signature={control.quality_signature}
          signedBy={control.quality_signed_by}
          employeeById={employeeById}
          employees={employees}
          onSigned={load}
        />
        <ProductionControlSignerBlock
          control={control}
          signer="leader"
          label="Líder de área"
          signature={control.leader_signature}
          signedBy={control.leader_signed_by}
          employeeById={employeeById}
          employees={employees}
          onSigned={load}
        />
      </div>
    </Card>
  );
}

function ProductionControlSignerBlock({
  control,
  signer,
  label,
  signature,
  signedBy,
  employeeById,
  employees,
  onSigned,
}: {
  control: ProductionControlRecord;
  signer: ProductionControlSigner;
  label: string;
  signature: string | null;
  signedBy: string | null;
  employeeById: Map<string, Employee>;
  employees: Employee[];
  onSigned: () => Promise<void>;
}) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [employeeId, setEmployeeId] = useState(signedBy ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      toast.warning('Dibuja o carga una firma primero.');
      return;
    }
    setSaving(true);
    try {
      await signProductionControl(control.id, signer, { signature: file, signed_by: employeeId || null });
      toast.success('Firma registrada');
      setShowModal(false);
      setFile(null);
      await onSigned();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la firma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <button onClick={() => setShowModal(true)} className="text-xs text-[#2a4038] font-semibold hover:underline">
          {signature ? 'Reemplazar' : 'Firmar'}
        </button>
      </div>
      {signature ? (
        <div className="flex items-center gap-2">
          <img src={getMediaUrl(signature)} alt={`Firma ${label}`} className="h-10 border border-gray-200 rounded bg-white" />
          <span className="text-[11px] text-gray-400">{getEmployeeName(employeeById.get(signedBy ?? ''))}</span>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">Sin firma registrada.</p>
      )}

      <Modal title={`Firma — ${label}`} open={showModal} onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Empleado</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={selectCls}>
              <option value="">Sin asignar</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{getEmployeeName(employee)}</option>
              ))}
            </select>
          </label>
          <SignaturePad label={`Firma de ${label}`} onChange={setFile} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowModal(false)}>Cancelar</SecondaryButton>
            <PrimaryButton onClick={() => void handleSubmit()} disabled={saving || !file}>
              {saving ? 'Guardando...' : 'Confirmar firma'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
