import { Filter, X } from 'lucide-react';
import { useState } from 'react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
  multiple?: boolean;
}

interface FilterPanelProps {
  filters: FilterGroup[];
  activeFilters: Record<string, string[]>;
  onFilterChange: (filterId: string, values: string[]) => void;
  onClearAll: () => void;
}

export function FilterPanel({ filters, activeFilters, onFilterChange, onClearAll }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = Object.values(activeFilters).flat().length;

  const handleToggle = (filterId: string, value: string, multiple: boolean) => {
    const current = activeFilters[filterId] || [];
    let newValues: string[];

    if (multiple) {
      newValues = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
    } else {
      newValues = current.includes(value) ? [] : [value];
    }

    onFilterChange(filterId, newValues);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Filter size={14} />
        Filtros
        {activeCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#2a4038] text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Filtros Activos</p>
            {activeCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Limpiar todo
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filters.map(group => (
              <div key={group.id} className="p-4 border-b border-gray-100 last:border-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">{group.label}</p>
                <div className="space-y-1">
                  {group.options.map(option => {
                    const isActive = (activeFilters[group.id] || []).includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 cursor-pointer rounded-lg hover:bg-gray-50 px-2 py-1.5 transition-colors"
                      >
                        <input
                          type={group.multiple ? 'checkbox' : 'radio'}
                          checked={isActive}
                          onChange={() => handleToggle(group.id, option.value, group.multiple || false)}
                          className="w-3.5 h-3.5 accent-[#2a4038]"
                        />
                        <span className="text-xs text-gray-700 flex-1">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors"
            >
              Aplicar
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
