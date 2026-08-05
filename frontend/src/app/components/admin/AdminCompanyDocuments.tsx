import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ClipboardList,
  Download,
  Eye,
  FileText,
  History,
  Megaphone,
  Plus,
  ScrollText,
  Trash2,
  Upload,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  createCompanyDocument,
  createCompanyDocumentVersion,
  deleteCompanyDocument,
  deleteCompanyDocumentVersion,
  getCompanyDocumentVersions,
  getCompanyDocuments,
  type CompanyDocument,
  type CompanyDocumentCategory,
  type CompanyDocumentVersion,
} from '../../services/human-resources.service';
import { Badge, type BadgeColor, Modal, EmptyState, LoadingState, inputCls } from './AdminUI';
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
  { id: 'ANNOUNCEMENT', label: 'Comunicados', icon: Megaphone },
  { id: 'FORM', label: 'Formatos', icon: ClipboardList },
];

function getVersionVisibility(version: CompanyDocumentVersion): { label: string; color: BadgeColor } {
  const today = new Date().toISOString().slice(0, 10);
  if (version.visible_from && today < version.visible_from) {
    return { label: `Programado desde ${formatDate(version.visible_from)}`, color: 'yellow' };
  }
  if (version.visible_until && today > version.visible_until) {
    return { label: `Vencido el ${formatDate(version.visible_until)}`, color: 'gray' };
  }
  return { label: 'Vigente', color: 'green' };
}

