import { useEffect, useState } from 'react';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  type Role,
  type CreateRolePayload,
} from '../../services/roles.service';

const BADGE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  SELLER: 'bg-blue-100 text-blue-700',
  RRHH: 'bg-orange-100 text-orange-700',
  EMPLEADO: 'bg-yellow-100 text-yellow-700',
  DISTRIBUTOR: 'bg-cyan-100 text-cyan-700',
  PEDIDOS: 'bg-pink-100 text-pink-700',
  CLIENT: 'bg-gray-100 text-gray-600',
  PRO: 'bg-green-100 text-green-700',
};

function RoleBadge({ code }: { code: string }) {
  const color = BADGE_COLORS[code] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${color}`}>
      {code}
    </span>
  );
}

interface RoleFormState {
  code: string;
  name: string;
  description: string;
  is_superuser: boolean;
  is_default: boolean;
  is_active: boolean;
}

const EMPTY_FORM: RoleFormState = {
  code: '',
  name: '',
  description: '',
  is_superuser: false,
  is_default: false,
  is_active: true,
};

interface RoleModalProps {
  role?: Role;
  onClose: () => void;
  onSaved: (role: Role) => void;
}

function RoleModal({ role, onClose, onSaved }: RoleModalProps) {
  const [form, setForm] = useState<RoleFormState>(
    role
      ? {
          code: role.code,
          name: role.name,
          description: role.description,
          is_superuser: role.is_superuser,
          is_default: role.is_default,
          is_active: role.is_active,
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(role);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.code.trim() || !form.name.trim()) {
      setError('El código y el nombre son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateRolePayload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        is_superuser: form.is_superuser,
        is_default: form.is_default,
        is_active: form.is_active,
      };
      const saved = isEdit
        ? await updateRole(role!.id, payload)
        : await createRole(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );

  const inputCls =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a4038]/30 focus:border-[#2a4038]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">
            {isEdit ? 'Editar rol' : 'Nuevo rol'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Código *">
              <input
                className={`${inputCls} uppercase`}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="ADMIN"
                disabled={isEdit}
                maxLength={32}
              />
            </Field>
            <Field label="Nombre *">
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Administrador"
                maxLength={64}
              />
            </Field>
          </div>

          <Field label="Descripción">
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descripción del rol..."
            />
          </Field>

          <div className="space-y-2">
            {(
              [
                { key: 'is_active', label: 'Activo' },
                { key: 'is_superuser', label: 'Superusuario (acceso total)' },
                { key: 'is_default', label: 'Rol por defecto para nuevos usuarios' },
              ] as { key: keyof RoleFormState; label: string }[]
            ).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
                  className={`w-8 h-4.5 rounded-full transition-colors flex items-center ${
                    form[key] ? 'bg-[#2a4038]' : 'bg-gray-200'
                  }`}
                  style={{ minWidth: 32, height: 18 }}
                >
                  <span
                    className={`block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                      form[key] ? 'translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#1e2e28] transition-colors disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              {isEdit ? 'Guardar cambios' : 'Crear rol'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteConfirmProps {
  role: Role;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteConfirm({ role, onClose, onDeleted }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteRole(role.id);
      onDeleted(role.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el rol.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Eliminar rol</p>
            <p className="text-xs text-gray-500">Esta acción no se puede deshacer.</p>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          ¿Seguro que deseas eliminar el rol{' '}
          <span className="font-semibold">{role.name}</span> ({role.code})?
        </p>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionList({ permissions }: { permissions: Role['component_permissions'] }) {
  const [open, setOpen] = useState(false);
  if (permissions.length === 0) {
    return <span className="text-xs text-gray-400 italic">Sin permisos asignados</span>;
  }
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
      >
        {permissions.length} componente{permissions.length !== 1 ? 's' : ''}
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {permissions.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[11px] text-gray-600">
              <span className="font-medium text-gray-700">{p.component.name}</span>
              <span className="text-gray-300">|</span>
              {p.can_view && (
                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">Ver</span>
              )}
              {p.can_edit && (
                <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-medium">Editar</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | undefined>();
  const [deletingRole, setDeletingRole] = useState<Role | undefined>();
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRoles();
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = roles.filter(
    (r) =>
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSaved = (saved: Role) => {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowModal(false);
    setEditingRole(undefined);
  };

  const handleDeleted = (id: string) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    setDeletingRole(undefined);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Roles</h1>
          <p className="text-xs text-gray-500 mt-0.5">Gestiona los roles del sistema y sus propiedades.</p>
        </div>
        <button
          onClick={() => { setEditingRole(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#1e2e28] transition-colors shadow-sm"
        >
          <Plus size={14} />
          Nuevo rol
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por código o nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2a4038]/30 focus:border-[#2a4038]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-sm text-gray-600">{error}</p>
          <button
            onClick={load}
            className="text-xs text-[#2a4038] underline"
          >
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Shield size={32} className="text-gray-200" />
          <p className="text-sm text-gray-400">No se encontraron roles.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Rol</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Descripción</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Permisos</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Estado</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <RoleBadge code={role.code} />
                      <span className="font-medium text-gray-800">{role.name}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      {role.is_superuser && (
                        <span className="text-[10px] text-purple-500 font-medium">Superusuario</span>
                      )}
                      {role.is_default && (
                        <span className="text-[10px] text-blue-500 font-medium">Por defecto</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-500 max-w-xs">
                    <p className="line-clamp-2">{role.description || '—'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <PermissionList permissions={role.component_permissions} />
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        role.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${role.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                      />
                      {role.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditingRole(role); setShowModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeletingRole(role)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <RoleModal
          role={editingRole}
          onClose={() => { setShowModal(false); setEditingRole(undefined); }}
          onSaved={handleSaved}
        />
      )}

      {deletingRole && (
        <DeleteConfirm
          role={deletingRole}
          onClose={() => setDeletingRole(undefined)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
