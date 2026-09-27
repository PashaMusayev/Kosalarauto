import { TransitCar } from '../../types';

export interface FormImageItem {
  id: string;
  url: string;
  file?: File;
  thumbBlob?: Blob;
  isBlob: boolean;
  originalSize?: number;
  compressedSize?: number;
  isCompressed?: boolean;
  isCompressing?: boolean;
  mimeType?: string;
  savedPercent?: number;
  error?: string;
  errorType?: 'unreadable' | 'heic' | 'general' | 'format' | 'size';
  errorDetail?: string;
  technicalError?: string;
  notice?: string;
  isFallbackOriginal?: boolean;
  fileName?: string;
}

export interface SaveProgressState {
  step: 'idle' | 'compressing' | 'uploading' | 'saving_db' | 'done';
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface ConnectionStatusState {
  tested: boolean;
  dbConnected: boolean;
  storageConnected: boolean;
  dbError?: string;
  storageError?: string;
}

export const DEFAULT_STANDARD_FEATURES = [
  'Kondisioner',
  'Yüngül lehimli disklər',
  'ABS / ESP təhlükəsizlik',
  'Lyuk',
  'Yağış sensoru',
  'Mərkəzi qapanma',
  'Park radarı',
  'Avtopilot (Kruiz-kontrol)',
  'Dəri salon',
  'Ksenon lampalar',
  'Arxa görüntü kamerası',
  'Yan pərdələr',
  'Oturacaqların isidilməsi',
  'Oturacaqların ventilyasiyası',
  'Bort kompyuter',
  'Elektrikli şüşəqaldıranlar',
  'Duman əleyhinə işıqlar',
  'Hidravlik sükan',
  'Yan sürüşən qapı'
];

export const BRAND_MODELS: Record<string, string[]> = {
  'Ford': ['Transit', 'Tourneo Custom', 'Transit Connect'],
  'Mercedes': ['Sprinter', 'Vito']
};

export const STANDARD_COLORS = [
  'Ağ',
  'Qara',
  'Gümüşü',
  'Gümüşü metallik',
  'Boz',
  'Göy',
  'Mavi',
  'Qırmızı',
  'Sarı',
  'Yaşıl',
  'Narıncı',
  'Qəhvəyi',
  'Bej',
  'Qızılı',
  'Digər'
];

export const STANDARD_ENGINE_OPTIONS = [
  '1.6 L',
  '1.8 L',
  '2.0 L',
  '2.2 L',
  '2.4 L',
  '2.5 L',
  '2.8 L',
  '3.0 L',
  '3.2 L'
];

export function normalizeEngineValue(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  const exact = STANDARD_ENGINE_OPTIONS.find(opt => opt.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const match = trimmed.match(/^(\d+(?:\.\d+)?)/);
  if (match) {
    const candidate = `${match[1]} L`;
    const found = STANDARD_ENGINE_OPTIONS.find(opt => opt === candidate);
    if (found) return found;
  }
  return trimmed;
}

export const STANDARD_WHEEL_DRIVE_OPTIONS = [
  'Arxa çəkən',
  'Ön çəkən',
  'Tam (4x4)'
];

export function normalizeWheelDriveValue(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.includes('Ön') || trimmed.toLowerCase().includes('fwd') || trimmed.toLowerCase().includes('qabaq')) {
    return 'Ön çəkən';
  }
  if (trimmed.includes('Arxa') || trimmed.toLowerCase().includes('rwd')) {
    return 'Arxa çəkən';
  }
  if (trimmed.includes('Tam') || trimmed.includes('4x4') || trimmed.toLowerCase().includes('awd') || trimmed.toLowerCase().includes('4wd')) {
    return 'Tam (4x4)';
  }
  return trimmed;
}

