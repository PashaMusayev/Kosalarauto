import { TransitCar, FilterState } from '../types';

export const parseMultiFilter = (val: string | string[] | undefined): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v && v !== 'all' && v !== 'Hamısı');
  if (typeof val === 'string' && val !== 'all' && val !== 'Hamısı') {
    return val.split(',').map(s => s.trim()).filter(s => s && s !== 'all' && s !== 'Hamısı');
  }
  return [];
};

/**
 * Extracts a numeric value from a base length string.
 * Examples:
 *  "4 m" -> 4.0
 *  "4.0 m" -> 4.0
 *  "4" -> 4.0
 *  "2.4 m" -> 2.4
 *  "3.30 m" -> 3.3
 *  "3.30" -> 3.3
 * Returns null if no valid number can be parsed.
 */
export const parseNumericBaseLength = (val: string | undefined | null): number | null => {
  if (!val) return null;
  const match = String(val).match(/(\d+(?:\.\d+)?)/);
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    if (!isNaN(num)) return num;
  }
  return null;
};

/**
 * Checks if a car matches the selected base length filters.
 * Primary method: exact numeric comparison with small tolerance (0.01) to prevent
 * substring bugs (e.g. "4 m" incorrectly matching "2.4 m").
 * Fallback: whole string match if numeric parsing is not applicable.
 */
export const matchBaseLength = (
  carBaseLength: string | undefined | null,
  carTitle: string | undefined | null,
  selectedBaseLengths: string[]
): boolean => {
  if (!selectedBaseLengths || selectedBaseLengths.length === 0) return true;

  const carNum = parseNumericBaseLength(carBaseLength);
  const titleNum = parseNumericBaseLength(carTitle);
  const effectiveCarNum = carNum !== null ? carNum : titleNum;

  const carBaseClean = (carBaseLength || '').toLowerCase().trim();
  const carTitleClean = (carTitle || '').toLowerCase().trim();

  return selectedBaseLengths.some(bl => {
    const targetNum = parseNumericBaseLength(bl);
    
    // 1. Primary path: Exact numeric comparison with floating point tolerance
    if (targetNum !== null && effectiveCarNum !== null) {
      if (Math.abs(effectiveCarNum - targetNum) < 0.01) {
        return true;
      }
      // If both could be parsed as numbers and they didn't match numerically,
      // do NOT fall back to naive substring matching!
      return false;
    }

    // 2. Fallback path for non-numeric labels (e.g., descriptive labels)
    const targetBase = bl.toLowerCase().trim();
    if (carBaseClean && (carBaseClean === targetBase || carBaseClean.includes(targetBase))) {
      return true;
    }
    if (carTitleClean && carTitleClean.includes(targetBase)) {
      return true;
    }

    return false;
  });
};

/**
 * Pure filter function that tests if a single car satisfies the given FilterState.
 * Only applies to active cars (ignores 'sold' status cars).
 */
