import { getExportStatus } from '../services/products.service';

const MAX_ATTEMPTS = 20;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 5000;

interface ExportStatusResult {
  status: 'pending' | 'success' | 'failure';
  url?: string;
  error?: string;
}

export async function downloadFile(url: string, filename?: string): Promise<void> {
  // Siempre usar ruta relativa para pasar por el proxy de Vite (/media → backend)
  const fetchUrl = url.startsWith('http') ? new URL(url).pathname : url;
  const response = await fetch(fetchUrl, { credentials: 'include' });
  if (!response.ok) throw new Error(`Error al descargar el archivo (${response.status})`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename ?? fetchUrl.split('/').pop() ?? 'export';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export async function pollExportStatus(
  taskId: string,
  fetchStatus: (taskId: string) => Promise<ExportStatusResult> = getExportStatus,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await fetchStatus(taskId);
    if (result.status === 'success') {
      if (!result.url) throw new Error('La exportación no devolvió una URL.');
      return result.url;
    }
    if (result.status === 'failure') {
      throw new Error(result.error || 'La exportación falló.');
    }
    const delay = Math.min(BASE_DELAY_MS * 1.4 ** attempt, MAX_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('La exportación tardó demasiado. Intenta de nuevo más tarde.');
}
