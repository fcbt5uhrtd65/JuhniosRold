import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, MapPin, X } from 'lucide-react';
import { geographyService, type City, type Country, type State } from '../../services/geography.service';
import type { LocationValue } from '../../services/geography.types';

// ─── Generic Combobox ────────────────────────────────────────────────────────

interface ComboboxProps<T extends { id: number; name: string }> {
  label: string;
  selectedName: string;
  placeholder: string;
  hint?: string;
  items: T[];
  loading: boolean;
  disabled: boolean;
  required?: boolean;
  onSearch: (q: string) => void;
  onSelect: (item: T) => void;
  onClear: () => void;
}

function Combobox<T extends { id: number; name: string }>({
  label,
  selectedName,
  placeholder,
  hint,
  items,
  loading,
  disabled,
  required = false,
  onSearch,
  onSelect,
  onClear,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync display when external value changes or dropdown closes
  useEffect(() => {
    if (!open) setInputValue(selectedName);
  }, [selectedName, open]);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setInputValue('');   // clear so user can type fresh
    onSearch('');        // load full list immediately
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setInputValue(q);
    onSearch(q);
  }

  function handleSelect(item: T) {
    onSelect(item);
    setInputValue(item.name);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onClear();
    setInputValue('');
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const showDropdown = open && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <span className="block text-xs mb-2">
        {label}{required ? ' *' : ''}
      </span>

      <div
        className={[
          'flex items-center border bg-background transition-colors',
          disabled ? 'opacity-40 cursor-not-allowed border-border' : 'cursor-text border-border hover:border-foreground/50',
          showDropdown ? '!border-foreground' : '',
        ].join(' ')}
        onClick={() => { if (!disabled && !open) openDropdown(); }}
      >
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={inputValue}
          onChange={handleChange}
          onFocus={openDropdown}
          placeholder={disabled && hint ? hint : placeholder}
          className="flex-1 px-4 py-2.5 bg-transparent focus:outline-none text-sm min-w-0 disabled:cursor-not-allowed"
        />
        <div className="flex items-center pr-2 gap-1 shrink-0">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {selectedName && !disabled && !loading && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="p-0.5 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {!loading && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${showDropdown ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute z-[9999] left-0 right-0 top-full mt-0.5 bg-background border border-border shadow-lg max-h-56 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando…
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No se encontraron resultados
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                className={[
                  'w-full text-left px-4 py-2.5 text-sm transition-colors',
                  item.name === selectedName
                    ? 'bg-secondary font-medium'
                    : 'hover:bg-secondary/60',
                ].join(' ')}
              >
                {item.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── LocationPicker ───────────────────────────────────────────────────────────

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  required?: boolean;
  /** When false, hides the País field and pre-selects Colombia automatically */
  showCountry?: boolean;
  /** ISO-3 code of the country to auto-select when showCountry=false. Default: "COL" */
  defaultCountryIso?: string;
}

export function LocationPicker({
  value,
  onChange,
  required = false,
  showCountry = true,
  defaultCountryIso = 'COL',
}: LocationPickerProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // When showCountry=false: resolve the default country once and set it
  useEffect(() => {
    if (showCountry || value.countryId) return;
    setLoadingStates(true);
    geographyService.getCountries(defaultCountryIso).then((results) => {
      const match = results.find((c) => c.iso_code === defaultCountryIso) ?? results[0];
      if (match) {
        onChange({ ...value, countryId: match.id, countryName: match.name });
      }
    }).finally(() => setLoadingStates(false));
  // Only run once on mount / when showCountry changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCountry]);

  // Load states when country is set
  useEffect(() => {
    if (!value.countryId) { setStates([]); return; }
    setLoadingStates(true);
    geographyService.getStates(value.countryId)
      .then(setStates)
      .finally(() => setLoadingStates(false));
  }, [value.countryId]);

  // Load cities when state is set
  useEffect(() => {
    if (!value.stateId) { setCities([]); return; }
    setLoadingCities(true);
    geographyService.getCities(value.stateId)
      .then(setCities)
      .finally(() => setLoadingCities(false));
  }, [value.stateId]);

  const searchCountries = useCallback((q: string) => {
    setLoadingCountries(true);
    geographyService.getCountries(q)
      .then(setCountries)
      .finally(() => setLoadingCountries(false));
  }, []);

  const searchStates = useCallback((q: string) => {
    if (!value.countryId) return;
    setLoadingStates(true);
    geographyService.getStates(value.countryId, q)
      .then(setStates)
      .finally(() => setLoadingStates(false));
  }, [value.countryId]);

  const searchCities = useCallback((q: string) => {
    if (!value.stateId) return;
    setLoadingCities(true);
    geographyService.getCities(value.stateId, q)
      .then(setCities)
      .finally(() => setLoadingCities(false));
  }, [value.stateId]);

  function selectCountry(country: Country) {
    onChange({ countryId: country.id, countryName: country.name, stateId: null, stateName: '', cityId: null, cityName: '' });
    setStates([]);
    setCities([]);
  }

  function clearCountry() {
    onChange(EMPTY_LOCATION);
    setStates([]);
    setCities([]);
  }

  function selectState(state: State) {
    onChange({ ...value, stateId: state.id, stateName: state.name, cityId: null, cityName: '' });
    setCities([]);
  }

  function clearState() {
    onChange({ ...value, stateId: null, stateName: '', cityId: null, cityName: '' });
    setCities([]);
  }

  function selectCity(city: City) {
    onChange({ ...value, cityId: city.id, cityName: city.name });
  }

  function clearCity() {
    onChange({ ...value, cityId: null, cityName: '' });
  }

  const stateDisabled = !value.countryId || loadingStates;
  const cityDisabled = !value.stateId || loadingCities;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="w-3.5 h-3.5" />
        <span>Ubicación</span>
      </div>

      {showCountry && (
        <Combobox<Country>
          label="País"
          selectedName={value.countryName}
          placeholder="Escribe para buscar país…"
          items={countries}
          loading={loadingCountries}
          disabled={false}
          required={required}
          onSearch={searchCountries}
          onSelect={selectCountry}
          onClear={clearCountry}
        />
      )}

      <Combobox<State>
        label="Departamento / Estado"
        selectedName={value.stateName}
        placeholder="Escribe para buscar departamento…"
        hint="Selecciona un país primero"
        items={states}
        loading={loadingStates}
        disabled={stateDisabled}
        required={required}
        onSearch={searchStates}
        onSelect={selectState}
        onClear={clearState}
      />

      <Combobox<City>
        label="Ciudad / Municipio"
        selectedName={value.cityName}
        placeholder="Escribe para buscar ciudad…"
        hint="Selecciona un departamento primero"
        items={cities}
        loading={loadingCities}
        disabled={cityDisabled}
        required={required}
        onSearch={searchCities}
        onSelect={selectCity}
        onClear={clearCity}
      />
    </div>
  );
}
