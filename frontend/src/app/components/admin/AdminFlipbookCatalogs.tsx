import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Layers3,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  PrimaryButton,
  SearchBarAdmin,
  SecondaryButton,
  Table,
  Td,
  Th,
  inputCls,
} from './AdminUI';
import { useToast } from '../../contexts/ToastContext';
import {
  createFlipbookCatalog,
  deleteFlipbookCatalog,
  getFlipbookCatalogsForAdmin,
  updateFlipbookCatalog,
  type FlipbookCatalog,
  type FlipbookCatalogPayload,
} from '../../services/products.service';

type FormState = {
  title: string;
  label: string;
  description: string;
  url: string;
  accent_color: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  title: '',
  label: '',
  description: '',
  url: '',
  accent_color: '#2D3A1F',
  sort_order: '0',
  is_active: true,
};

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function toFormState(catalog: FlipbookCatalog): FormState {
  return {
    title: catalog.title,
    label: catalog.label,
    description: catalog.description,
    url: catalog.url,
    accent_color: catalog.accent_color,
    sort_order: String(catalog.sort_order),
    is_active: catalog.is_active,
  };
}

function toPayload(form: FormState): FlipbookCatalogPayload {
  return {
    title: form.title.trim(),
    label: form.label.trim(),
    description: form.description.trim(),
    url: form.url.trim(),
    accent_color: form.accent_color.trim(),
    sort_order: Number(form.sort_order) || 0,
    is_active: form.is_active,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AdminFlipbookCatalogs() {
  const toast = useToast();
  const [catalogs, setCatalogs] = useState<FlipbookCatalog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<FlipbookCatalog | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const loadCatalogs = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFlipbookCatalogsForAdmin(signal);
      setCatalogs(data);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los catálogos.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadCatalogs(controller.signal);
    return () => controller.abort();
  }, []);

  const filteredCatalogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return catalogs;
    return catalogs.filter(catalog =>
      [catalog.title, catalog.label, catalog.description, catalog.url]
        .some(value => value.toLowerCase().includes(term)),
    );
  }, [catalogs, search]);

  const activeCount = catalogs.filter(catalog => catalog.is_active).length;

  const openCreateModal = () => {
    setEditingCatalog(null);
    setForm({ ...EMPTY_FORM, sort_order: String(catalogs.length + 1) });
    setModalOpen(true);
  };

  const openEditModal = (catalog: FlipbookCatalog) => {
    setEditingCatalog(catalog);
    setForm(toFormState(catalog));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingCatalog(null);
    setForm(EMPTY_FORM);
  };

  const validateForm = () => {
    if (!form.title.trim()) return 'El título es obligatorio.';
    if (!form.url.trim()) return 'La URL del flipbook es obligatoria.';
    if (!/^https?:\/\//i.test(form.url.trim())) return 'La URL debe iniciar con http:// o https://.';
    if (!HEX_COLOR_REGEX.test(form.accent_color.trim())) return 'El color debe tener formato hexadecimal, por ejemplo #2D3A1F.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toast.warning(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editingCatalog) {
        const updated = await updateFlipbookCatalog(editingCatalog.id, payload);
        setCatalogs(prev => prev.map(item => item.id === updated.id ? updated : item));
        toast.success('Catálogo actualizado.');
      } else {
        const created = await createFlipbookCatalog(payload);
        setCatalogs(prev => [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)));
        toast.success('Catálogo creado.');
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el catálogo.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (catalog: FlipbookCatalog) => {
    try {
      const updated = await updateFlipbookCatalog(catalog.id, { is_active: !catalog.is_active });
      setCatalogs(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success(updated.is_active ? 'Catálogo publicado.' : 'Catálogo ocultado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    }
  };

  const handleDelete = async (catalog: FlipbookCatalog) => {
    const confirmed = window.confirm(`¿Eliminar "${catalog.title}"? Esta acción lo retirará del listado administrativo.`);
    if (!confirmed) return;

    try {
      await deleteFlipbookCatalog(catalog.id);
      setCatalogs(prev => prev.filter(item => item.id !== catalog.id));
      toast.success('Catálogo eliminado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el catálogo.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Catálogos"
        subtitle="Gestiona los flipbooks que se muestran en la página pública de catálogos."
        onNew={openCreateModal}
        newLabel="Nuevo catálogo"
      />

      <div className="grid gap-3 mb-6 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Publicados</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{activeCount}</p>
          <p className="text-xs text-gray-400">Visibles en /catalogo</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Totales</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{catalogs.length}</p>
          <p className="text-xs text-gray-400">Incluye ocultos</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Orden</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">Manual</p>
          <p className="text-xs text-gray-400">Menor número aparece primero</p>
        </Card>
      </div>

      <div className="mb-4 max-w-md">
        <SearchBarAdmin value={search} onChange={setSearch} placeholder="Buscar por título, etiqueta o URL..." />
      </div>

      {loading ? (
        <Card>
          <LoadingState label="Cargando catálogos..." />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState
            title="No se pudieron cargar los catálogos"
            description={error}
            action={<SecondaryButton onClick={() => loadCatalogs()}>Reintentar</SecondaryButton>}
          />
        </Card>
      ) : filteredCatalogs.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'No hay resultados para la búsqueda' : 'Aún no hay catálogos'}
            description={search ? 'Prueba con otro término.' : 'Crea el primer flipbook para publicarlo en la página de catálogos.'}
            action={!search && <PrimaryButton onClick={openCreateModal}>Nuevo catálogo</PrimaryButton>}
          />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Catálogo</Th>
              <Th>Estado</Th>
              <Th>Orden</Th>
              <Th>Actualizado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {filteredCatalogs.map(catalog => (
              <tr key={catalog.id} className="hover:bg-gray-50/70 transition-colors">
                <Td>
                  <div className="flex items-start gap-3 min-w-[280px]">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: catalog.accent_color }}
                    >
                      <Layers3 size={15} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{catalog.title}</p>
                      {catalog.label && <p className="text-xs text-[#8B7355] font-medium mt-0.5">{catalog.label}</p>}
                      {catalog.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{catalog.description}</p>}
                      <a
                        href={catalog.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex max-w-xs items-center gap-1 truncate text-[11px] font-semibold text-[#2a4038] hover:underline"
                      >
                        <ExternalLink size={11} strokeWidth={1.8} />
                        {catalog.url}
                      </a>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge
                    color={catalog.is_active ? 'green' : 'gray'}
                    label={catalog.is_active ? 'Publicado' : 'Oculto'}
                  />
                </Td>
                <Td>
                  <span className="text-sm font-semibold text-gray-700">{catalog.sort_order}</span>
                </Td>
                <Td>
                  <span className="text-xs text-gray-500">{formatDate(catalog.updated_at)}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={catalog.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-white hover:text-[#2a4038]"
                      title="Abrir flipbook"
                    >
                      <BookOpen size={14} strokeWidth={1.8} />
                    </a>
                    <button
                      onClick={() => handleToggleActive(catalog)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-white hover:text-[#2a4038]"
                      title={catalog.is_active ? 'Ocultar' : 'Publicar'}
                    >
                      {catalog.is_active ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
                    </button>
                    <button
                      onClick={() => openEditModal(catalog)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-white hover:text-[#2a4038]"
                      title="Editar"
                    >
                      <Edit2 size={14} strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={() => handleDelete(catalog)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-500 transition-colors hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        title={editingCatalog ? 'Editar catálogo' : 'Nuevo catálogo'}
        open={modalOpen}
        onClose={closeModal}
        wide
        disableOverlayClose={saving}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" required>
              <input
                value={form.title}
                onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                className={inputCls}
                placeholder="Catálogo comercial"
              />
            </Field>
            <Field label="Etiqueta">
              <input
                value={form.label}
                onChange={event => setForm(prev => ({ ...prev, label: event.target.value }))}
                className={inputCls}
                placeholder="Productos Juhnios Rold"
              />
            </Field>
          </div>

          <Field label="URL del flipbook" required>
            <input
              value={form.url}
              onChange={event => setForm(prev => ({ ...prev, url: event.target.value }))}
              className={inputCls}
              placeholder="https://heyzine.com/flip-book/..."
            />
          </Field>

          <Field label="Descripción">
            <textarea
              value={form.description}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
              className={`${inputCls} min-h-[96px] resize-y`}
              placeholder="Breve descripción para la tarjeta pública."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Color" required>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={HEX_COLOR_REGEX.test(form.accent_color) ? form.accent_color : '#2D3A1F'}
                  onChange={event => setForm(prev => ({ ...prev, accent_color: event.target.value.toUpperCase() }))}
                  className="h-10 w-12 shrink-0 rounded-lg border border-gray-200 bg-white p-1"
                />
                <input
                  value={form.accent_color}
                  onChange={event => setForm(prev => ({ ...prev, accent_color: event.target.value }))}
                  className={inputCls}
                  placeholder="#2D3A1F"
                />
              </div>
            </Field>
            <Field label="Orden">
              <input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={event => setForm(prev => ({ ...prev, sort_order: event.target.value }))}
                className={inputCls}
              />
            </Field>
            <Field label="Estado">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={event => setForm(prev => ({ ...prev, is_active: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-[#2a4038] focus:ring-[#2a4038]"
                />
                Publicado
              </label>
            </Field>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Vista de tarjeta</p>
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ backgroundColor: HEX_COLOR_REGEX.test(form.accent_color) ? form.accent_color : '#2D3A1F' }}
              >
                <Layers3 size={16} strokeWidth={1.8} />
              </div>
              <p className="text-base font-semibold text-gray-900">{form.title || 'Título del catálogo'}</p>
              <p className="mt-1 text-xs font-medium text-[#8B7355]">{form.label || 'Etiqueta del catálogo'}</p>
              <p className="mt-2 text-sm leading-6 text-gray-500">{form.description || 'Descripción breve del catálogo.'}</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
            <SecondaryButton onClick={closeModal}>Cancelar</SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? 'Guardando...' : editingCatalog ? 'Guardar cambios' : 'Crear catálogo'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
