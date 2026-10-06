import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, ArrowLeft, ArrowUpDown, ChevronDown, Check, X } from 'lucide-react';
import { FilterState, TransitCar } from '../types';
import { countFilteredTransits } from '../utils/filterUtils';

interface FilterBarProps {
  cars?: TransitCar[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  onResetFilters: () => void;
  totalResultsCount: number;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
}

interface DropdownOption {
  value: string;
  label: string;
}

const YEARS_LIST = [
  '2026', '2025', '2024', '2023', '2022', '2021', '2020',
  '2019', '2018', '2017', '2016', '2015',
  '2014', '2013', '2012', '2011', '2010',
  '2009', '2008', '2007', '2006', '2005',
  '2004', '2003', '2002', '2001', '2000'
];

const BRAND_OPTIONS: DropdownOption[] = [
  { value: 'Ford', label: 'Ford' },
  { value: 'Mercedes', label: 'Mercedes' }
];

const BODY_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'Yük furqonu', label: 'Yük furqonu' },
  { value: 'Sərnişin', label: 'Sərnişin' },
  { value: 'Mikroavtobus', label: 'Mikroavtobus' },
  { value: 'Bortlu / Tentli', label: 'Bortlu / Tentli' },
  { value: 'Soyuducu (Ref)', label: 'Soyuducu (Ref)' },
  { value: 'Pikap', label: 'Pikap' },
  { value: 'Şassi', label: 'Şassi' },
  { value: 'Digər', label: 'Digər' }
];

const BASE_LENGTH_OPTIONS: DropdownOption[] = [
  { value: '2.4 m', label: '2.4 m' },
  { value: '2.8 m', label: '2.8 m' },
  { value: '3.30 m', label: '3.30 m' },
  { value: '4 m', label: '4.0 m' }
];

const FUEL_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'Dizel', label: 'Dizel' },
  { value: 'Benzin', label: 'Benzin' }
];

const TRANSMISSION_OPTIONS: DropdownOption[] = [
  { value: 'Mexanika', label: 'Mexanika' },
  { value: 'Avtomat', label: 'Avtomat' }
];

const parseMulti = (val: string | string[] | undefined): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v && v !== 'all' && v !== 'Hamısı');
  if (typeof val === 'string' && val !== 'all' && val !== 'Hamısı') {
    return val.split(',').map(s => s.trim()).filter(s => s && s !== 'all' && s !== 'Hamısı');
  }
  return [];
};

// Helper to dynamically calculate if dropdown should open upward or downward based on available space
const calculateDropdownDirection = (
  container: HTMLElement | null,
  requiredHeight = 280
): boolean => {
  if (!container || typeof window === 'undefined') return false;

  const rect = container.getBoundingClientRect();
  const scrollContainer = container.closest('.overflow-y-auto');
  let spaceBelow = window.innerHeight - rect.bottom;
  let spaceAbove = rect.top;

  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    spaceBelow = Math.min(spaceBelow, containerRect.bottom - rect.bottom);
    spaceAbove = Math.min(spaceAbove, rect.top - containerRect.top);
  }

  // Only open upward if there is genuinely enough room above to prevent clipping the top,
  // and there is not enough room below. Otherwise always open downward.
  return spaceBelow < requiredHeight && spaceAbove >= requiredHeight;
};

// ----------------------------------------------------------------------
// 1. TURBO.AZ CUSTOM MULTI-SELECT POPOVER COMPONENT
// ----------------------------------------------------------------------
interface TurboMultiSelectProps {
  label: string;
  placeholder: string;
  options: DropdownOption[];
  value: string | string[] | undefined;
  onChange: (selected: string[]) => void;
  id?: string;
}

