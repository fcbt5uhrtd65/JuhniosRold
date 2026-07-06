import { useEffect, useState, useCallback } from 'react';
import {
  Puzzle,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  ShieldCheck,
  Search,
} from 'lucide-react';
import {
  getComponents,
  getRoles,
  getRolePermissions,
  createComponent,
  updateComponent,
  deleteComponent,
  setRolePermission,
  updateRolePermission,
  deleteRolePermission,
  type Component,
  type Role,
  type RoleComponentPermission,
  type CreateComponentPayload,
} from '../../services/roles.service';

// ─── Component CRUD modal ────────────────────────────────────────────────────

interface ComponentModalProps {
  component?: Component;
  onClose: () => void;
  onSaved: (c: Component) => void;
}

function ComponentModal({ component, onClose, onSaved }: ComponentModalProps) {
  const [code, setCode] = useState(component?.code ?? '');
  const [name, setName] = useState(component?.name ?? '');
  const [description, setDescription] = useState(component?.description ?? '');
  const [isActive, setIsActive] = useState(component?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(component);

  const inputCls =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a4038]/30 focus:border-[#2a4038]';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('El código y el nombre son obligatorios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: CreateComponentPayload = {
        code: code.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim(),
        is_active: isActive,
      };
      const saved = isEdit
        ? await updateComponent(component!.id, payload)
        : await createComponent(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el componente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">
            {isEdit ? 'Editar componente' : 'Nuevo componente'}
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
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
              <input
                className={`${inputCls} lowercase`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="catalog.management"
                disabled={isEdit}
                maxLength={64}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Catálogo"
                maxLength={64}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del componente..."
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              style={{ minWidth: 32, height: 18 }}
              className={`rounded-full transition-colors flex items-center ${isActive ? 'bg-[#2a4038]' : 'bg-gray-200'}`}
            >
              <span
                className={`block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${isActive ? 'translate-x-3.5' : 'translate-x-0'}`}
              />
            </button>
            <span className="text-xs text-gray-700">Activo</span>
          </label>

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
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {isEdit ? 'Guardar cambios' : 'Crear componente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete component confirm ────────────────────────────────────────────────

interface DeleteComponentConfirmProps {
  component: Component;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteComponentConfirm({ component, onClose, onDeleted }: DeleteComponentConfirmProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteComponent(component.id);
      onDeleted(component.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
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
            <p className="text-sm font-semibold text-gray-800">Eliminar componente</p>
            <p className="text-xs text-gray-500">También se eliminarán sus permisos asignados.</p>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          ¿Seguro que deseas eliminar{' '}
          <span className="font-semibold">{component.name}</span>?
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
            onClick={handle}
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

// ─── Permission row ──────────────────────────────────────────────────────────

interface PermRowProps {
  roleId: string;
  component: Component;
  perm: RoleComponentPermission | undefined;
  onChanged: (perm: RoleComponentPermission) => void;
  onDeleted: (id: string) => void;
}

function PermRow({ roleId, component, perm, onChanged, onDeleted }: PermRowProps) {
  const [busy, setBusy] = useState(false);

  const toggle = async (type: 'can_view' | 'can_edit') => {
    setBusy(true);
    try {
      const newValue = !(perm?.[type] ?? false);
      if (!perm) {
        const created = await setRolePermission({
          role: roleId,
          component_id: component.id,
          can_view: type === 'can_view' ? newValue : false,
          can_edit: type === 'can_edit' ? newValue : false,
        });
        onChanged(created);
      } else {
        const nextView = type === 'can_view' ? newValue : perm.can_view;
        const nextEdit = type === 'can_edit' ? newValue : perm.can_edit;
        if (!nextView && !nextEdit) {
          await deleteRolePermission(perm.id);
          onDeleted(perm.id);
        } else {
          const updated = await updateRolePermission(perm.id, {
            can_view: nextView,
            can_edit: nextEdit,
          });
          onChanged(updated);
        }
      }
    } catch {
      // keep current state on error
    } finally {
      setBusy(false);
    }
  };

  const Toggle = ({
    type,
    label,
    activeColor,
  }: {
    type: 'can_view' | 'can_edit';
    label: string;
    activeColor: string;
  }) => {
    const active = perm?.[type] ?? false;
    return (
      <button
        onClick={() => toggle(type)}
        disabled={busy}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
          active
            ? `${activeColor} border-transparent`
            : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
        } disabled:opacity-50`}
      >
        {busy ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-current' : 'bg-gray-300'}`} />
        )}
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-4 rounded-xl hover:bg-gray-50/60 transition-colors group">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-800">{component.name}</p>
        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{component.code}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 sm:ml-4">
        <Toggle type="can_view" label="Ver" activeColor="bg-blue-50 text-blue-600" />
        <Toggle type="can_edit" label="Editar" activeColor="bg-green-50 text-green-600" />
      </div>
    </div>
  );
}

// ─── Permissions panel (right side) ─────────────────────────────────────────

interface PermissionsPanelProps {
  role: Role;
  components: Component[];
  permissions: RoleComponentPermission[];
  onPermChanged: (perm: RoleComponentPermission) => void;
  onPermDeleted: (id: string) => void;
}

function PermissionsPanel({
  role,
  components,
  permissions,
  onPermChanged,
  onPermDeleted,
}: PermissionsPanelProps) {
  const [search, setSearch] = useState('');

  const activeComponents = components.filter((c) => c.is_active);
  const filtered = activeComponents.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  const getPermFor = (componentId: string) =>
    permissions.find((p) => p.role === role.id && p.component.id === componentId);

  const assignedCount = activeComponents.filter((c) => {
    const p = getPermFor(c.id);
    return p?.can_view || p?.can_edit;
  }).length;

  if (role.is_superuser) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
          <ShieldCheck size={22} className="text-purple-500" />
        </div>
        <p className="text-sm font-semibold text-gray-700">Acceso total</p>
        <p className="text-xs text-gray-400 max-w-xs">
          El rol <span className="font-medium">{role.name}</span> es superusuario y tiene acceso a
          todos los componentes del sistema sin restricciones.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">{role.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {assignedCount} de {activeComponents.length} componentes con acceso
            </p>
          </div>
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[10px] font-semibold">
            {role.code}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2a4038] rounded-full transition-all"
            style={{ width: activeComponents.length > 0 ? `${(assignedCount / activeComponents.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar componente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a4038]/30 focus:border-[#2a4038]"
          />
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Componente</span>
        <div className="flex gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 w-12 text-center">Ver</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-green-500 w-14 text-center">Editar</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Puzzle size={24} className="text-gray-200" />
            <p className="text-xs text-gray-400">Sin resultados.</p>
          </div>
        ) : (
          filtered.map((comp) => (
            <PermRow
              key={comp.id}
              roleId={role.id}
              component={comp}
              perm={getPermFor(comp.id)}
              onChanged={onPermChanged}
              onDeleted={onPermDeleted}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main AdminComponents ────────────────────────────────────────────────────

type TabId = 'permissions' | 'components';

export function AdminComponents() {
  const [tab, setTab] = useState<TabId>('permissions');
  const [components, setComponents] = useState<Component[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<RoleComponentPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState('');

  const [showCompModal, setShowCompModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Component | undefined>();
  const [deletingComp, setDeletingComp] = useState<Component | undefined>();
  const [compSearch, setCompSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [comps, rls, perms] = await Promise.all([
        getComponents(),
        getRoles(),
        getRolePermissions(),
      ]);
      setComponents(comps);
      setRoles(rls);
      setPermissions(perms);
      if (rls.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rls[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePermChanged = (perm: RoleComponentPermission) => {
    setPermissions((prev) => {
      const idx = prev.findIndex((p) => p.id === perm.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = perm;
        return next;
      }
      return [...prev, perm];
    });
  };

  const handlePermDeleted = (id: string) => {
    setPermissions((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCompSaved = (comp: Component) => {
    setComponents((prev) => {
      const idx = prev.findIndex((c) => c.id === comp.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = comp;
        return next;
      }
      return [...prev, comp];
    });
    setShowCompModal(false);
    setEditingComp(undefined);
  };

  const handleCompDeleted = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
    setPermissions((prev) => prev.filter((p) => p.component.id !== id));
    setDeletingComp(undefined);
  };

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
      r.code.toLowerCase().includes(roleSearch.toLowerCase()),
  );

  const filteredComps = components.filter(
    (c) =>
      c.code.toLowerCase().includes(compSearch.toLowerCase()) ||
      c.name.toLowerCase().includes(compSearch.toLowerCase()),
  );

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle size={24} className="text-red-400" />
        <p className="text-sm text-gray-600">{error}</p>
        <button onClick={load} className="text-xs text-[#2a4038] underline">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Componentes y permisos</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Gestiona los componentes del sistema y los permisos de acceso por rol.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { id: 'permissions', label: 'Permisos por rol', icon: ShieldCheck },
          { id: 'components', label: 'Componentes', icon: Puzzle },
        ] as { id: TabId; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Permissions tab ── */}
      {tab === 'permissions' && (
        <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-260px)] lg:min-h-[480px]">

          {/* Left: role list */}
          <div className="w-full lg:w-64 shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden max-h-72 lg:max-h-none">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Roles</p>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-[#2a4038]/30 focus:border-[#2a4038]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {filteredRoles.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-6">Sin resultados.</p>
              ) : (
                filteredRoles.map((role) => {
                  const isSelected = role.id === selectedRoleId;
                  const permCount = permissions.filter(
                    (p) => p.role === role.id && (p.can_view || p.can_edit),
                  ).length;
                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl mb-0.5 transition-colors ${
                        isSelected
                          ? 'bg-[#2a4038] text-white'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate">{role.name}</span>
                        {role.is_superuser ? (
                          <ShieldCheck
                            size={12}
                            className={isSelected ? 'text-white/70' : 'text-purple-400'}
                          />
                        ) : (
                          <span
                            className={`text-[10px] font-semibold ${
                              isSelected ? 'text-white/70' : 'text-gray-400'
                            }`}
                          >
                            {permCount}
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] mt-0.5 font-mono ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>
                        {role.code}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: permissions panel */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {selectedRole ? (
              <PermissionsPanel
                role={selectedRole}
                components={components}
                permissions={permissions}
                onPermChanged={handlePermChanged}
                onPermDeleted={handlePermDeleted}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 gap-2">
                <ShieldCheck size={32} className="text-gray-200" />
                <p className="text-sm text-gray-400">Selecciona un rol para ver sus permisos.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Components tab ── */}
      {tab === 'components' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <input
              type="text"
              placeholder="Buscar componente..."
              value={compSearch}
              onChange={(e) => setCompSearch(e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#2a4038]/30 focus:border-[#2a4038]"
            />
            <button
              onClick={() => { setEditingComp(undefined); setShowCompModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#1e2e28] transition-colors shadow-sm ml-3 shrink-0"
            >
              <Plus size={14} />
              Nuevo componente
            </button>
          </div>

          {filteredComps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Puzzle size={32} className="text-gray-200" />
              <p className="text-sm text-gray-400">No se encontraron componentes.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nombre</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Código</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Descripción</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Estado</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredComps.map((comp) => (
                    <tr key={comp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 font-medium text-gray-800">{comp.name}</td>
                      <td className="px-5 py-4 font-mono text-gray-500">{comp.code}</td>
                      <td className="px-5 py-4 text-gray-500 max-w-xs">
                        <p className="line-clamp-2">{comp.description || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            comp.is_active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${comp.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                          {comp.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingComp(comp); setShowCompModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingComp(comp)}
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
        </div>
      )}

      {showCompModal && (
        <ComponentModal
          component={editingComp}
          onClose={() => { setShowCompModal(false); setEditingComp(undefined); }}
          onSaved={handleCompSaved}
        />
      )}

      {deletingComp && (
        <DeleteComponentConfirm
          component={deletingComp}
          onClose={() => setDeletingComp(undefined)}
          onDeleted={handleCompDeleted}
        />
      )}
    </div>
  );
}
