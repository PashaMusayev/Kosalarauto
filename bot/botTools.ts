import { SupabaseClient } from '@supabase/supabase-js';

const SITE_URL = (process.env.SITE_URL || 'https://kosalarauto.com').replace(/\/+$/, '');

export interface SearchCarsArgs {
  brand?: string;
  model?: string;
  bodyType?: string;
  minYear?: number;
  maxYear?: number;
  minPrice?: number;
  maxPrice?: number;
  maxMileage?: number;
  minSeats?: number;
  query?: string;
  limit?: number;
}

export type HumanHandoffReason =
  | 'price_negotiation'
  | 'credit_or_leasing'
  | 'trade_in'
  | 'complaint'
  | 'customer_asked_for_human'
  | 'test_drive_or_visit'
  | 'bot_unsure';

export interface CompactCarResult {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  bodyType: string;
  baseLength: string;
  roofHeight: string;
  seatCount?: string;
  engine: string;
  transmission: string;
  fuelType: string;
  condition: string;
  url: string;
}

/**
 * Searches active cars in Supabase based on structured and free-text criteria.
 * Never returns sold cars.
 */
export async function searchCars(
  supabase: SupabaseClient,
  formatCarRow: (row: Record<string, any>) => Record<string, unknown>,
  args: SearchCarsArgs = {}
): Promise<{ cars: CompactCarResult[]; totalMatches: number }> {
  const { data, error } = await supabase
    .from('cars')
    .select('*')
    .eq('status', 'active');

  if (error) {
    throw new Error(`Məlumat bazasından avtomobillər oxunarkən xəta: ${error.message}`);
  }

  const rawRows: Record<string, any>[] = Array.isArray(data) ? data : [];
  const formattedList = rawRows.map(formatCarRow);

  // Apply filters in-memory on normalized car models to ensure full consistency
  const brandFilter = (args.brand || '').trim().toLowerCase();
  const modelFilter = (args.model || '').trim().toLowerCase();
  const bodyTypeFilter = (args.bodyType || '').trim().toLowerCase();
  const queryFilter = (args.query || '').trim().toLowerCase();
  const minYear = typeof args.minYear === 'number' ? args.minYear : undefined;
  const maxYear = typeof args.maxYear === 'number' ? args.maxYear : undefined;
  const minPrice = typeof args.minPrice === 'number' ? args.minPrice : undefined;
  const maxPrice = typeof args.maxPrice === 'number' ? args.maxPrice : undefined;
  const maxMileage = typeof args.maxMileage === 'number' ? args.maxMileage : undefined;
  const minSeats = typeof args.minSeats === 'number' ? args.minSeats : undefined;

  const filtered = formattedList.filter((car) => {
    // Brand check
    if (brandFilter) {
      const b = String(car.brand || '').toLowerCase();
      if (!b.includes(brandFilter)) return false;
    }

    // Model check
    if (modelFilter) {
      const m = String(car.model || '').toLowerCase();
      if (!m.includes(modelFilter)) return false;
    }

    // BodyType check
    if (bodyTypeFilter) {
      const bt = String(car.bodyType || '').toLowerCase();
      if (!bt.includes(bodyTypeFilter)) return false;
    }

    // Year range
    const year = Number(car.year) || 0;
    if (minYear !== undefined && year < minYear) return false;
    if (maxYear !== undefined && year > maxYear) return false;

    // Price range (AZN)
    const price = Number(car.price) || 0;
    if (minPrice !== undefined && price < minPrice) return false;
    if (maxPrice !== undefined && price > maxPrice) return false;

    // Mileage
    const mileage = Number(car.mileage) || 0;
    if (maxMileage !== undefined && mileage > maxMileage) return false;

    // Seats
    if (minSeats !== undefined) {
      const seats = parseInt(String(car.seatCount || '0'), 10) || 0;
      if (seats < minSeats) return false;
    }

    // Free-text query
    if (queryFilter) {
      const title = String(car.title || '').toLowerCase();
      const desc = String(car.description || '').toLowerCase();
      const features = Array.isArray(car.features) ? car.features.join(' ').toLowerCase() : '';
      const combined = `${title} ${desc} ${features}`;
      if (!combined.includes(queryFilter)) return false;
    }

    return true;
  });

  const totalMatches = filtered.length;
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
  const sliced = filtered.slice(0, limit);

  const compact: CompactCarResult[] = sliced.map((c) => {
    const id = String(c.id);
    return {
      id,
      title: String(c.title || ''),
      brand: String(c.brand || ''),
      model: String(c.model || ''),
      year: Number(c.year) || 0,
      price: Number(c.price) || 0,
      mileage: Number(c.mileage) || 0,
      bodyType: String(c.bodyType || ''),
      baseLength: String(c.baseLength || ''),
      roofHeight: String(c.roofHeight || ''),
      seatCount: c.seatCount ? String(c.seatCount) : undefined,
      engine: String(c.engine || ''),
      transmission: String(c.transmission || ''),
      fuelType: String(c.fuelType || ''),
      condition: String(c.condition || ''),
      url: `${SITE_URL}/?car=${encodeURIComponent(id)}`
    };
  });

  return {
    cars: compact,
    totalMatches
  };
}

