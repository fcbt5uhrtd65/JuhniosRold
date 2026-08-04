import { useCallback, useEffect, useState } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Card, EmptyState, LoadingState, Modal, PrimaryButton, SecondaryButton, inputCls, selectCls } from './AdminUI';
import { SignatureBlock } from './SignatureBlock';
import {
  createAnalysisCertificate,
  exportAnalysisCertificate,
  getAnalysisCertificate,
  loadCertificateTestsFromSpecification,
  type AnalysisCertificateRecord,
  type BatchRecord,
} from '../../services/manufacturing.service';
import { formatDate } from './manufacturing-shared';

/* ═══════════════════════════════════════════════════════
   Pestaña "Certificado de análisis" del expediente de lote.
═══════════════════════════════════════════════════════ */

export function AnalysisCertificateTab({ batch }: { batch: BatchRecord }) {
  const toast = useToast();
  const [certificate, setCertificate] = useState<AnalysisCertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [loadingFromSpec, setLoadingFromSpec] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCertificate(await getAnalysisCertificate(batch.id));
    } finally {
      setLoading(false);
    }
  }, [batch.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    if (!certificate) return;
    try {
      await exportAnalysisCertificate(certificate.id, batch.batch_code || batch.production_order_number);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar el certificado');
    }
  };

  const handleLoadFromSpecification = async () => {
    if (!certificate) return;
    setLoadingFromSpec(true);
    try {
      await loadCertificateTestsFromSpecification(certificate.id);
      toast.success('Ensayos cargados desde el maestro de especificaciones');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el maestro de especificaciones');
    } finally {
      setLoadingFromSpec(false);
    }
  };

  if (loading) return <LoadingState label="Cargando certificado de análisis..." />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Certificado de análisis</p>
          <div className="flex items-center gap-2">
            {certificate && (
              <>
                <button
                  onClick={() => void handleLoadFromSpecification()}
                  disabled={loadingFromSpec}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {loadingFromSpec ? 'Cargando...' : 'Cargar desde maestro'}
                </button>
                <SecondaryButton onClick={() => void handleExport()} icon={<FileDown size={13} />}>Exportar</SecondaryButton>
              </>
            )}
            {!certificate && (
              <SecondaryButton onClick={() => setShowCertificateModal(true)} icon={<Plus size={13} />}>Nuevo certificado</SecondaryButton>
            )}
          </div>
        </div>
        {!certificate ? (
          <EmptyState title="Sin certificado de análisis registrado" />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Badge label={certificate.concept} color={certificate.concept === 'APPROVED' ? 'green' : certificate.concept === 'REJECTED' ? 'red' : 'yellow'} />
              <p className="text-xs text-gray-400">Analizado: {formatDate(certificate.analyzed_at)}</p>
            </div>
            {certificate.tests.length === 0 ? (
              <EmptyState title="Sin ensayos registrados" description="Usa 'Cargar desde maestro' si el producto tiene especificaciones configuradas." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                      <th className="py-2 pr-3">Ensayo</th>
                      <th className="py-2 pr-3">Especificación</th>
                      <th className="py-2 pr-3">Granel</th>
                      <th className="py-2 pr-3">Terminado</th>
                      <th className="py-2 pr-3">Cumple</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificate.tests.map((test) => (
                      <tr key={test.id} className="border-b border-gray-50">
                        <td className="py-2 pr-3">{test.name}</td>
                        <td className="py-2 pr-3">{test.specification}</td>
                        <td className="py-2 pr-3">{test.bulk_result}</td>
                        <td className="py-2 pr-3">{test.finished_product_result}</td>
                        <td className="py-2 pr-3">
                          {test.complies === null ? '-' : <Badge label={test.complies ? 'Cumple' : 'No cumple'} color={test.complies ? 'green' : 'red'} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100">
              <SignatureBlock resourcePath="analysis-certificates" resourceId={certificate.id} role="RESPONSIBLE" label="Analizado por" />
              <SignatureBlock resourcePath="analysis-certificates" resourceId={certificate.id} role="VERIFIER" label="Verificado por" />
            </div>
          </>
        )}
      </Card>

      <NewAnalysisCertificateModal
        open={showCertificateModal}
        batchId={batch.id}
        onClose={() => setShowCertificateModal(false)}
        onCreated={async () => {
          setShowCertificateModal(false);
          await load();
        }}
      />
    </div>
  );
}

function NewAnalysisCertificateModal({
  open,
  batchId,
  onClose,
  onCreated,
}: {
  open: boolean;
  batchId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const toast = useToast();
  const [concept, setConcept] = useState<'APPROVED' | 'REJECTED' | 'QUARANTINE' | 'REANALYSIS'>('QUARANTINE');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createAnalysisCertificate({ batch: batchId, concept, observations, analyzed_at: new Date().toISOString().slice(0, 10) });
      toast.success('Certificado creado');
      await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el certificado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nuevo certificado de análisis" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Concepto</span>
          <select value={concept} onChange={(e) => setConcept(e.target.value as typeof concept)} className={selectCls}>
            <option value="QUARANTINE">Cuarentena</option>
            <option value="APPROVED">Aprobado</option>
            <option value="REJECTED">Rechazado</option>
            <option value="REANALYSIS">Reanálisis</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Observaciones</span>
          <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
        </label>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear certificado'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
