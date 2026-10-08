/**
 * Public Car Read & Mapping Operations Module
 * Pure client module with NO static Supabase SDK dependencies.
 */
import { TransitCar } from '../types';
import { mapLegacyBadges, sanitizeStatusBadges } from '../data/badges';

function normalizeBrand(brandRaw?: string, title?: string): string {
  const raw = (brandRaw || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'ford') return 'Ford';
  if (lower === 'mercedes' || lower === 'mercedes-benz' || lower === 'mercedes benz') return 'Mercedes';
  if (lower === 'iveco') return 'Iveco';
  if (lower === 'volkswagen' || lower === 'vw') return 'Volkswagen';
  if (lower === 'renault') return 'Renault';
  if (lower === 'peugeot') return 'Peugeot';
  if (lower === 'fiat') return 'Fiat';
  if (lower === 'opel') return 'Opel';
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1);

  if (title) {
    const tLower = title.toLowerCase();
    if (tLower.includes('mercedes')) return 'Mercedes';
    if (tLower.includes('iveco')) return 'Iveco';
    if (tLower.includes('volkswagen') || tLower.includes('crafter')) return 'Volkswagen';
    if (tLower.includes('renault') || tLower.includes('master')) return 'Renault';
    if (tLower.includes('peugeot') || tLower.includes('boxer')) return 'Peugeot';
    if (tLower.includes('fiat') || tLower.includes('ducato')) return 'Fiat';
  }
  return 'Ford';
}

function normalizeModel(modelRaw?: string, title?: string): string {
  const raw = (modelRaw || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'transit') return 'Transit';
  if (lower === 'sprinter') return 'Sprinter';
  if (lower === 'daily') return 'Daily';
  if (lower === 'crafter') return 'Crafter';
  if (lower === 'master') return 'Master';
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1);

  if (title) {
    const tLower = title.toLowerCase();
    if (tLower.includes('sprinter')) return 'Sprinter';
    if (tLower.includes('daily')) return 'Daily';
    if (tLower.includes('crafter')) return 'Crafter';
    if (tLower.includes('master')) return 'Master';
  }
  return 'Transit';
}

/**
 * Maps Supabase DB row to TransitCar interface
 */
export function mapSupabaseRowToCar(row: Record<string, unknown>): TransitCar {
  const rawStatus = String(row.status || '').toLowerCase();
  const validStatus: 'active' | 'sold' = rawStatus === 'sold' ? 'sold' : 'active';
  const specs = (typeof row.specs === 'object' && row.specs !== null) ? (row.specs as Record<string, unknown>) : {};

  const brand = normalizeBrand(String(row.brand || row.make || specs.brand || specs.make || ''), String(row.title || ''));
  const model = normalizeModel(String(row.model || specs.model || ''), String(row.title || ''));
  const city = String(row.city || row.location || specs.city || specs.location || 'Bakı');
  const condition = String(row.condition ?? specs.condition ?? '').trim();

  return {
    id: String(row.id),
    title: String(row.title || `${brand} ${model}`),
    brand: brand,
    make: brand,
    model: model,
    city: city,
    location: city,
    year: Number(row.year || specs.year) || 2011,
    bodyType: String(row.body_type ?? row.bodyType ?? specs.bodyType ?? specs.body_type ?? '').trim(),
    engine: String(row.engine ?? specs.engine ?? '').trim(),
    hp: Number(row.horse_power || row.hp || specs.hp) || 0,
    transmission: String(row.transmission ?? specs.transmission ?? '').trim(),
    mileage: Number(row.mileage || specs.mileage) || 0,
    price: Number(row.price || specs.price) || 0,
    baseLength: String(row.base_length ?? row.baseLength ?? specs.baseLength ?? specs.base_length ?? '').trim(),
    roofHeight: String(row.roof_height ?? row.roofHeight ?? specs.roofHeight ?? specs.roof_height ?? '').trim(),
    seatCount: row.seat_count ? String(row.seat_count).trim() : (row.seatCount ? String(row.seatCount).trim() : (specs.seatCount ? String(specs.seatCount).trim() : (specs.seat_count ? String(specs.seat_count).trim() : undefined))),
    wheelDrive: String(row.drive_type ?? row.wheelDrive ?? row.driveTrain ?? specs.wheelDrive ?? specs.drive_type ?? '').trim(),
    color: String(row.color ?? specs.color ?? '').trim(),
    fuelType: String(row.fuel_type ?? row.fuelType ?? specs.fuelType ?? '').trim(),
    condition: condition,
    statusBadges: mapLegacyBadges(row.badges ?? row.statusBadges),
    badges: mapLegacyBadges(row.badges ?? row.statusBadges),
    images: Array.isArray(row.images) ? (row.images as string[]) : (row.primary_image ? [String(row.primary_image)] : []),
    primaryImage: String(row.primary_image || row.primaryImage || ''),
    description: String(row.description || specs.description || ''),
    features: Array.isArray(row.features) ? (row.features as string[]) : (Array.isArray(specs.features) ? (specs.features as string[]) : []),
    isFeatured: Boolean(row.is_featured ?? row.isFeatured ?? specs.isFeatured),
    status: validStatus,
    specs: specs
  };
}

