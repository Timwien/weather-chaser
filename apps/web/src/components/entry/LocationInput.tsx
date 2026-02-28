import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore.ts';
import { useLocationSearch } from '../../hooks/useLocationSearch.ts';
import { parseBbox } from '../../services/nominatim.ts';
import type { NominatimResult } from '../../services/nominatim.ts';

interface LocationInputProps {
  /** Optional override label key — defaults to 'entry.location' */
  labelKey?: string;
  /** Called when a result is selected, in addition to store write */
  onSelect?: (result: NominatimResult) => void;
  /** Optional placeholder override */
  placeholder?: string;
}

export function LocationInput({ labelKey = 'entry.location', onSelect, placeholder }: LocationInputProps) {
  const { t } = useTranslation('common');
  const { setSearchArea } = useAppStore();
  const { search, results, loading } = useLocationSearch();

  const [inputValue, setInputValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    setDropdownOpen(true);
    search(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
    } else if (e.key === 'Enter' && results.length > 0) {
      selectResult(results[0]);
    }
  }

  function selectResult(result: NominatimResult) {
    const bbox = parseBbox(result);
    // Trim display name to first segment (before first comma)
    const shortName = result.display_name.split(',')[0].trim();
    setInputValue(shortName);
    setDropdownOpen(false);
    setSearchArea({
      type: 'place',
      name: result.display_name,
      bbox: [bbox.west, bbox.south, bbox.east, bbox.north],
    });
    if (onSelect) onSelect(result);
  }

  const showDropdown = dropdownOpen && results.length > 0;

  return (
    <div className="location-input-wrapper" ref={containerRef}>
      <label className="input-label">{t(labelKey)}</label>
      <div className="location-input-container">
        <input
          type="text"
          className="text-input"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t(labelKey)}
          autoComplete="off"
        />
        {loading && <div className="loading-bar" aria-hidden="true" />}
      </div>
      {showDropdown && (
        <ul className="autocomplete-dropdown" role="listbox">
          {results.slice(0, 5).map((result) => (
            <li
              key={result.place_id}
              role="option"
              className="autocomplete-option"
              onMouseDown={() => selectResult(result)}
            >
              {result.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