const TurboMultiSelect = React.memo<TurboMultiSelectProps>(({
  label,
  placeholder,
  options,
  value,
  onChange,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse currently selected values
  const selectedValues: string[] = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(v => v && v !== 'all' && v !== 'Hamısı');
    if (typeof value === 'string' && value !== 'all' && value !== 'Hamısı') {
      return value.split(',').map(s => s.trim()).filter(s => s && s !== 'all' && s !== 'Hamısı');
    }
    return [];
  }, [value]);

  // Calculate dynamic direction based on space below vs above
  const updateDirection = useCallback(() => {
    if (!containerRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setOpenUpward(false);
      return;
    }
    const shouldOpenUp = calculateDropdownDirection(containerRef.current, 280);
    setOpenUpward(shouldOpenUp);
  }, []);

  // Update direction on open and on scroll
  useEffect(() => {
    if (!isOpen) return;
    updateDirection();
    const scrollContainer = containerRef.current?.closest('.overflow-y-auto');
    if (scrollContainer) {
      const handleScroll = () => {
        updateDirection();
      };
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [isOpen, updateDirection]);

  // Handle outside click to close popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (val: string) => {
    if (val === 'all') {
      onChange([]);
      return;
    }
    if (selectedValues.includes(val)) {
      const next = selectedValues.filter(v => v !== val);
      onChange(next);
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleResetAndClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Label display logic
  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return { text: placeholder, isPlaceholder: true };
    }
    if (selectedValues.length === 1) {
      const opt = options.find(o => o.value === selectedValues[0]);
      return { text: opt ? opt.label : selectedValues[0], isPlaceholder: false };
    }
    if (selectedValues.length === 2) {
      return { text: selectedValues.join(', '), isPlaceholder: false };
    }
    return { text: `${selectedValues.slice(0, 2).join(', ')} (+${selectedValues.length - 2})`, isPlaceholder: false };
  };

  const display = getDisplayText();

  return (
    <div className={`relative w-full ${isOpen ? 'z-30' : ''}`} ref={containerRef} id={id}>
      <label className="block text-xs font-black text-slate-500 tracking-wider mb-1.5 select-none">
        {label}
      </label>

      {/* Trigger Button - Roomy layout with wrapping support to prevent clipping */}
      <div
        onClick={() => {
          if (!isOpen) {
            updateDirection();
          }
          setIsOpen(!isOpen);
        }}
        className={`w-full min-h-12 py-2 bg-white hover:bg-slate-50/90 border rounded-xl px-2.5 sm:px-3 flex items-center justify-between gap-1.5 transition-all cursor-pointer select-none shadow-2xs ${
          isOpen
            ? 'border-[#1D4ED8] ring-2 ring-blue-500/20 bg-white'
            : selectedValues.length > 0
            ? 'border-slate-300 bg-white'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
          <span
            className={`text-xs sm:text-sm leading-snug break-words line-clamp-2 ${
              display.isPlaceholder
                ? 'text-slate-400 font-normal'
                : 'text-[#0F172A] font-bold'
            }`}
          >
            {display.text}
          </span>
          {selectedValues.length > 1 && (
            <span className="shrink-0 bg-blue-100 text-[#1D4ED8] text-[10px] font-black px-1.5 py-0.5 rounded-md self-center">
              {selectedValues.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0"
              title="Təmizlə"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#1D4ED8]' : ''
            }`}
          />
        </div>
      </div>

      {/* Popover Menu - Smart Direction (Up/Down) & Smooth Origin Animation */}
      {isOpen && (
        <div
          className={`absolute z-50 left-0 right-0 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 ease-out flex flex-col transition-all ${
            openUpward
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          }`}
        >
          
          {/* Top Bar with ONLY red "✕ Sıfırla" button on the LEFT */}
          <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-start">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer select-none"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Sıfırla</span>
            </button>
          </div>

          {/* Options list with custom checkboxes (Compact & Scrollable max-h-[280px]) */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-[260px] sm:max-h-[280px] overscroll-contain">
            {options.map((opt) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleToggle(opt.value)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm ${
                    isChecked
                      ? 'bg-blue-50/80 text-[#1D4ED8] font-bold'
                      : 'text-slate-700 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  <div
                    className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border transition-colors shrink-0 ml-2 ${
                      isChecked
                        ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Confirmation button */}
          <div className="p-2 border-t border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-black rounded-lg transition-colors cursor-pointer"
            >
              Təsdiqlə
            </button>
          </div>

        </div>
      )}
    </div>
  );
});

// ----------------------------------------------------------------------
// 2. TURBO.AZ CUSTOM YEAR SELECT POPOVER COMPONENT
// ----------------------------------------------------------------------
interface TurboYearSelectProps {
  placeholder: string;
  value: string | number | undefined;
  years: string[];
  onChange: (val: string | number) => void;
  id?: string;
}

const TurboYearSelect = React.memo<TurboYearSelectProps>(({
  placeholder,
  value,
  years,
  onChange,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasValue = Boolean(value && value !== 'all' && value !== '');

  // Calculate dynamic direction based on space below vs above
  const updateDirection = useCallback(() => {
    if (!containerRef.current) return;
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setOpenUpward(false);
      return;
    }
    const shouldOpenUp = calculateDropdownDirection(containerRef.current, 280);
    setOpenUpward(shouldOpenUp);
  }, []);

  // Update direction on open and on scroll
  useEffect(() => {
    if (!isOpen) return;
    updateDirection();
    const scrollContainer = containerRef.current?.closest('.overflow-y-auto');
    if (scrollContainer) {
      const handleScroll = () => {
        updateDirection();
      };
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [isOpen, updateDirection]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectYear = (y: string) => {
    onChange(y === 'all' ? 'all' : Number(y));
    setIsOpen(false);
  };

  const handleResetAndClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('all');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('all');
  };

  return (
    <div className={`relative w-full ${isOpen ? 'z-30' : ''}`} ref={containerRef} id={id}>
      <div
        onClick={() => {
          if (!isOpen) {
            updateDirection();
          }
          setIsOpen(!isOpen);
        }}
        className={`w-full min-h-12 py-2 bg-white hover:bg-slate-50/90 border rounded-xl px-2.5 sm:px-3 flex items-center justify-between gap-1 transition-all cursor-pointer select-none shadow-2xs ${
          isOpen
            ? 'border-[#1D4ED8] ring-2 ring-blue-500/20 bg-white'
            : hasValue
            ? 'border-slate-300 bg-white'
            : 'border-slate-200'
        }`}
      >
        <span
          className={`text-xs sm:text-sm leading-snug break-words ${
            hasValue ? 'text-[#0F172A] font-bold' : 'text-slate-400 font-normal'
          }`}
        >
          {hasValue ? String(value) : placeholder}
        </span>

        <div className="flex items-center gap-0.5 shrink-0 ml-auto">
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0"
              title="Təmizlə"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#1D4ED8]' : ''
            }`}
          />
        </div>
      </div>

      {/* Custom Year Popover - Opens upward or downward dynamically based on actual available space */}
      {isOpen && (
        <div
          className={`absolute z-50 left-0 right-0 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200 ease-out flex flex-col transition-all ${
            openUpward
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          }`}
        >
          
          {/* Top Bar with ONLY red "✕ Sıfırla" button on the LEFT */}
          <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-start">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer select-none"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Sıfırla</span>
            </button>
          </div>

          {/* Year Vertical Scroll List (max-h-[220px] sm:max-h-[240px]) */}
          <div className="p-1 max-h-[220px] sm:max-h-[240px] overflow-y-auto overscroll-contain space-y-0.5">
            {years.map((y) => {
              const isSelected = String(value) === String(y);
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleSelectYear(y)}
                  className={`w-full py-2.5 px-3 text-xs font-bold rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1D4ED8] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <span>{y}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                </button>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
});

// ----------------------------------------------------------------------
// 3. SHARED FILTER FIELDS CONTENT COMPONENT
// ----------------------------------------------------------------------
interface FilterFieldsContentProps {
  localFilters: FilterState;
  onLocalChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
}

const FilterFieldsContent: React.FC<FilterFieldsContentProps> = ({
  localFilters,
  onLocalChange
}) => {
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Grid 1: Marka və Ban növü (Multi-Select Popovers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        {/* 1. Marka (Brand) */}
        <TurboMultiSelect
          label="Marka"
          placeholder="Bütün markalar"
          options={BRAND_OPTIONS}
          value={localFilters.brand}
          onChange={(selected) => onLocalChange('brand', selected)}
        />

        {/* 2. Ban növü (Body Type) */}
        <TurboMultiSelect
          label="Ban növü"
          placeholder="Bütün ban növləri"
          options={BODY_TYPE_OPTIONS}
          value={localFilters.bodyType}
          onChange={(selected) => onLocalChange('bodyType', selected)}
        />
      </div>

      {/* Grid 2: Baza ölçüsü və Yanacaq növü */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        {/* 3. Baza ölçüsü (Base Length) */}
        <TurboMultiSelect
          label="Baza ölçüsü"
          placeholder="Bütün baza ölçüləri"
          options={BASE_LENGTH_OPTIONS}
          value={localFilters.baseLength}
          onChange={(selected) => onLocalChange('baseLength', selected)}
        />

        {/* 4. Yanacaq növü (Fuel Type) */}
        <TurboMultiSelect
          label="Yanacaq növü"
          placeholder="Bütün yanacaq növləri"
          options={FUEL_TYPE_OPTIONS}
          value={localFilters.fuelType}
          onChange={(selected) => onLocalChange('fuelType', selected)}
        />
      </div>

      {/* Grid 3: Sürətlər qutusu və İstehsal ili */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        {/* 5. Sürətlər qutusu (Transmission) */}
        <TurboMultiSelect
          label="Sürətlər qutusu"
          placeholder="Bütün sürətlər qutuları"
          options={TRANSMISSION_OPTIONS}
          value={localFilters.transmission}
          onChange={(selected) => onLocalChange('transmission', selected)}
        />

        {/* 6. İstehsal ili (Min və Max - Custom Grid Popovers) */}
        <div>
          <label className="block text-xs font-black text-slate-500 tracking-wider mb-1.5 select-none">
            İstehsal ili
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <TurboYearSelect
              placeholder="il, min."
              value={localFilters.minYear}
              years={YEARS_LIST}
              onChange={(val) => onLocalChange('minYear', val)}
            />

            <TurboYearSelect
              placeholder="il, maks."
              value={localFilters.maxYear}
              years={YEARS_LIST}
              onChange={(val) => onLocalChange('maxYear', val)}
            />
          </div>
        </div>
      </div>

      {/* Grid 4: Yürüş və Qiymət */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        {/* 7. Yürüş, km */}
        <div>
          <label className="block text-xs font-black text-slate-500 tracking-wider mb-1.5 select-none">
            Yürüş, km
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                step={5000}
                placeholder="min."
                value={localFilters.minMileage > 0 ? localFilters.minMileage : ''}
                onChange={(e) => onLocalChange('minMileage', e.target.value ? Number(e.target.value) : 0)}
                className="w-full h-12 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 focus:border-[#1D4ED8] focus:bg-white text-[#0F172A] text-xs sm:text-sm font-bold rounded-xl px-2.5 sm:px-3 pr-7 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
              />
              {localFilters.minMileage > 0 && (
                <button
                  type="button"
                  onClick={() => onLocalChange('minMileage', 0)}
                  className="absolute right-1.5 p-0.5 text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                  title="Təmizlə"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                step={5000}
                placeholder="maks."
                value={localFilters.maxMileage > 0 ? localFilters.maxMileage : ''}
                onChange={(e) => onLocalChange('maxMileage', e.target.value ? Number(e.target.value) : 0)}
                className="w-full h-12 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 focus:border-[#1D4ED8] focus:bg-white text-[#0F172A] text-xs sm:text-sm font-bold rounded-xl px-2.5 sm:px-3 pr-7 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
              />
              {localFilters.maxMileage > 0 && (
                <button
                  type="button"
                  onClick={() => onLocalChange('maxMileage', 0)}
                  className="absolute right-1.5 p-0.5 text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                  title="Təmizlə"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 8. QİYMƏT, AZN */}
        <div>
          <label className="block text-xs font-black text-slate-500 tracking-wider mb-1.5 select-none">
            Qiymət, AZN
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                step={500}
                placeholder="min."
                value={localFilters.minPrice > 0 ? localFilters.minPrice : ''}
                onChange={(e) => onLocalChange('minPrice', e.target.value ? Number(e.target.value) : 0)}
                className="w-full h-12 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 focus:border-[#1D4ED8] focus:bg-white text-[#0F172A] text-xs sm:text-sm font-bold rounded-xl px-2.5 sm:px-3 pr-7 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
              />
              {localFilters.minPrice > 0 && (
                <button
                  type="button"
                  onClick={() => onLocalChange('minPrice', 0)}
                  className="absolute right-1.5 p-0.5 text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                  title="Təmizlə"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                step={500}
                placeholder="maks."
                value={localFilters.maxPrice > 0 ? localFilters.maxPrice : ''}
                onChange={(e) => onLocalChange('maxPrice', e.target.value ? Number(e.target.value) : 0)}
                className="w-full h-12 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 focus:border-[#1D4ED8] focus:bg-white text-[#0F172A] text-xs sm:text-sm font-bold rounded-xl px-2.5 sm:px-3 pr-7 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
              />
              {localFilters.maxPrice > 0 && (
                <button
                  type="button"
                  onClick={() => onLocalChange('maxPrice', 0)}
                  className="absolute right-1.5 p-0.5 text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                  title="Təmizlə"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// 4. DESKTOP TURBO.AZ STYLE PERMANENT FILTER PANEL (md: and above)
// ----------------------------------------------------------------------
interface DesktopFilterPanelProps {
  localFilters: FilterState;
  onLocalChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onApply: () => void;
  onReset: () => void;
  previewCount: number;
  sortBy: FilterState['sortBy'];
  onSortChange: (newSort: FilterState['sortBy']) => void;
}

const DesktopFilterPanel: React.FC<DesktopFilterPanelProps> = React.memo(({
  localFilters,
  onLocalChange,
  onApply,
  onReset,
  previewCount,
  sortBy,
  onSortChange
}) => {
  return (
    <div className="hidden md:block bg-[#EEF1F6] rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-200/80 shadow-xs">
      {/* 4-Column Compact Grid:
          Row 1: Marka | Ban növü | Baza ölçüsü | Yanacaq növü
          Row 2: Sürətlər qutusu | İl min + İl maks | Yürüş min + maks (km) | Qiymət min + maks (AZN)
      */}
      <div className="grid grid-cols-4 gap-3.5 lg:gap-4">
        {/* Row 1, Col 1: Marka */}
        <TurboMultiSelect
          label="Marka"
          placeholder="Bütün markalar"
          options={BRAND_OPTIONS}
          value={localFilters.brand}
          onChange={(selected) => onLocalChange('brand', selected)}
        />

        {/* Row 1, Col 2: Ban növü */}
        <TurboMultiSelect
          label="Ban növü"
          placeholder="Bütün ban növləri"
          options={BODY_TYPE_OPTIONS}
          value={localFilters.bodyType}
          onChange={(selected) => onLocalChange('bodyType', selected)}
        />

        {/* Row 1, Col 3: Baza ölçüsü */}
        <TurboMultiSelect
          label="Baza ölçüsü"
          placeholder="Bütün baza ölçüləri"
          options={BASE_LENGTH_OPTIONS}
          value={localFilters.baseLength}
          onChange={(selected) => onLocalChange('baseLength', selected)}
        />

        {/* Row 1, Col 4: Yanacaq növü */}
        <TurboMultiSelect
          label="Yanacaq növü"
          placeholder="Bütün yanacaq növləri"
          options={FUEL_TYPE_OPTIONS}
          value={localFilters.fuelType}
          onChange={(selected) => onLocalChange('fuelType', selected)}
        />

        {/* Row 2, Col 1: Sürətlər qutusu */}
        <TurboMultiSelect
          label="Sürətlər qutusu"
          placeholder="Bütün sürətlər qutuları"
          options={TRANSMISSION_OPTIONS}
          value={localFilters.transmission}
          onChange={(selected) => onLocalChange('transmission', selected)}
        />

        {/* Row 2, Col 2: İl min + İl maks */}
        <div>
          <label className="block text-xs font-black text-slate-500 tracking-wider mb-1.5 select-none">
            İstehsal ili
          </label>
          <div className="grid grid-cols-2 gap-2">
            <TurboYearSelect
              placeholder="il, min."
              value={localFilters.minYear}
              years={YEARS_LIST}
              onChange={(val) => onLocalChange('minYear', val)}
            />
            <TurboYearSelect
              placeholder="il, maks."
              value={localFilters.maxYear}
              years={YEARS_LIST}
              onChange={(val) => onLocalChange('maxYear', val)}
            />
          </div>
        </div>

        {/* Row 2, Col 3: Yürüş min + maks (km) */}
        <div>
          <label className="block text-xs font-black text-slate-500 tracking-wider mb-1.5 select-none">
            Yürüş, km
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                step={5000}
                placeholder="min."
                value={localFilters.minMileage > 0 ? localFilters.minMileage : ''}
                onChange={(e) => onLocalChange('minMileage', e.target.value ? Number(e.target.value) : 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onApply();
                  }
                }}
                className="w-full h-12 bg-white hover:bg-slate-50/90 border border-slate-200 focus:border-[#1D4ED8] focus:bg-white text-[#0F172A] text-xs sm:text-sm font-bold rounded-xl px-2.5 sm:px-3 pr-7 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
              />
              {localFilters.minMileage > 0 && (
                <button
                  type="button"
                  onClick={() => onLocalChange('minMileage', 0)}
                  className="absolute right-1.5 p-0.5 text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                  title="Təmizlə"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                step={5000}
                placeholder="maks."
                value={localFilters.maxMileage > 0 ? localFilters.maxMileage : ''}
                onChange={(e) => onLocalChange('maxMileage', e.target.value ? Number(e.target.value) : 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onApply();
                  }
                }}
                className="w-full h-12 bg-white hover:bg-slate-50/90 border border-slate-200 focus:border-[#1D4ED8] focus:bg-white text-[#0F172A] text-xs sm:text-sm font-bold rounded-xl px-2.5 sm:px-3 pr-7 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
              />
              {localFilters.maxMileage > 0 && (
                <button
                  type="button"
                  onClick={() => onLocalChange('maxMileage', 0)}
                  className="absolute right-1.5 p-0.5 text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                  title="Təmizlə"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2, Col 4: Qiymət min + maks (AZN) */}
        <div>
          <label className="block text-xs font-black text-slate-500 tracking-wider mb-1.5 select-none">
            Qiymət, AZN
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                step={500}
                placeholder="min."
                value={localFilters.minPrice > 0 ? localFilters.minPrice : ''}
                onChange={(e) => onLocalChange('minPrice', e.target.value ? Number(e.target.value) : 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onApply();
                  }
                }}
                className="w-full h-12 bg-white hover:bg-slate-50/90 border border-slate-200 focus:border-[#1D4ED8] focus:bg-white text-[#0F172A] text-xs sm:text-sm font-bold rounded-xl px-2.5 sm:px-3 pr-7 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
              />
              {localFilters.minPrice > 0 && (
                <button
                  type="button"
                  onClick={() => onLocalChange('minPrice', 0)}
                  className="absolute right-1.5 p-0.5 text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                  title="Təmizlə"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                step={500}
                placeholder="maks."
                value={localFilters.maxPrice > 0 ? localFilters.maxPrice : ''}
                onChange={(e) => onLocalChange('maxPrice', e.target.value ? Number(e.target.value) : 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onApply();
                  }
                }}
                className="w-full h-12 bg-white hover:bg-slate-50/90 border border-slate-200 focus:border-[#1D4ED8] focus:bg-white text-[#0F172A] text-xs sm:text-sm font-bold rounded-xl px-2.5 sm:px-3 pr-7 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal shadow-2xs"
              />
              {localFilters.maxPrice > 0 && (
                <button
                  type="button"
                  onClick={() => onLocalChange('maxPrice', 0)}
                  className="absolute right-1.5 p-0.5 text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                  title="Təmizlə"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-300/70">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="text-xs sm:text-sm font-bold text-slate-500 hover:text-red-600 active:text-red-700 hover:bg-slate-200/60 px-3 py-2 rounded-xl transition-colors cursor-pointer select-none flex items-center gap-1.5"
            title="Bütün filtrləri sıfırla"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
            <span>Sıfırla</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Desktop Sort Selector */}
          <div className="relative flex items-center">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as FilterState['sortBy'])}
              className="bg-white border border-slate-200 hover:border-slate-300 text-[#0F172A] text-xs sm:text-sm rounded-xl py-2.5 sm:py-3 pl-3.5 pr-8 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1D4ED8] cursor-pointer appearance-none shadow-2xs transition-colors"
            >
              <option value="featured">Seçilmişlər öndə</option>
              <option value="price-asc">Qiymət: ucuzdan bahaya</option>
              <option value="price-desc">Qiymət: bahadan ucuza</option>
              <option value="year-desc">Buraxılış ili: ən yeni</option>
              <option value="mileage-asc">Yürüş: ən az</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>

          {/* Primary "Elanları göstər (N)" button */}
          <button
            type="button"
            onClick={onApply}
            className="py-2.5 sm:py-3 px-6 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] active:bg-[#1e3a8a] text-white font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Elanları göstər ({previewCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
});

// ----------------------------------------------------------------------
// 5. MAIN FILTER BAR COMPONENT
// ----------------------------------------------------------------------
export const FilterBar: React.FC<FilterBarProps> = ({
  cars = [],
  filters,
  onFilterChange,
  onResetFilters,
  totalResultsCount,
  isModalOpen,
  setIsModalOpen
}) => {
  // Local state for modal to allow fast editing and live preview count
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  // Sync local filters when prop filters change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Compute live preview count inside the modal/dropdown without affecting the catalog grid
  const previewCount = useMemo(() => {
    if (!cars || cars.length === 0) return 0;
    return countFilteredTransits(cars, localFilters);
  }, [cars, localFilters]);

  // Lock body scroll ONLY on mobile (< 768px) when modal is open
  useEffect(() => {
    if (isModalOpen && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // Keyboard accessibility: Escape key closes the mobile filter modal
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, setIsModalOpen]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => [
    parseMulti(filters.brand).length > 0,
    Boolean(filters.minYear && filters.minYear !== 'all' && filters.minYear !== ''),
    Boolean(filters.maxYear && filters.maxYear !== 'all' && filters.maxYear !== ''),
    parseMulti(filters.bodyType).length > 0,
    parseMulti(filters.baseLength).length > 0,
    parseMulti(filters.fuelType).length > 0,
    parseMulti(filters.transmission).length > 0,
    Boolean(filters.minMileage && filters.minMileage > 0),
    Boolean(filters.maxMileage && filters.maxMileage > 0),
    Boolean(filters.minPrice && filters.minPrice > 0),
    Boolean(filters.maxPrice && filters.maxPrice > 0)
  ].filter(Boolean).length, [filters]);

  const isFiltered = activeFilterCount > 0;

  const handleOpenModal = useCallback(() => {
    setLocalFilters(filters);
    setIsModalOpen(true);
  }, [filters, setIsModalOpen]);

  const handleToggleModal = useCallback(() => {
    if (isModalOpen) {
      setIsModalOpen(false);
    } else {
      setLocalFilters(filters);
      setIsModalOpen(true);
    }
  }, [isModalOpen, filters, setIsModalOpen]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, [setIsModalOpen]);

  const handleLocalChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const updated = {
      ...localFilters,
      [key]: value
    };
    setLocalFilters(updated);
    // Note: onFilterChange is intentionally NOT called here to prevent premature catalog re-renders before clicking Apply
  };

  const handleReset = useCallback(() => {
    const emptyFilters: FilterState = {
      brand: [],
      minYear: 'all',
      maxYear: 'all',
      year: 'all',
      bodyType: [],
      baseLength: [],
      fuelType: [],
      transmission: [],
      minPrice: 0,
      maxPrice: 0,
      minMileage: 0,
      maxMileage: 0,
      searchQuery: '',
      sortBy: 'featured'
    };
    setLocalFilters(emptyFilters);
  }, []);

  const handleResetAllAndApply = useCallback(() => {
    const emptyFilters: FilterState = {
      brand: [],
      minYear: 'all',
      maxYear: 'all',
      year: 'all',
      bodyType: [],
      baseLength: [],
      fuelType: [],
      transmission: [],
      minPrice: 0,
      maxPrice: 0,
      minMileage: 0,
      maxMileage: 0,
      searchQuery: '',
      sortBy: 'featured'
    };
    setLocalFilters(emptyFilters);
    onFilterChange(emptyFilters);
    onResetFilters();
  }, [onFilterChange, onResetFilters]);

  const handleApply = useCallback(() => {
    onFilterChange(localFilters);
    setIsModalOpen(false);
    requestAnimationFrame(() => {
      const catalogElem = document.getElementById('movcud-avtomobiller');
      if (catalogElem) {
        const headerElem = document.getElementById('main-header') || document.querySelector('header');
        const measuredHeaderHeight = headerElem ? headerElem.getBoundingClientRect().height : (window.innerWidth < 640 ? 70 : 80);
        const extraOffset = window.innerWidth < 640 ? 12 : 16;
        const totalOffset = measuredHeaderHeight + extraOffset;
        const elementPosition = catalogElem.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - totalOffset;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });
      }
    });
  }, [localFilters, onFilterChange, setIsModalOpen]);

  const formatList = (val: string | string[] | undefined) => {
    const arr = parseMulti(val);
    return arr.join(', ');
  };

  return (
    <div id="katalog-filter" className={`w-full relative ${isModalOpen ? 'z-50' : 'z-10'}`}>
      
      {/* ========================================================
          1. MOBILE TRIGGER BAR (Only "Filtrlər" button & Sort, md:hidden)
         ======================================================== */}
      <div className="flex md:hidden items-center justify-between gap-3">
        {/* Mobile Filtrlər Button */}
        <button
          type="button"
          onClick={handleToggleModal}
          aria-expanded={isModalOpen}
          aria-haspopup="dialog"
          className={`flex items-center justify-center gap-2 sm:gap-2.5 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer select-none ${
            isFiltered
              ? 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF] ring-2 ring-blue-500/30'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
          title="Filtrlər"
        >
          <SlidersHorizontal className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          <span>Filtrlər</span>
          {activeFilterCount > 0 && (
            <span className="bg-white text-[#1D4ED8] text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Mobile Sort dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center">
            <select
              value={filters.sortBy}
              onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value as FilterState['sortBy'] })}
              className="bg-white border border-slate-200 hover:border-slate-300 text-[#0F172A] text-xs sm:text-sm rounded-xl py-2.5 sm:py-3 pl-3.5 pr-8 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1D4ED8] cursor-pointer appearance-none shadow-2xs transition-colors"
            >
              <option value="featured">Seçilmişlər öndə</option>
              <option value="price-asc">Qiymət: ucuzdan bahaya</option>
              <option value="price-desc">Qiymət: bahadan ucuza</option>
              <option value="year-desc">Buraxılış ili: ən yeni</option>
              <option value="mileage-asc">Yürüş: ən az</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ========================================================
          2. DESKTOP PERMANENT TURBO.AZ STYLE FILTER PANEL (md: and above)
         ======================================================== */}
      <DesktopFilterPanel
        localFilters={localFilters}
        onLocalChange={handleLocalChange}
        onApply={handleApply}
        onReset={handleReset}
        previewCount={previewCount}
        sortBy={filters.sortBy}
        onSortChange={(newSort) => onFilterChange({ ...filters, sortBy: newSort })}
      />

      {/* Active Filter Chips */}
      {isFiltered && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 px-1">
          <span className="text-[11px] font-bold text-slate-400">Aktiv:</span>

          {parseMulti(filters.brand).length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Marka: {formatList(filters.brand)}
              <button onClick={() => onFilterChange({ ...filters, brand: [] })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}
          
          {Boolean(filters.minYear && filters.minYear !== 'all') && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              İl min: {filters.minYear}
              <button onClick={() => onFilterChange({ ...filters, minYear: 'all' })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {Boolean(filters.maxYear && filters.maxYear !== 'all') && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              İl maks: {filters.maxYear}
              <button onClick={() => onFilterChange({ ...filters, maxYear: 'all' })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {parseMulti(filters.bodyType).length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Ban: {formatList(filters.bodyType)}
              <button onClick={() => onFilterChange({ ...filters, bodyType: [] })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {parseMulti(filters.baseLength).length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Baza: {formatList(filters.baseLength)}
              <button onClick={() => onFilterChange({ ...filters, baseLength: [] })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {parseMulti(filters.fuelType).length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Yanacaq: {formatList(filters.fuelType)}
              <button onClick={() => onFilterChange({ ...filters, fuelType: [] })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {parseMulti(filters.transmission).length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Sürətlər qutusu: {formatList(filters.transmission)}
              <button onClick={() => onFilterChange({ ...filters, transmission: [] })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {Boolean(filters.minMileage && filters.minMileage > 0) && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Yürüş &gt;= {filters.minMileage.toLocaleString()} km
              <button onClick={() => onFilterChange({ ...filters, minMileage: 0 })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {Boolean(filters.maxMileage && filters.maxMileage > 0) && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Yürüş &lt;= {filters.maxMileage.toLocaleString()} km
              <button onClick={() => onFilterChange({ ...filters, maxMileage: 0 })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {Boolean(filters.minPrice && filters.minPrice > 0) && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Qiymət &gt;= {filters.minPrice.toLocaleString()} ₼
              <button onClick={() => onFilterChange({ ...filters, minPrice: 0 })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          {Boolean(filters.maxPrice && filters.maxPrice > 0) && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg">
              Qiymət &lt;= {filters.maxPrice.toLocaleString()} ₼
              <button onClick={() => onFilterChange({ ...filters, maxPrice: 0 })} className="hover:text-red-500 font-bold ml-0.5 cursor-pointer">×</button>
            </span>
          )}

          <button
            onClick={handleResetAllAndApply}
            className="text-[11px] font-bold text-red-600 hover:underline ml-1 cursor-pointer"
          >
            Hamısını sıfırla
          </button>
        </div>
      )}

      {/* ========================================================
          2. FULL-SCREEN TURBO.AZ STYLE FILTER VIEW (Mobile only: below md)
         ======================================================== */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex flex-col bg-white text-slate-900 animate-in fade-in duration-150 md:hidden">
          
          {/* ----------------------------------------------------
              HEADER HİSSƏSİ (Turbo.az Style 3-Column Layout):
              1. Yuxarı Sol: Geri düyməsi (< ikonu)
              2. Yuxarı Mərkəz: "Filtrlər"
              3. Yuxarı Sağ: "Sıfırla"
             ---------------------------------------------------- */}
          <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.05)] shrink-0">
            
            {/* Yuxarı Sol: Geri düyməsi */}
            <div className="w-20 flex justify-start items-center">
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-10 h-10 -ml-1 text-slate-800 hover:text-black hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                title="Geri"
                aria-label="Pəncərəni bağla"
              >
                <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
              </button>
            </div>

            {/* Yuxarı Mərkəz: "Filtrlər" */}
            <h1 className="flex-1 text-center text-base sm:text-lg font-black text-[#0F172A] tracking-tight select-none">
              Filtrlər
            </h1>

            {/* Yuxarı Sağ: "Sıfırla" düyməsi */}
            <div className="w-20 flex justify-end items-center">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs sm:text-sm font-extrabold text-[#1D4ED8] hover:text-[#1E40AF] active:text-[#1e3a8a] hover:bg-blue-50/80 active:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                title="Bütün filtrləri sıfırla"
              >
                Sıfırla
              </button>
            </div>
          </div>

          {/* ----------------------------------------------------
              SCROLLABLE FILTER SECTIONS WITH TURBO.AZ CUSTOM POPOVERS
             ---------------------------------------------------- */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-w-3xl mx-auto w-full overscroll-contain">
            <FilterFieldsContent
              localFilters={localFilters}
              onLocalChange={handleLocalChange}
            />
          </div>

          {/* ----------------------------------------------------
              STICKY BOTTOM ACTION: "Axtar (X elan)"
             ---------------------------------------------------- */}
          <div className="sticky bottom-0 z-30 bg-white border-t border-slate-200 p-4 shadow-lg">
            <div className="max-w-3xl mx-auto w-full">
              <button
                type="button"
                onClick={handleApply}
                className="w-full py-4 px-6 rounded-2xl bg-[#1D4ED8] hover:bg-[#1E40AF] active:bg-[#1e3a8a] text-white font-black text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Axtar ({previewCount} elan)</span>
              </button>
            </div>
          </div>

        </div>,
        document.body
      )}

    </div>
  );
};

