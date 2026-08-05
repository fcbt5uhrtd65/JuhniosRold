import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Download, FileText } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { getCompanyDocuments, type CompanyDocument } from '../../services/human-resources.service';
import { Card, EmptyState, LoadingState } from './AdminUI';

function getMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO');
}

export function AdminEmployeeCompanyDocuments() {
  const toast = useToast();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCompanyDocuments();
      setDocuments(data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los documentos de la empresa');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  if (isLoading) {
    return <LoadingState label="Cargando reglamento interno..." />;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={15} className="text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">Reglamento interno de la empresa</h2>
      </div>
      <p className="text-xs text-gray-500 mb-6">Consulta y descarga el reglamento, políticas y demás documentos publicados por RRHH.</p>

      {documents.length === 0 ? (
        <EmptyState title="Aún no hay documentos publicados" description="RRHH todavía no ha publicado el reglamento u otras políticas." />
      ) : (
        <div className="space-y-2.5">
          {documents.map((document) => (
            <Card key={document.id} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2a4038]/10 text-[#2a4038] flex items-center justify-center flex-shrink-0">
                <FileText size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
                <p className="text-xs text-gray-400 truncate">Publicado el {formatDateTime(document.uploaded_at)}</p>
                {document.visible_until && (
                  <p className="text-xs text-amber-600 truncate mt-0.5">Disponible hasta el {formatDate(document.visible_until)}</p>
                )}
              </div>
              {document.file && (
                <a
                  href={getMediaUrl(document.file)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <Download size={13} />
                  Descargar
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
