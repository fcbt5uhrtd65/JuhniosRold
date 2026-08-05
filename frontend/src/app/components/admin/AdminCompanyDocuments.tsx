import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Download, Upload } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  createCompanyDocument,
  deleteCompanyDocument,
  getCompanyDocuments,
  type CompanyDocument,
} from '../../services/human-resources.service';
import { Table, Th, Td, Modal, EmptyState, LoadingState, inputCls, actionsCellCls, ActionsMenu } from './AdminUI';

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

export function AdminCompanyDocuments() {
  const toast = useToast();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);

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

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setName('');
    setFile(null);
  };

  const handleUpload = async () => {
    if (!name.trim()) {
      toast.error('Indica el nombre del documento');
      return;
    }
    if (!file) {
      toast.error('Selecciona un archivo para subir');
      return;
    }
    setSaving(true);
    try {
      await createCompanyDocument({ name: name.trim(), file });
      toast.success('Documento publicado en el reglamento interno');
      closeUploadModal();
      await loadDocuments();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el documento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (document: CompanyDocument) => {
    if (!window.confirm(`¿Eliminar "${document.name}"? Los empleados dejarán de verlo.`)) return;
    setDeletingId(document.id);
    try {
      await deleteCompanyDocument(document.id);
      toast.success('Documento eliminado');
      await loadDocuments();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el documento');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <LoadingState label="Cargando documentos..." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Documentos y reglamento de la empresa</h3>
          <p className="text-xs text-gray-500 mt-0.5">Estos documentos aparecen para todos los empleados en "Reglamento interno".</p>
        </div>
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors"
        >
          <Plus size={14} />
          Subir documento
        </button>
      </div>

      {documents.length === 0 ? (
        <EmptyState title="No hay documentos publicados" description="Sube el reglamento interno u otras políticas para que los empleados puedan consultarlas." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Documento</Th>
              <Th>Publicado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id} className="hover:bg-gray-50/50">
                <Td>
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900">{document.name}</span>
                  </div>
                </Td>
                <Td>{formatDateTime(document.uploaded_at)}</Td>
                <Td className={actionsCellCls}>
                  <ActionsMenu
                    items={[
                      ...(document.file
                        ? [{
                            label: 'Descargar',
                            icon: Download,
                            onClick: () => window.open(getMediaUrl(document.file as string), '_blank'),
                          }]
                        : []),
                      {
                        label: deletingId === document.id ? 'Eliminando...' : 'Eliminar',
                        icon: Trash2,
                        danger: true,
                        disabled: deletingId === document.id,
                        onClick: () => handleDelete(document),
                      },
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal title="Subir documento" open={showUploadModal} onClose={closeUploadModal}>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Nombre del documento</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputCls}
              placeholder="Ej: Reglamento interno de trabajo"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Archivo</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className={inputCls}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={closeUploadModal}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {saving ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