export function AdminCompanyDocuments() {
  const toast = useToast();
  const [category, setCategory] = useState<CompanyDocumentCategory>('REGULATION');
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const [versions, setVersions] = useState<CompanyDocumentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [showNewDocumentModal, setShowNewDocumentModal] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState('');
  const [newDocumentDescription, setNewDocumentDescription] = useState('');
  const [newDocumentFile, setNewDocumentFile] = useState<File | null>(null);
  const [newDocumentVisibleFrom, setNewDocumentVisibleFrom] = useState('');
  const [newDocumentVisibleUntil, setNewDocumentVisibleUntil] = useState('');
  const [savingNewDocument, setSavingNewDocument] = useState(false);

  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionVisibleFrom, setVersionVisibleFrom] = useState('');
  const [versionVisibleUntil, setVersionVisibleUntil] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);

  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);

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

  useEffect(() => {
    if (selectedDocumentId) void loadVersions(selectedDocumentId);
    else setVersions([]);
  }, [selectedDocumentId, loadVersions]);

  const closeNewDocumentModal = () => {
    setShowNewDocumentModal(false);
    setNewDocumentName('');
    setNewDocumentDescription('');
    setNewDocumentFile(null);
    setNewDocumentVisibleFrom('');
    setNewDocumentVisibleUntil('');
  };

  const handleCreateDocument = async () => {
    if (!newDocumentName.trim()) {
      toast.error('Indica el nombre del documento');
      return;
    }
    if (!newDocumentFile) {
      toast.error('Selecciona el archivo de la primera versión');
      return;
    }
    if (newDocumentVisibleFrom && newDocumentVisibleUntil && newDocumentVisibleUntil < newDocumentVisibleFrom) {
      toast.error('La fecha final debe ser posterior o igual a la fecha inicial');
      return;
    }
    setSavingNewDocument(true);
    try {
      const document = await createCompanyDocument({
        category,
        name: newDocumentName.trim(),
        description: newDocumentDescription.trim(),
      });
      await createCompanyDocumentVersion(document.id, {
        file: newDocumentFile,
        visible_from: newDocumentVisibleFrom || null,
        visible_until: newDocumentVisibleUntil || null,
      });
      toast.success('Documento publicado');
      closeNewDocumentModal();
      setSelectedDocumentId(document.id);
      await loadDocuments();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo publicar el documento');
    } finally {
      setSavingNewDocument(false);
    }
  };

  const closeVersionModal = () => {
    setShowVersionModal(false);
    setVersionFile(null);
    setVersionVisibleFrom('');
    setVersionVisibleUntil('');
  };

  const handleUploadVersion = async () => {
    if (!selectedDocument) return;
    if (!versionFile) {
      toast.error('Selecciona el archivo de la nueva versión');
      return;
    }
    if (versionVisibleFrom && versionVisibleUntil && versionVisibleUntil < versionVisibleFrom) {
      toast.error('La fecha final debe ser posterior o igual a la fecha inicial');
      return;
    }
    setSavingVersion(true);
    try {
      await createCompanyDocumentVersion(selectedDocument.id, {
        file: versionFile,
        visible_from: versionVisibleFrom || null,
        visible_until: versionVisibleUntil || null,
      });
      toast.success('Nueva versión publicada');
      closeVersionModal();
      await Promise.all([loadDocuments(), loadVersions(selectedDocument.id)]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo publicar la nueva versión');
    } finally {
      setSavingVersion(false);
    }
  };

  const handleDeleteDocument = async (document: CompanyDocument) => {
    if (!window.confirm(`¿Eliminar "${document.name}" y todo su historial de versiones? Los empleados dejarán de verlo.`)) return;
    setDeletingDocumentId(document.id);
    try {
      await deleteCompanyDocument(document.id);
      toast.success('Documento eliminado');
      if (selectedDocumentId === document.id) setSelectedDocumentId(null);
      await loadDocuments();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el documento');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleDeleteVersion = async (version: CompanyDocumentVersion) => {
    if (!selectedDocument) return;
    if (!window.confirm(`¿Eliminar la versión ${version.version_label}? Esta acción no se puede deshacer.`)) return;
    setDeletingVersionId(version.id);
    try {
      await deleteCompanyDocumentVersion(version.id);
      toast.success('Versión eliminada');
      await Promise.all([loadDocuments(), loadVersions(selectedDocument.id)]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la versión');
    } finally {
      setDeletingVersionId(null);
    }
  };

  const currentVersion = selectedDocument?.current_version ?? null;
  const currentVisibility = currentVersion ? getVersionVisibility(currentVersion) : null;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Documentos y reglamento de la empresa</h3>
          <p className="text-xs text-gray-500 mt-0.5">Publica el reglamento, políticas, comunicados y formatos. Aparecen para todos los empleados en "Reglamento interno".</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewDocumentModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors w-full sm:w-auto"
        >
          <Plus size={14} />
          Nuevo documento
        </button>
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
        <LoadingState label="Cargando documentos..." />
      ) : documents.length === 0 ? (
        <EmptyState
          title="No hay documentos en esta categoría"
          description="Publica el primer documento para que los empleados puedan consultarlo."
        />
      ) : (
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
          <div className="space-y-4">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Buscar documentos..." />

            {selectedDocument && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Badge label="Documento seleccionado" color="blue" />
                  {currentVisibility && <Badge label={currentVisibility.label} color={currentVisibility.color} />}
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#2a4038]/10 text-[#2a4038] flex items-center justify-center flex-shrink-0">
                    <FileText size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-semibold text-gray-900">{selectedDocument.name}</h4>
                      {currentVersion && <Badge label={`Versión ${currentVersion.version_label}`} color="gray" />}
                    </div>
                    {currentVersion && (
                      <p className="text-xs text-gray-400 mt-1">Publicado el {formatDateTime(currentVersion.published_at)}</p>
                    )}
                    {selectedDocument.description && (
                      <p className="text-sm text-gray-600 mt-2">{selectedDocument.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {currentVersion?.file && (
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
                    onClick={() => setShowHistory((v) => !v)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <History size={13} />
                    Historial ({selectedDocument.versions_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVersionModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors ml-auto"
                  >
                    <Upload size={13} />
                    Nueva versión
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(selectedDocument)}
                    disabled={deletingDocumentId === selectedDocument.id}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Eliminar
                  </button>
                </div>
              </div>
            )}

            {showHistory && selectedDocument && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-700">Historial de versiones</p>
                </div>
                {loadingVersions ? (
                  <LoadingState label="Cargando versiones..." />
                ) : (
                  <div className="divide-y divide-gray-50">
                    {versions.map((version) => {
                      const visibility = getVersionVisibility(version);
                      return (
                        <div key={version.id} className="flex items-center gap-3 px-4 py-3">
                          <Badge label={`v${version.version_label}`} color="gray" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-700">{formatDateTime(version.published_at)}</p>
                          </div>
                          <Badge label={visibility.label} color={visibility.color} />
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
                          <button
                            type="button"
                            onClick={() => handleDeleteVersion(version)}
                            disabled={deletingVersionId === version.id}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                            title="Eliminar versión"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-700">Documentos de esta categoría</p>
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
                      <Badge label={`${document.versions_count} versión${document.versions_count === 1 ? '' : 'es'}`} color="gray" />
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
                  <p className="text-[11px] text-gray-400">Categoría</p>
                  <p className="text-gray-800 font-medium">{CATEGORIES.find((c) => c.id === selectedDocument.category)?.label}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Última actualización</p>
                  <p className="text-gray-800 font-medium">{currentVersion ? formatDateTime(currentVersion.published_at) : 'Sin versiones'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Estado</p>
                  {currentVisibility ? <Badge label={currentVisibility.label} color={currentVisibility.color} /> : <Badge label="Sin publicar" color="gray" />}
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Versiones publicadas</p>
                  <p className="text-gray-800 font-medium">{selectedDocument.versions_count}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Aplica a</p>
                  <p className="text-gray-800 font-medium">Todos los colaboradores</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Selecciona un documento para ver su información.</p>
            )}
          </div>
        </div>
      )}

      <Modal title="Nuevo documento" open={showNewDocumentModal} onClose={closeNewDocumentModal}>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Nombre del documento</label>
            <input
              type="text"
              value={newDocumentName}
              onChange={(event) => setNewDocumentName(event.target.value)}
              className={inputCls}
              placeholder="Ej: Reglamento interno de trabajo"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Descripción (opcional)</label>
            <textarea
              value={newDocumentDescription}
              onChange={(event) => setNewDocumentDescription(event.target.value)}
              className={inputCls}
              rows={3}
              placeholder="Documento oficial que establece las normas, lineamientos y disposiciones que rigen la empresa."
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Archivo (versión 1.0)</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(event) => setNewDocumentFile(event.target.files?.[0] ?? null)}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Visible desde (opcional)</label>
              <input
                type="date"
                value={newDocumentVisibleFrom}
                onChange={(event) => setNewDocumentVisibleFrom(event.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Visible hasta (opcional)</label>
              <input
                type="date"
                value={newDocumentVisibleUntil}
                onChange={(event) => setNewDocumentVisibleUntil(event.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">Si dejas estos campos vacíos, el documento se mostrará siempre que sea la versión vigente.</p>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={closeNewDocumentModal}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateDocument}
              disabled={savingNewDocument}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {savingNewDocument ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal title="Subir nueva versión" open={showVersionModal} onClose={closeVersionModal}>
        <div className="space-y-4">
          {selectedDocument && (
            <p className="text-xs text-gray-500">
              Publicarás la versión <strong>{(selectedDocument.versions_count + 1)}.0</strong> de "{selectedDocument.name}". La versión anterior queda disponible en el historial.
            </p>
          )}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Archivo</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(event) => setVersionFile(event.target.files?.[0] ?? null)}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Visible desde (opcional)</label>
              <input
                type="date"
                value={versionVisibleFrom}
                onChange={(event) => setVersionVisibleFrom(event.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Visible hasta (opcional)</label>
              <input
                type="date"
                value={versionVisibleUntil}
                onChange={(event) => setVersionVisibleUntil(event.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">Si dejas estos campos vacíos, la versión se mostrará siempre que sea la vigente.</p>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={closeVersionModal}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleUploadVersion}
              disabled={savingVersion}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {savingVersion ? 'Subiendo...' : 'Publicar versión'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
