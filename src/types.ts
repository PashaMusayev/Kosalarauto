export type BodyType = 'Yük furqonu' | 'Sərnişin' | 'Mikroavtobus' | 'Bortlu' | 'Soyuducu' | 'Bortlu / Tentli' | 'Soyuducu (Ref)' | 'Pikap' | 'Şassi' | string;
export type BaseLength = '2.4 m' | '2.8 m' | '3.30 m' | '4 m' | 'Qısa (L1 - 2.4 m)' | 'Orta (L2 - 2.8 m)' | 'Uzun (L3 - 3.30 m)' | 'Ekstra Uzun (L4 - 4.0 m)' | string;

export type TransitYear = number;
export interface TransitCar {
  id: string;
  title: string;
  brand?: string;
  make?: string;
  model?: string;
  city?: string;
  location?: string;
  year: number;
  price: number; // in AZN
  mileage: number; // in km
  bodyType: BodyType;
  color: string;
  engine: string;
  hp?: number;
  fuelType?: string;
  transmission: string;
  wheelDrive: string;
  baseLength: BaseLength;
  roofHeight?: 'Alçaq dam' | 'Orta dam' | 'Hündür dam' | string;
  seatCount?: string;
  condition?: string;
  statusBadges?: string[];
  badges?: string[];
  images: string[];
  primaryImage: string;
  description: string;
  features: string[];
  isFeatured?: boolean;
  status?: 'active' | 'sold';
  specs?: Record<string, unknown>;
}

export interface FilterState {
  brand?: string | string[];
  minYear: string | number;
  maxYear: string | number;
  year?: string;
  bodyType: string | string[];
  minPrice: number;
  maxPrice: number;
  minMileage: number;
  maxMileage: number;
  baseLength: string | string[];
  fuelType?: string | string[];
  transmission?: string | string[];
  searchQuery: string;
  sortBy: 'featured' | 'price-asc' | 'price-desc' | 'year-desc' | 'mileage-asc';
}

export interface TestDriveFormData {
  carId: string;
  carName: string;
  fullName: string;
  phone: string;
  preferredDate: string;
  preferredTime: string;
  note: string;
}

declare global {
  interface Window {
    __INITIAL_CARS__?: TransitCar[];
  }
}

