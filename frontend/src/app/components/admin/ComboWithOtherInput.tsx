import { useEffect, useMemo, useRef, useState } from 'react';
import { inputCls } from './AdminUI';

interface ComboWithOtherInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  emptyLabel?: string;
}

export function ComboWithOtherInput({ label, value, onChange, options, disabled = false, emptyLabel = 'Selecciona una opción' }: ComboWithOtherInputProps) {
  const isKnownOption = useMemo(() => !value || options.includes(value), [value, options]);
  const [isCustom, setIsCustom] = useState(!isKnownOption);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [options, query]);

  function openDropdown() {
    if (disabled) return;
    setQuery('');
    setOpen(true);
  }

  function selectOption(option: string) {
    setIsCustom(false);
    onChange(option);
    setQuery('');
    setOpen(false);
  }

  function selectOther() {
    setIsCustom(true);
    onChange('');
    setQuery('');
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const displayValue = open ? query : isCustom ? '' : value;

  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</span>
      {isCustom ? (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Escribe el nombre"
            className={inputCls}
            disabled={disabled}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setIsCustom(false);
                onChange('');
              }}
              className="text-xs font-medium text-[#2a4038] hover:underline"
            >
              Elegir de la lista
            </button>
          )}
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <input
            type="text"
            value={displayValue}
            placeholder={value || emptyLabel}
            onFocus={openDropdown}
            onClick={openDropdown}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!open) setOpen(true);
            }}
            className={inputCls}
            disabled={disabled}
            autoComplete="off"
          />
          {open && !disabled && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-gray-400">Sin resultados</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(event) => { event.preventDefault(); selectOption(option); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${option === value ? 'bg-[#2a4038]/10 font-medium text-[#2a4038]' : 'hover:bg-gray-50'}`}
                  >
                    {option}
                  </button>
                ))
              )}
              <button
                type="button"
                onMouseDown={(event) => { event.preventDefault(); selectOther(); }}
                className="w-full text-left px-3 py-2 text-sm border-t border-gray-100 text-gray-500 hover:bg-gray-50"
              >
                Otro…
              </button>
            </div>
          )}
        </div>
      )}
    </label>
  );
}