/**
 * Returns full details for one specific car without heavy images array (primaryImage only).
 * If not found or status is sold, returns { found: false }.
 */
export async function getCarDetails(
  supabase: SupabaseClient,
  formatCarRow: (row: Record<string, any>) => Record<string, unknown>,
  id: string
): Promise<{ found: false } | { found: true; car: Record<string, unknown>; url: string }> {
  if (!id || typeof id !== 'string') {
    return { found: false };
  }

  const cleanId = id.trim();
  const { data, error } = await supabase
    .from('cars')
    .select('*')
    .eq('id', cleanId)
    .single();

  if (error || !data) {
    return { found: false };
  }

  const formatted = formatCarRow(data);
  if (formatted.status === 'sold') {
    return { found: false };
  }

  // Omit the images array to preserve LLM token context, keep primaryImage
  const { images, ...detailsWithoutImages } = formatted;

  return {
    found: true,
    car: detailsWithoutImages,
    url: `${SITE_URL}/?car=${encodeURIComponent(cleanId)}`
  };
}

/**
 * Returns a quick summary of active inventory: counts by brand/model and bodyType, plus price range.
 */
export async function getInventorySummary(
  supabase: SupabaseClient,
  formatCarRow: (row: Record<string, any>) => Record<string, unknown>
): Promise<{
  totalActive: number;
  byBrandModel: Record<string, number>;
  byBodyType: Record<string, number>;
  minPrice: number;
  maxPrice: number;
}> {
  const { data, error } = await supabase
    .from('cars')
    .select('*')
    .eq('status', 'active');

  if (error) {
    throw new Error(`İnventar icmalı oxunarkən xəta: ${error.message}`);
  }

  const rawRows: Record<string, any>[] = Array.isArray(data) ? data : [];
  const formatted = rawRows.map(formatCarRow);

  const byBrandModel: Record<string, number> = {};
  const byBodyType: Record<string, number> = {};
  let minPrice = Infinity;
  let maxPrice = 0;

  for (const car of formatted) {
    const key = `${car.brand || 'Digər'} ${car.model || ''}`.trim();
    byBrandModel[key] = (byBrandModel[key] || 0) + 1;

    const bt = String(car.bodyType || 'Göstərilməyib').trim();
    if (bt) {
      byBodyType[bt] = (byBodyType[bt] || 0) + 1;
    }

    const price = Number(car.price) || 0;
    if (price > 0) {
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    }
  }

  return {
    totalActive: formatted.length,
    byBrandModel,
    byBodyType,
    minPrice: minPrice === Infinity ? 0 : minPrice,
    maxPrice
  };
}

/**
 * Returns all FAQ / Business information rows from bot_faq ordered by sort_order.
 */
export async function getBusinessInfo(
  supabase: SupabaseClient
): Promise<Array<{ id: string; topic: string; answer: string; sort_order: number }>> {
  const { data, error } = await supabase
    .from('bot_faq')
    .select('id, topic, answer, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`FAQ məlumatları oxunarkən xəta: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}
