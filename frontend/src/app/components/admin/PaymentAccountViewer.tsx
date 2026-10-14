import { useEffect, useState } from 'react';
import { FileDown, Loader2, X } from 'lucide-react';
import { paymentAccountPdfBlob } from '../../utils/paymentAccountPdf';
import type { PaymentAccountDoc } from '../../utils/documentText';

/** Visor modal: iframe con el PDF, check "Con firma" que regenera la vista y descargas. */
export function PaymentAccountViewer({
  account,
  title,
  initialWithSignature = true,
  onClose,
  onDownloadPdf,
  onDownloadWord,
}: {
  account: PaymentAccountDoc;
  title: string;
  initialWithSignature?: boolean;
  onClose: () => void;
  onDownloadPdf: (withSignature: boolean) => void;
  onDownloadWord: (withSignature: boolean) => void | Promise<void>;
}) {
  const [withSignature, setWithSignature] = useState(initialWithSignature);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busyWord, setBusyWord] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(paymentAccountPdfBlob(account, { withSignature }));
      setUrl(objectUrl);
      setError('');
    } catch {
      setError('No se pudo generar la vista previa del documento.');
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [account, withSignature]);

  const hasSignature = Boolean(account.signature);
  const btn =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`flex items-center gap-1.5 text-xs text-gray-600 ${hasSignature ? '' : 'opacity-50'}`}>
              <input
                type="checkbox"
                checked={withSignature}
                disabled={!hasSignature}
                onChange={(e) => setWithSignature(e.target.checked)}
              />
              Con firma
            </label>
            <button type="button" className={btn} onClick={() => onDownloadPdf(withSignature)}>
              <FileDown size={13} /> Descargar PDF
            </button>
            <button
              type="button"
              className={btn}
              disabled={busyWord}
              onClick={async () => {
                setBusyWord(true);
                try {
                  await onDownloadWord(withSignature);
                } finally {
                  setBusyWord(false);
                }
              }}
            >
              {busyWord ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Descargar Word
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-200" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100">
          {error ? (
            <p className="p-6 text-sm text-red-600">{error}</p>
          ) : (
            url && <iframe title={title} src={url} className="h-full w-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}
