import { useMemo, useState } from 'react';
import { inputCls, selectCls } from './AdminUI';
import { OTHER_OPTION_VALUE } from '../../utils/socialSecurityCatalog';

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

  const selectValue = isCustom ? OTHER_OPTION_VALUE : value;

  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</span>
      <select
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === OTHER_OPTION_VALUE) {
            setIsCustom(true);
            onChange('');
            return;
          }
          setIsCustom(false);
          onChange(next);
        }}
        className={selectCls}
        disabled={disabled}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER_OPTION_VALUE}>Otro</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Escribe el nombre"
          className={`${inputCls} mt-2`}
          disabled={disabled}
        />
      )}
    </label>
  );
}
