import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, Search, X, Save, Loader2, Inbox, AlertCircle, Upload, MoreVertical } from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   Librería visual compartida del panel administrativo.
   Estilo estándar tomado de AdminInventarioProduccion.
   Solo presentación — sin lógica de negocio ni datos.
═══════════════════════════════════════════════════════ */

export type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple';

const BADGE_STYLES: Record<BadgeColor, string> = {
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 border border-amber-200',
  red: 'bg-red-50 text-red-700 border border-red-200',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  gray: 'bg-gray-50 text-gray-600 border border-gray-200',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200',
};

export function Badge({ label, color }: { label: ReactNode; color: BadgeColor }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${BADGE_STYLES[color]}`}>{label}</span>;
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] transition-all placeholder:text-gray-300";
export const selectCls = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] transition-all";

export function PageHeader({ title, subtitle, onNew, newLabel, actions }: { title: string; subtitle?: string; onNew?: () => void; newLabel?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {actions}
        {onNew && (
          <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors whitespace-nowrap">
            <Plus size={14} /> {newLabel ?? 'Nuevo'}
          </button>
        )}
      </div>
    </div>
  );
}

export function PrimaryButton({ children, onClick, type, disabled, icon }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; icon?: ReactNode }) {
  return (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {icon}{children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, type, icon }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; icon?: ReactNode }) {
  return (
    <button type={type ?? 'button'} onClick={onClick} className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
      {icon}{children}
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white border border-gray-100 rounded-2xl shadow-sm ${className ?? ''}`}>{children}</div>;
}

export function Table({ children, scrollable }: { children: ReactNode; scrollable?: boolean }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className={`overflow-x-auto ${scrollable ? 'max-h-[600px] overflow-y-auto' : ''}`}>
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100 whitespace-nowrap">
      {children}
    </th>
  );
}

export function Td({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void }) {
  return (
    <td onClick={onClick} className={`px-4 py-3 border-b border-gray-50 text-sm text-gray-700 ${className ?? ''}`}>
      {children}
    </td>
  );
}

export type ActionMenuItem = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function actionButtonColorCls(danger?: boolean) {
  return danger
    ? 'text-gray-400 hover:bg-red-50 hover:text-red-500'
    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600';
}

// La celda de Acciones se declara @container (ver `actionsCellCls`, usado en
// el Td correspondiente). Su ancho lo decide el layout normal de la tabla —
// crece si sobra espacio en la fila, se angosta si no. La media query de
// contenedor (@[132px]:flex / @[132px]:hidden en ActionsMenu) reacciona a
// ese ancho ya resuelto por el navegador, en CSS puro: sin JS, sin ciclos de
// medición ni parpadeos.
export const actionsCellCls = '[container-type:inline-size]';

export function ActionsMenu({ items }: { items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Botones directos: visibles solo si el contenedor (celda @container)
          tiene al menos ACTIONS_EXPAND_MIN_WIDTH de ancho. */}
      <div className="hidden @[132px]:flex items-center gap-1">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={item.onClick}
              disabled={item.disabled}
              title={item.label}
              className={`p-1.5 rounded-lg border border-gray-200 transition-colors disabled:opacity-50 ${actionButtonColorCls(item.danger)}`}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>

      {/* Menú kebab: visible solo si el contenedor NO tiene espacio suficiente. */}
      <div className="@[132px]:hidden">
        <button
          onClick={() => setOpen(v => !v)}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          title="Acciones"
        >
          <MoreVertical size={14} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  onClick={() => { setOpen(false); item.onClick(); }}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors disabled:opacity-50 ${
                    item.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({ title, open, onClose, wide, children }: { title: string; open: boolean; onClose: () => void; wide?: boolean; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white ${wide ? 'w-full max-w-2xl' : 'w-full max-w-xl'} h-full flex flex-col shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ title, open, onClose, wide, children, disableOverlayClose }: { title: string; open: boolean; onClose: () => void; wide?: boolean; children: ReactNode; disableOverlayClose?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={disableOverlayClose ? undefined : onClose} />
      <div className={`relative bg-white ${wide ? 'w-full max-w-2xl' : 'w-full max-w-lg'} max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function SearchBarAdmin({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Buscar...'}
        className="pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl w-full bg-white focus:outline-none focus:ring-2 focus:ring-[#2a4038]/20 focus:border-[#2a4038] transition-all"
      />
    </div>
  );
}

export function DrawerFooter({ onClose, onSave, saveLabel }: { onClose: () => void; onSave?: () => void; saveLabel?: string }) {
  return (
    <div className="flex gap-3 mt-8 pt-5 border-t border-gray-100">
      <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
      <button onClick={onSave} className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] flex items-center justify-center gap-2">
        <Save size={14} /> {saveLabel ?? 'Guardar'}
      </button>
    </div>
  );
}

export function KpiCard({ label, value, sub, icon: Icon, color, trend }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; trend?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-2.5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
        {trend && <span className="text-[10px] text-gray-400">{trend}</span>}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs font-medium text-gray-700 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Loader2 size={22} className="animate-spin mb-3" />
      <p className="text-xs">{label ?? 'Cargando...'}</p>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4 text-gray-300">
        <Inbox size={20} />
      </div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {description && <p className="text-xs text-gray-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4 text-red-400">
        <AlertCircle size={20} />
      </div>
      <p className="text-sm font-semibold text-gray-700">{title ?? 'Ocurrió un error'}</p>
      {description && <p className="text-xs text-gray-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: React.ComponentType<{ size?: number }> }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 flex-wrap">
      {tabs.map(t => {
        const Icon = t.icon;
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${active ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {Icon && <Icon size={12} />} {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Vista previa"
            className="w-full h-48 object-contain rounded-xl border border-gray-100 bg-gray-50 p-2"
          />
          <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/70 hover:bg-white hover:text-gray-900 transition-colors"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/70 hover:bg-white hover:text-gray-900 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl h-48 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <Upload size={20} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-500">Subir imagen</span>
          <span className="text-[11px] text-gray-400">o arrastra aquí</span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
          O pega una URL de imagen
        </label>
        <input
          type="url"
          value={value.startsWith('data:') ? '' : value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </div>
    </div>
  );
}
