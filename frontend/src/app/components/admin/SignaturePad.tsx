import { useEffect, useRef, useState } from 'react';
import { Eraser, FileUp, PenLine } from 'lucide-react';

type SignatureMode = 'draw' | 'upload';

function getMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function getPointerPosition(canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

export function SignaturePad({
  currentSignatureUrl,
  onChange,
  label = 'Firma digital',
  helperText = 'Sube una imagen (PNG/JPG) o dibújala directamente.',
}: {
  currentSignatureUrl?: string | null;
  onChange: (file: File | null) => void;
  label?: string;
  helperText?: string;
}) {
  const [mode, setMode] = useState<SignatureMode>('draw');
  const [hasDrawing, setHasDrawing] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  const emitCanvasAsFile = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      onChange(new File([blob], 'firma.png', { type: 'image/png' }));
    }, 'image/png');
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    isDrawingRef.current = true;
    const { x, y } = getPointerPosition(canvas, event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvas.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getPointerPosition(canvas, event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawing(true);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    emitCanvasAsFile();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onChange(null);
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setUploadPreview(null);
      onChange(null);
      return;
    }
    setUploadPreview(URL.createObjectURL(file));
    onChange(file);
  };

  const switchMode = (nextMode: SignatureMode) => {
    setMode(nextMode);
    onChange(null);
    setHasDrawing(false);
    setUploadPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => switchMode('draw')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${mode === 'draw' ? 'bg-white text-[#2a4038] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <PenLine size={12} strokeWidth={1.75} />
            Dibujar
          </button>
          <button
            type="button"
            onClick={() => switchMode('upload')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${mode === 'upload' ? 'bg-white text-[#2a4038] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileUp size={12} strokeWidth={1.75} />
            Subir imagen
          </button>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">{helperText}</p>

      {mode === 'draw' ? (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={480}
            height={160}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full h-40 bg-white border border-dashed border-gray-300 rounded-lg cursor-crosshair touch-none"
          />
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasDrawing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Eraser size={12} strokeWidth={1.75} />
            Limpiar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => handleFileSelect(event.target.files?.[0] ?? null)}
            className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {uploadPreview && (
            <div className="w-full h-40 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
              <img src={uploadPreview} alt="Vista previa de la firma" className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </div>
      )}

      {!hasDrawing && !uploadPreview && currentSignatureUrl && (
        <div className="space-y-1">
          <p className="text-[11px] text-gray-400">Firma guardada actualmente:</p>
          <div className="w-full h-24 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
            <img src={getMediaUrl(currentSignatureUrl)} alt="Firma guardada" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
