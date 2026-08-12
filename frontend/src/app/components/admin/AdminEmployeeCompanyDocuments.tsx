import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  Compass,
  Download,
  Eye,
  FileText,
  History,
  Megaphone,
  ScrollText,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  getCompanyDocumentVersions,
  getCompanyDocuments,
  type CompanyDocument,
  type CompanyDocumentCategory,
  type CompanyDocumentVersion,
} from '../../services/human-resources.service';
import { Badge, EmptyState, LoadingState } from './AdminUI';
import { SearchBar } from './SearchBar';

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

const CATEGORIES: { id: CompanyDocumentCategory; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'REGULATION', label: 'Reglamento', icon: ScrollText },
  { id: 'POLICY', label: 'Políticas', icon: BookOpen },
  { id: 'ANNOUNCEMENT', label: 'Circulares', icon: Megaphone },
  { id: 'FORM', label: 'Formatos', icon: ClipboardList },
  { id: 'MISSION_VISION', label: 'Misión y Visión', icon: Compass },
];

export function AdminEmployeeCompanyDocuments() {
  const toast = useToast();
  const [category, setCategory] = useState<CompanyDocumentCategory>('REGULATION');
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const [versions, setVersions] = useState<CompanyDocumentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCompanyDocuments(category);
      setDocuments(data);
      setSelectedDocumentId((current) => {
        if (current && data.some((doc) => doc.id === current)) return current;
        return data[0]?.id ?? null;
      });
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los documentos de la empresa');
    } finally {
      setIsLoading(false);
    }
  }, [category, toast]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    setShowHistory(false);
  }, [selectedDocumentId]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return documents;
    return documents.filter((doc) => doc.name.toLowerCase().includes(query));
  }, [documents, searchQuery]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const loadVersions = useCallback(async (documentId: string) => {
    setLoadingVersions(true);
    try {
      const data = await getCompanyDocumentVersions(documentId);
      setVersions(data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el historial de versiones');
    } finally {
      setLoadingVersions(false);
    }
  }, [toast]);

  const toggleHistory = () => {
    if (!showHistory && selectedDocumentId) void loadVersions(selectedDocumentId);
    setShowHistory((v) => !v);
  };

  const currentVersion = selectedDocument?.current_version ?? null;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Reglamento interno de la empresa</h2>
        <p className="text-xs text-gray-500 mt-0.5">Consulta y descarga el reglamento, políticas y demás documentos publicados por RRHH.</p>
      </div>

      <div className="flex flex-wrap gap-1.5 p-1.5 bg-gray-50 border border-gray-100 rounded-2xl mb-4">
        {CATEGORIES.map((item) => {
          const Icon = item.icon;
          const active = category === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                active ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} />
              {item.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <LoadingState label="Cargando reglamento interno..." />
      ) : documents.length === 0 ? (
        <EmptyState title="Aún no hay documentos publicados" description="RRHH todavía no ha publicado documentos en esta categoría." />
      ) : (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
          <div className="space-y-4">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Buscar documentos..." />

            {selectedDocument && currentVersion && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Badge label="Documento más reciente" color="blue" />
                  <Badge label="Vigente" color="green" />
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#2a4038]/10 text-[#2a4038] flex items-center justify-center flex-shrink-0">
                    <FileText size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-semibold text-gray-900">{selectedDocument.name}</h4>
                      <Badge label={`Versión ${currentVersion.version_label}`} color="gray" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Publicado el {formatDateTime(currentVersion.published_at)}</p>
                    {selectedDocument.description && (
                      <p className="text-sm text-gray-600 mt-2">{selectedDocument.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {currentVersion.file && (
                    <>
                      <a
                        href={getMediaUrl(currentVersion.file)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors"
                      >
                        <Eye size={13} />
                        Ver
                      </a>
                      <a
                        href={getMediaUrl(currentVersion.file)}
                        download
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Download size={13} />
                        Descargar
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={toggleHistory}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <History size={13} />
                    Historial
                  </button>
                </div>
              </div>
            )}

            {showHistory && selectedDocument && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Versiones anteriores</p>
                </div>
                {loadingVersions ? (
                  <LoadingState label="Cargando versiones..." />
                ) : (
                  <div className="divide-y divide-gray-50">
                    {versions.map((version) => (
                      <div key={version.id} className="flex items-center gap-3 px-4 py-3">
                        <Badge label={`v${version.version_label}`} color="gray" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-700">{formatDateTime(version.published_at)}</p>
                        </div>
                        {version.file && (
                          <a
                            href={getMediaUrl(version.file)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                            title="Ver"
                          >
                            <Eye size={13} />
                          </a>
                        )}
                      </div>
                    ))}
                    {versions.length === 0 && (
                      <p className="text-xs text-gray-400 px-4 py-6 text-center">No hay versiones anteriores</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-700">Documentos recientes</p>
              </div>
              <div className="divide-y divide-gray-50">
                {filteredDocuments.map((document) => {
                  const active = document.id === selectedDocumentId;
                  return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => setSelectedDocumentId(document.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-[#2a4038]/5' : 'hover:bg-gray-50'}`}
                    >
                      <FileText size={14} className={active ? 'text-[#2a4038]' : 'text-gray-400'} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${active ? 'font-semibold text-[#2a4038]' : 'text-gray-700'}`}>{document.name}</p>
                        {document.current_version && (
                          <p className="text-xs text-gray-400 truncate">
                            v{document.current_version.version_label} · {formatDateTime(document.current_version.published_at)}
                          </p>
                        )}
                      </div>
                      {document.current_version?.visible_until && (
                        <Badge label={`Hasta ${formatDate(document.current_version.visible_until)}`} color="yellow" />
                      )}
                    </button>
                  );
                })}
                {filteredDocuments.length === 0 && (
                  <p className="text-xs text-gray-400 px-4 py-6 text-center">No se encontraron documentos</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Información del documento</p>
            {selectedDocument ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] text-gray-400">Última actualización</p>
                  <p className="text-gray-800 font-medium">{currentVersion ? formatDateTime(currentVersion.published_at) : 'Sin versiones'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Estado</p>
                  <Badge label="Vigente" color="green" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Categoría</p>
                  <p className="text-gray-800 font-medium">{CATEGORIES.find((c) => c.id === selectedDocument.category)?.label}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Aplica a</p>
                  <p className="text-gray-800 font-medium">Todos los colaboradores</p>
                </div>
                {currentVersion?.visible_until && (
                  <div>
                    <p className="text-[11px] text-gray-400">Disponible hasta</p>
                    <p className="text-amber-600 font-medium">{formatDate(currentVersion.visible_until)}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Selecciona un documento para ver su información.</p>
            )}

            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-1">¿Necesitas ayuda?</p>
              <p className="text-xs text-gray-500">Si tienes dudas sobre este documento, comunícate con el área de Talento Humano.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
