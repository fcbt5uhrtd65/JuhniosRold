import { getExportStatus } from '../services/products.service';

const MAX_ATTEMPTS = 20;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 5000;

export async function pollExportStatus(taskId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await getExportStatus(taskId);
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