export const matchesFilter = (car: TransitCar, filters: FilterState): boolean => {
  // 1. Status filter: hide sold cars from public catalog
  if (car.status === 'sold') {
    return false;
  }

  const selectedBrands = parseMultiFilter(filters.brand);
  const minYearNum = filters.minYear && filters.minYear !== 'all' && Number(filters.minYear) > 0 ? Number(filters.minYear) : 0;
  const maxYearNum = filters.maxYear && filters.maxYear !== 'all' && Number(filters.maxYear) > 0 ? Number(filters.maxYear) : 0;
  const exactYear = filters.year && filters.year !== 'all' ? String(filters.year).trim() : null;
  const selectedBodyTypes = parseMultiFilter(filters.bodyType);
  const selectedBaseLengths = parseMultiFilter(filters.baseLength);
  const selectedFuelTypes = parseMultiFilter(filters.fuelType);
  const selectedTransmissions = parseMultiFilter(filters.transmission);
  const hasSearchQuery = Boolean(filters.searchQuery && filters.searchQuery.trim() !== '');
  const q = hasSearchQuery ? filters.searchQuery.toLowerCase().trim() : '';

  // Brand filter (Ford, Mercedes etc.)
  if (selectedBrands.length > 0) {
    const carBrand = (car.brand || car.make || '').toLowerCase().trim();
    const carTitle = (car.title || '').toLowerCase().trim();
    const brandMatch = selectedBrands.some(b => {
      const tb = b.toLowerCase().trim();
      if (tb === 'mercedes' || tb === 'mercedes-benz') {
        return carBrand.includes('mercedes') || carTitle.includes('mercedes');
      }
      return carBrand.includes(tb) || carTitle.includes(tb);
    });
    if (!brandMatch) return false;
  }

  // Min/Max Year filter
  const carYear = Number(car.year) || 0;
  if (minYearNum > 0 && carYear < minYearNum) return false;
  if (maxYearNum > 0 && carYear > maxYearNum) return false;
  if (exactYear) {
    const carYearStr = String(car.year || '').trim();
    if (carYearStr !== exactYear) return false;
  }

  // Body type filter (Multi-select)
  if (selectedBodyTypes.length > 0) {
    const carBody = (car.bodyType || '').toLowerCase().trim();
    const bodyMatch = selectedBodyTypes.some(bt => {
      const targetBody = bt.toLowerCase().trim();
      const simpleTarget = targetBody.split('/')[0].split('(')[0].trim();
      const simpleCar = carBody.split('/')[0].split('(')[0].trim();
      return (
        carBody === targetBody ||
        carBody.includes(targetBody) ||
        targetBody.includes(carBody) ||
        (simpleTarget && (carBody.includes(simpleTarget) || simpleCar.includes(simpleTarget)))
      );
    });
    if (!bodyMatch) return false;
  }

  // Base length filter (Multi-select) with exact numeric comparison
  if (selectedBaseLengths.length > 0) {
    if (!matchBaseLength(car.baseLength, car.title, selectedBaseLengths)) {
      return false;
    }
  }

  // Fuel Type filter (Multi-select)
  if (selectedFuelTypes.length > 0) {
    const carFuel = (car.fuelType || '').toLowerCase().trim();
    const fuelMatch = selectedFuelTypes.some(ft => {
      const targetFuel = ft.toLowerCase().trim();
      return carFuel === targetFuel || carFuel.includes(targetFuel);
    });
    if (!fuelMatch) return false;
  }

  // Transmission filter (Multi-select)
  if (selectedTransmissions.length > 0) {
    const carTrans = (car.transmission || '').toLowerCase().trim();
    const transMatch = selectedTransmissions.some(tr => {
      const targetTrans = tr.toLowerCase().trim();
      return (
        carTrans === targetTrans || 
        carTrans.includes(targetTrans) || 
        (targetTrans === 'mexanika' && carTrans.includes('mexaniki')) ||
        (targetTrans === 'mexaniki' && carTrans.includes('mexanika'))
      );
    });
    if (!transMatch) return false;
  }

  // Mileage range (min & max)
  const numericMileage = Number(car.mileage) || 0;
  if (filters.minMileage > 0 && numericMileage < filters.minMileage) {
    return false;
  }
  if (filters.maxMileage > 0 && numericMileage > filters.maxMileage) {
    return false;
  }

  // Price range (min & max)
  const numericPrice = Number(car.price) || 0;
  if (filters.minPrice > 0 && numericPrice < filters.minPrice) {
    return false;
  }
  if (filters.maxPrice > 0 && numericPrice > filters.maxPrice) {
    return false;
  }

  // Search query (safe null checks on all text fields)
  if (hasSearchQuery) {
    const titleStr = (car.title || '').toLowerCase();
    const brandStr = (car.brand || car.make || '').toLowerCase();
    const modelStr = (car.model || '').toLowerCase();
    const engineStr = (car.engine || '').toLowerCase();
    const idStr = (car.id || '').toLowerCase();
    const baseStr = (car.baseLength || '').toLowerCase();
    const bodyStr = (car.bodyType || '').toLowerCase();
    const colorStr = (car.color || '').toLowerCase();
    const cityStr = (car.city || car.location || '').toLowerCase();

    const matches = 
      titleStr.includes(q) ||
      brandStr.includes(q) ||
      modelStr.includes(q) ||
      engineStr.includes(q) ||
      idStr.includes(q) ||
      baseStr.includes(q) ||
      bodyStr.includes(q) ||
      colorStr.includes(q) ||
      cityStr.includes(q);

    if (!matches) {
      return false;
    }
  }

  return true;
};

/**
 * Filter and sort a list of cars using the specified filters.
 */
export const filterAndSortTransits = (transits: TransitCar[], filters: FilterState): TransitCar[] => {
  return transits
    .filter(car => matchesFilter(car, filters))
    .sort((a, b) => {
      const priceA = Number(a.price) || 0;
      const priceB = Number(b.price) || 0;
      const yearA = Number(a.year) || 0;
      const yearB = Number(b.year) || 0;
      const mileageA = Number(a.mileage) || 0;
      const mileageB = Number(b.mileage) || 0;

      if (filters.sortBy === 'featured') {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return 0;
      }
      if (filters.sortBy === 'price-asc') return priceA - priceB;
      if (filters.sortBy === 'price-desc') return priceB - priceA;
      if (filters.sortBy === 'year-desc') return yearB - yearA;
      if (filters.sortBy === 'mileage-asc') return mileageA - mileageB;
      return 0;
    });
};

/**
 * Fast count of matching cars for a given filter state without sorting.
 */
export const countFilteredTransits = (transits: TransitCar[], filters: FilterState): number => {
  let count = 0;
  for (let i = 0; i < transits.length; i++) {
    if (matchesFilter(transits[i], filters)) {
      count++;
    }
  }
  return count;
};
