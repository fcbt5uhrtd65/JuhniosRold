import type { ReactNode } from 'react';
import { Plus, Search, X, Save, Loader2, Inbox, AlertCircle } from 'lucide-react';

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
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onNew && (
          <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors">
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

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100 whitespace-nowrap">{children}</th>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 border-b border-gray-50 text-sm text-gray-700 ${className ?? ''}`}>{children}</td>;
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

export function Modal({ title, open, onClose, wide, children }: { title: string; open: boolean; onClose: () => void; wide?: boolean; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
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
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        {trend && <span className="text-[10px] text-gray-400">{trend}</span>}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-700 mt-0.5">{label}</p>
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
