import { useCallback, useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { SignaturePad, type SignatureMode } from './SignaturePad';
import { Modal, PrimaryButton, SecondaryButton, inputCls } from './AdminUI';
import { useToast } from '../../contexts/ToastContext';
import {
  getSignatures,
  signDocument,
  type SignatureRecord,
} from '../../services/manufacturing.service';

function getMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export function SignatureBlock({
  resourcePath,
  resourceId,
  role,
  label,
}: {
  resourcePath: string;
  resourceId: string;
  role: 'RESPONSIBLE' | 'VERIFIER';
  label: string;
}) {
  const toast = useToast();
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [fullName, setFullName] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSignatures(await getSignatures(resourcePath, resourceId));
    } catch {
      // el recurso puede no admitir firma todavía (sin crear) — se ignora silenciosamente
    } finally {
      setLoading(false);
    }
  }, [resourcePath, resourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = signatures.find((s) => s.role === role && !signatures.some((other) => other.replaced_by === s.id));

  const handleSign = async () => {
    if (!file) {
      toast.warning('Dibuja o carga una firma primero.');
      return;
    }
    setSaving(true);
    try {
      await signDocument(resourcePath, resourceId, {
        image: file,
        signature_type: mode === 'draw' ? 'DRAWN' : 'UPLOADED',
        role,
        full_name: fullName,
        replace_reason: current ? replaceReason : '',
      });
      toast.success('Documento firmado');
      setShowModal(false);
      setFile(null);
      setFullName('');
      setReplaceReason('');
      await load();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo firmar el documento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="border border-gray-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <button onClick={() => setShowModal(true)} className="text-xs text-[#2a4038] font-semibold hover:underline flex items-center gap-1">
          <PenLine size={12} /> {current ? 'Reemplazar firma' : 'Firmar'}
        </button>
      </div>
      {current ? (
        <div className="flex items-center gap-3">
          {current.image && (
            <img src={getMediaUrl(current.image)} alt="Firma" className="h-12 border border-gray-200 rounded bg-white" />
          )}
          <div className="text-[11px] text-gray-400">
            <p>{current.full_name || 'Sin nombre'}</p>
            <p>{new Date(current.created_at).toLocaleString('es-CO')} · {current.signature_type === 'DRAWN' ? 'Dibujada' : 'Cargada'}</p>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">Sin firma registrada.</p>
      )}

      <Modal title={current ? 'Reemplazar firma' : 'Firmar documento'} open={showModal} onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nombre completo</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </label>
          {current && (
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Motivo del reemplazo</span>
              <input value={replaceReason} onChange={(e) => setReplaceReason(e.target.value)} className={inputCls} />
            </label>
          )}
          <SignaturePad label="Firma" onChange={(f, m) => { setFile(f); if (m) setMode(m); }} />
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setShowModal(false)}>Cancelar</SecondaryButton>
            <PrimaryButton onClick={() => void handleSign()} disabled={saving || !file || (Boolean(current) && !replaceReason)}>
              {saving ? 'Firmando...' : 'Confirmar firma'}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
