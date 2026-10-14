import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, ImageUp, Trash2 } from 'lucide-react';

const CANVAS_W = 600;
const CANVAS_H = 200;
const UPLOAD_MAX_W = 400;
const MAX_BYTES = 280 * 1024;

/** Recorta el lienzo al trazo (con un pequeño margen) y devuelve un PNG transparente. */
function cropToInk(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return '';
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')?.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

/** Reduce la imagen subida a 400 px de ancho como máximo. */
async function resizeUploaded(file: File): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
  const img = await loadImage(src);
  const scale = Math.min(1, UPLOAD_MAX_W / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL('image/png');
  if (png.length <= MAX_BYTES) return png;
  // PNG demasiado pesado (foto): JPEG sobre fondo blanco.
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const fctx = flat.getContext('2d');
  if (!fctx) return png;
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, flat.width, flat.height);
  fctx.drawImage(canvas, 0, 0);
  return flat.toDataURL('image/jpeg', 0.85);
}

export function PaymentAccountSignature({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  onError?: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setHasInk(false);
  }, []);

  // Si la firma se limpia desde fuera (botón "Limpiar"), vacía también el lienzo.
  useEffect(() => {
    if (!value) clearCanvas();
  }, [value, clearCanvas]);

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = pointerPosition(event);
    ctx.strokeStyle = '#14213d';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  };

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointerPosition(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // El puntero ya no estaba capturado.
    }
    const cropped = cropToInk(event.currentTarget);
    setHasInk(Boolean(cropped));
    onChange(cropped);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('El archivo debe ser una imagen.');
      return;
    }
    try {
      const dataUrl = await resizeUploaded(file);
      clearCanvas();
      onChange(dataUrl);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'No se pudo cargar la imagen.');
    }
  };

  const remove = () => {
    clearCanvas();
    onChange('');
  };

  const showPreview = Boolean(value) && !hasInk;
  const btn =
    'inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50';

  return (
    <div className="space-y-2">
      {showPreview ? (
        <div className="flex h-[110px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-2">
          <img src={value} alt="Firma" className="max-h-full max-w-full object-contain" />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          className="h-[110px] w-full cursor-crosshair rounded-lg border border-dashed border-gray-300 bg-white"
          style={{ touchAction: 'none' }}
          aria-label="Lienzo para dibujar la firma"
        />
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {!showPreview && (
          <button type="button" className={btn} onClick={remove}>
            <Eraser size={12} /> Borrar
          </button>
        )}
        <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
          <ImageUp size={12} /> Subir imagen
        </button>
        {value && (
          <button type="button" className={`${btn} text-red-600`} onClick={remove}>
            <Trash2 size={12} /> Quitar
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>
      <p className="text-[10px] text-gray-400">Dibuja con mouse, dedo o lápiz, o sube una imagen (se reduce a 400 px de ancho).</p>
    </div>
  );
}
