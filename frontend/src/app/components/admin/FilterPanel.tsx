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
        className="flex items-center gap-2 px-4 py-2 border border-border text-xs tracking-wider uppercase hover:bg-secondary transition-colors"
      >
        <Filter className="w-4 h-4" strokeWidth={1} />
        Filtros
        {activeCount > 0 && (
          <span className="ml-1 px-2 py-0.5 bg-foreground text-background text-[10px]">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border shadow-lg z-50">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Filtros Activos
            </div>
            {activeCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar todo
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filters.map(group => (
              <div key={group.id} className="p-4 border-b border-border last:border-0">
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                  {group.label}
                </div>
                <div className="space-y-2">
                  {group.options.map(option => {
                    const isActive = (activeFilters[group.id] || []).includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-secondary px-2 py-1.5 transition-colors"
                      >
                        <input
                          type={group.multiple ? 'checkbox' : 'radio'}
                          checked={isActive}
                          onChange={() => handleToggle(group.id, option.value, group.multiple || false)}
                          className="w-3 h-3 border border-border"
                        />
                        <span className="text-xs flex-1">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 py-2 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
            >
              Aplicar
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-border text-xs tracking-wider uppercase hover:bg-secondary"
            >
              <X className="w-4 h-4" strokeWidth={1} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