/**
 * Maps TransitCar to Supabase DB record
 */
export function mapCarToSupabaseRow(car: TransitCar): Record<string, unknown> {
  const brand = car.brand || car.make || (car.title?.toLowerCase().includes('mercedes') ? 'Mercedes' : 'Ford');
  const model = car.model || (car.title?.toLowerCase().includes('sprinter') ? 'Sprinter' : 'Transit');
  const city = car.city || car.location || 'Bakı';
  const condition = String(car.condition ?? '').trim();

  return {
    id: car.id,
    title: car.title,
    brand: brand,
    make: brand,
    model: model,
    city: city,
    location: city,
    year: Number(car.year) || 2011,
    price: Number(car.price) || 0,
    mileage: Number(car.mileage) || 0,
    engine: String(car.engine ?? '').trim(),
    horse_power: Number(car.hp) || 0,
    transmission: String(car.transmission ?? '').trim(),
    drive_type: String(car.wheelDrive ?? '').trim(),
    body_type: String(car.bodyType ?? '').trim(),
    base_length: String(car.baseLength ?? '').trim(),
    roof_height: String(car.roofHeight ?? '').trim(),
    ...(car.seatCount ? { seat_count: String(car.seatCount).trim() } : {}),
    color: String(car.color ?? '').trim(),
    fuel_type: String(car.fuelType ?? '').trim(),
    condition: condition,
    primary_image: car.primaryImage || (car.images && car.images[0]) || '',
    images: car.images || [],
    description: car.description || '',
    features: car.features || [],
    badges: sanitizeStatusBadges(car.statusBadges ?? car.badges),
    is_featured: Boolean(car.isFeatured),
    status: car.status === 'sold' ? 'sold' : 'active',
    specs: {
      brand: brand,
      make: brand,
      model: model,
      city: city,
      location: city,
      condition: condition,
      baseLength: car.baseLength,
      roofHeight: car.roofHeight,
      transmission: car.transmission,
      wheelDrive: car.wheelDrive,
      engine: car.engine,
      hp: car.hp,
      color: car.color,
      fuelType: car.fuelType,
      bodyType: car.bodyType,
      year: car.year,
      mileage: car.mileage,
      price: car.price,
      ...(car.seatCount ? { seatCount: car.seatCount } : {}),
      ...(car.specs || {})
    },
    updated_at: new Date().toISOString()
  };
}

/**
 * Shared helper to fetch all cars from /api/cars endpoint.
 * Gracefully normalizes both { success: true, cars: [...] } and legacy raw array responses.
 */
export async function fetchAllCarsFromApi(): Promise<{ success: boolean; cars: TransitCar[]; source?: string; error?: string }> {
  try {
    const res = await fetch('/api/cars');
    if (!res.ok) {
      return { success: false, cars: [], error: `Server xətası (${res.status})` };
    }
    const data = await res.json();
    if (data && Array.isArray(data.cars)) {
      return { success: true, cars: data.cars, source: data.source };
    }
    if (Array.isArray(data)) {
      return { success: true, cars: data, source: 'array' };
    }
    return { success: false, cars: [], error: data?.error || 'Məlumat formatı uyğun deyil' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Serverlə əlaqə qurulmadı';
    console.error('fetchAllCarsFromApi exception:', err);
    return { success: false, cars: [], error: msg };
  }
}
