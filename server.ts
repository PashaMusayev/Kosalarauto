import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mapLegacyBadges, sanitizeStatusBadges } from './src/data/badges';

const getDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
};

// =============================================================
// Security Infrastructure: HMAC Admin Session Tokens & Rate Limiting
// =============================================================
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface AdminSessionPayload {
  role: 'admin';
  iat: number;
  exp: number;
  nonce: string;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 * Token cannot be forged or tampered with by the client.
 */
function createAdminSessionToken(): string {
  const payload: AdminSessionPayload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + ADMIN_SESSION_EXPIRY_MS,
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

/**
 * Validates the HMAC-SHA256 signature and expiration timestamp.
 */
function verifyAdminSessionToken(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encodedPayload, signature] = parts;
  try {
    const expectedSignature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(encodedPayload).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
      return false;
    }
    const decoded = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8')) as AdminSessionPayload;
    if (decoded.role !== 'admin') return false;
    if (Date.now() > decoded.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
function safeComparePasswords(input: string, target: string): boolean {
  try {
    const a = Buffer.from(input);
    const b = Buffer.from(target);
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a); // burn constant time
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// In-memory rate limiting against brute-force login attacks
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup of expired rate-limit records every 10 minutes
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts.entries()) {
    if (now >= record.resetAt) {
      loginAttempts.delete(ip);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);

if (rateLimitCleanupTimer.unref) {
  rateLimitCleanupTimer.unref();
}

function checkLoginRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  if (now > record.resetAt) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, waitSeconds };
  }
  return { allowed: true };
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOCKOUT_PERIOD_MS });
  } else {
    record.count += 1;
  }
}

function resetLoginAttempts(ip: string) {
  loginAttempts.delete(ip);
}

/**
 * File buffer magic byte inspection for image uploads.
 * Rejects disguised or malicious file payloads.
 */
function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return true;
  }
  return false;
}

/**
 * Schema validation and data sanitization for car records.
 */
function validateAndSanitizeCars(cars: unknown[]): { valid: boolean; error?: string; sanitized?: Record<string, unknown>[] } {
  if (!Array.isArray(cars)) {
    return { valid: false, error: 'Avtomobillər massiv formatında olmalıdır' };
  }
  if (cars.length > 500) {
    return { valid: false, error: 'Həddindən artıq elan sayı (maksimum 500)' };
  }

  const sanitized: Record<string, unknown>[] = [];
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i] as Record<string, unknown> | null;
    if (!c || typeof c !== 'object') {
      return { valid: false, error: `Elan #${i + 1} düzgün formatda deyil` };
    }
    const rawPrice = Number(c.price);
    if (isNaN(rawPrice) || rawPrice < 0 || rawPrice > 50000000) {
      return { valid: false, error: `Elan #${i + 1}: Qiymət düzgün deyil` };
    }
    const rawYear = Number(c.year);
    if (isNaN(rawYear) || rawYear < 1970 || rawYear > 2035) {
      return { valid: false, error: `Elan #${i + 1}: İl 1970-2035 aralığında olmalıdır` };
    }

    const id = String(c.id || `car-${Date.now()}-${i}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    const brand = String(c.brand || c.make || 'Ford').trim().slice(0, 100);
    const model = String(c.model || 'Transit').trim().slice(0, 100);
    const title = String(c.title || `${brand} ${model}`).trim().slice(0, 200);
    const city = String(c.city || c.location || 'Bakı').trim().slice(0, 100);
    const location = city;
    const bodyType = String(c.bodyType ?? c.body_type ?? '').trim().slice(0, 100);
    const color = String(c.color ?? '').trim().slice(0, 100);
    const engine = String(c.engine ?? '').trim().slice(0, 100);
    const rawHp = (c.hp !== undefined && c.hp !== null && String(c.hp).trim() !== '')
      ? Number(c.hp)
      : ((c.horsePower !== undefined && c.horsePower !== null && String(c.horsePower).trim() !== '')
          ? Number(c.horsePower)
          : ((c.horse_power !== undefined && c.horse_power !== null && String(c.horse_power).trim() !== '')
              ? Number(c.horse_power)
              : undefined));
    const hp = rawHp !== undefined && !isNaN(rawHp) && rawHp > 0 ? Math.min(2000, Math.round(rawHp)) : 0;
    const fuelType = String(c.fuelType ?? c.fuel_type ?? '').trim().slice(0, 100);
    const transmission = String(c.transmission ?? '').trim().slice(0, 100);
    const wheelDrive = String(c.wheelDrive ?? c.driveType ?? c.drive_type ?? '').trim().slice(0, 100);
    const baseLength = String(c.baseLength ?? c.base_length ?? '').trim().slice(0, 100);
    const roofHeight = String(c.roofHeight ?? c.roof_height ?? '').trim().slice(0, 100);
    const rawSeatCount = c.seatCount !== undefined && c.seatCount !== null 
      ? c.seatCount 
      : (c.seat_count !== undefined && c.seat_count !== null 
          ? c.seat_count 
          : (c.specs && typeof c.specs === 'object' ? ((c.specs as Record<string, unknown>).seatCount || (c.specs as Record<string, unknown>).seat_count) : undefined));
    const seatCount = rawSeatCount ? String(rawSeatCount).trim().slice(0, 50) : undefined;
    const condition = String(c.condition ?? '').trim().slice(0, 200);
    const vinCode = String(c.vinCode ?? c.vin_code ?? '').trim().toUpperCase().slice(0, 50);
    const description = String(c.description ?? '').slice(0, 5000);
    const isFeatured = Boolean(c.isFeatured ?? c.is_featured);
    const status = c.status === 'sold' ? 'sold' : 'active';

    const images = Array.isArray(c.images)
      ? (c.images as unknown[])
          .filter((img: unknown): img is string => typeof img === 'string' && img.trim().length > 0 && img.length < 2000)
          .map(img => String(img).slice(0, 2000))
          .slice(0, 50)
      : [];
    const primaryImage = typeof c.primaryImage === 'string' && c.primaryImage.trim().length > 0
      ? c.primaryImage.slice(0, 2000)
      : (typeof c.primary_image === 'string' && c.primary_image.trim().length > 0 ? c.primary_image.slice(0, 2000) : (images[0] || ''));

    const rawBadges = Array.isArray(c.statusBadges) ? c.statusBadges : Array.isArray(c.badges) ? c.badges : [];
    const statusBadges = sanitizeStatusBadges(rawBadges);

    // Flexible features validation (supports array of strings or key-value object)
    let features: string[] | Record<string, unknown> = [];
    if (Array.isArray(c.features)) {
      features = (c.features as unknown[])
        .filter((f: unknown): f is string => typeof f === 'string' && f.trim().length > 0)
        .map(f => String(f).slice(0, 200))
        .slice(0, 100);
    } else if (c.features && typeof c.features === 'object') {
      const cleanObj: Record<string, unknown> = {};
      const entries = Object.entries(c.features as Record<string, unknown>).slice(0, 50);
      for (const [key, val] of entries) {
        const cleanKey = String(key).slice(0, 100);
        if (Array.isArray(val)) {
          cleanObj[cleanKey] = (val as unknown[])
            .filter((v: unknown): v is string => typeof v === 'string')
            .map(v => String(v).slice(0, 200))
            .slice(0, 50);
        } else if (typeof val === 'string') {
          cleanObj[cleanKey] = String(val).slice(0, 200);
        } else if (typeof val === 'boolean' || typeof val === 'number') {
          cleanObj[cleanKey] = val;
        }
      }
      features = cleanObj;
    }

    let specs: Record<string, unknown> | undefined = undefined;
    if (c.specs && typeof c.specs === 'object' && !Array.isArray(c.specs)) {
      specs = {};
      const entries = Object.entries(c.specs as Record<string, unknown>).slice(0, 50);
      for (const [key, val] of entries) {
        const cleanKey = String(key).slice(0, 100);
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          specs[cleanKey] = typeof val === 'string' ? val.slice(0, 500) : val;
        }
      }
    }

    const sanitizedCar: Record<string, unknown> = {
      id,
      title,
      brand,
      make: brand,
      model,
      city,
      location,
      year: rawYear,
      price: rawPrice,
      mileage: Math.min(2000000, Math.max(0, Number(c.mileage) || 0)),
      bodyType,
      color,
      engine,
      hp,
      fuelType,
      transmission,
      wheelDrive,
      baseLength,
      roofHeight,
      ...(seatCount ? { seatCount } : {}),
      condition,
      vinCode,
      primaryImage,
      images,
      statusBadges,
      badges: statusBadges,
      description,
      features,
      isFeatured,
      status
    };
    if (specs) {
      sanitizedCar.specs = specs;
    }

    sanitized.push(sanitizedCar);
  }

  return { valid: true, sanitized };
}

// Normalize Supabase URL helper
function normalizeSupabaseUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim().replace(/\/+$/, '');
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  return cleaned.trim().replace(/\/+$/, '');
}

// Initialize Supabase Server Client lazily
let serverSupabase: SupabaseClient | null = null;
const STORAGE_BUCKET_NAME = 'car-images';

function getServerSupabase(): SupabaseClient | null {
  if (serverSupabase) return serverSupabase;
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const sUrl = normalizeSupabaseUrl(rawUrl);
  const sKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (sUrl && sKey && (sUrl.startsWith('http://') || sUrl.startsWith('https://')) && sKey.length > 10) {
    try {
      serverSupabase = createClient(sUrl, sKey);
      return serverSupabase;
    } catch (e) {
      console.warn('Server Supabase client init failed:', e);
    }
  }
  return null;
}

const DEFAULT_SERVER_CARS = [
  {
    id: 'ft-2011-01',
    title: 'Ford Transit 2.2 3.30',
    year: 2011,
    bodyType: 'Yük furqonu',
    engine: '2.2 TDCi Euro 5',
    hp: 125,
    transmission: '6-Pilləli Mexanika',
    mileage: 223195,
    price: 18800,
    baseLength: '3.30 m',
    roofHeight: 'Hündür dam',
    wheelDrive: 'Ön çəkən (FWD)',
    color: 'Gümüşü metallik',
    fuelType: 'Dizel',
    vinCode: 'WF0XXXTTFXCY12984',
    location: 'Bakı, Yeni Günəşli',
    statusBadges: ['Gömrük olunub', 'Vuruqsuz və rəngsiz'],
    primaryImage: '/images/ford_transit_hero.jpg',
    images: [
      '/images/ford_transit_hero.jpg'
    ],
    description: 'Təmiz, vuruqsuz və rəng dəyməmiş Ford Transit 3.30 m baza. Almaniyadan yeni gətirilib, bütün texniki baxışları orijinal ehtiyat hissələri ilə olunub. Mühərrik və sürət qutusu saat kimi işləyir.',
    features: [
      'Kondisioner',
      'Avtopilot (Cruise Control)',
      'ABS / ESP təhlükəsizlik',
      'Elektrikli şüşəqaldıranlar',
      'Mərkəzi qapanma',
      'Duman əleyhinə işıqlar',
      'Bort kompyuter',
      'Yan sürüşən qapı'
    ],
    isFeatured: true
  },
  {
    id: 'mb-sprinter-2008-02',
    title: 'Mercedes Sprinter 2.2 3.30',
    year: 2008,
    bodyType: 'Yük furqonu',
    engine: '2.2 CDI',
    hp: 150,
    transmission: '6-Pilləli Mexanika',
    mileage: 236400,
    price: 29000,
    baseLength: '3.30 m',
    roofHeight: 'Hündür dam',
    wheelDrive: 'Arxa çəkən (RWD)',
    color: 'Sarı',
    fuelType: 'Dizel',
    vinCode: 'WDB9066331S194827',
    location: 'Bakı, Yeni Günəşli',
    statusBadges: ['Gömrük olunub', 'Vuruqsuz və rəngsiz'],
    primaryImage: '/pics/mercedes sprinter/msponyan.jpeg',
    images: [
      '/pics/mercedes sprinter/msponyan.jpeg',
      '/pics/mercedes sprinter/mspsagyan.jpeg',
      '/pics/mercedes sprinter/msparxayan.jpeg',
      '/pics/mercedes sprinter/msparxasag.jpeg',
      '/pics/mercedes sprinter/msparxa.jpeg',
      '/pics/mercedes sprinter/msparxaacig.jpeg',
      '/pics/mercedes sprinter/mspyukyan.jpeg',
      '/pics/mercedes sprinter/msprol.jpeg',
      '/pics/mercedes sprinter/mspkm.jpeg',
      '/pics/mercedes sprinter/mspkans.jpeg',
      '/pics/mercedes sprinter/mspmatorxana.jpeg',
      '/pics/mercedes sprinter/mspmatorxana2.jpeg'
    ],
    description: 'Mercedes Sprinter 2.2 CDI 3.30 m orta-uzun baza yük yeri. Almaniyadan yeni gətirilib, Azərbaycanda sürülməyib. 100% gömrük olunub. Vuruğu, pası və ya dəyişən detalı qətiyyən yoxdur. Orijinal probeq. Mühərrik, sürət qutusu və most ideal vəziyyətdədir. Kondisioner buz kimi vurur. Bütün sənədləri qaydasındadır.',
    features: [
      'Kondisioner',
      'ABS / ESP',
      'Elektrikli şüşəqaldıranlar',
      'Mərkəzi qapanma',
      'Bort kompyuter',
      'Hidravlik sükan',
      'Yan sürüşən qapı',
      'Duman əleyhinə işıqlar'
    ],
    isFeatured: true
  }
];

// In-memory / file persistence helper
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'cars.json');

// Serialized write lock for disk-only fallback operations to prevent race conditions
let writeQueue: Promise<unknown> = Promise.resolve();
function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const res = writeQueue.then(fn, fn);
  writeQueue = res.then(() => {}, () => {});
  return res;
}

function getCarsFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read cars from disk:', err);
  }
  return DEFAULT_SERVER_CARS;
}

function saveCarsToDisk(cars: unknown[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(cars, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not save cars to disk:', err);
  }
}

/**
 * XSS-safe JSON serialization for script tag embedding.
 * Escapes <, >, &, U+2028, and U+2029 to prevent script break-out.
 */
function serializeForScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Prepares public active catalog fields from the disk cache for client HTML injection.
 * If disk cache is unavailable or empty, returns null so the client falls back normally.
 */
function getSanitizedCarsForInjection(): Record<string, unknown>[] | null {
  try {
    const rawCars = getCarsFromDisk();
    if (!Array.isArray(rawCars) || rawCars.length === 0) {
      return null;
    }
    return rawCars.map(c => {
      const car = c as Record<string, any>;
      const rawBrandInput = String(car.brand || car.make || '');
      const brand = rawBrandInput.toLowerCase().includes('mercedes')
        ? 'Mercedes'
        : (rawBrandInput || ((car.title as string)?.toLowerCase().includes('mercedes') ? 'Mercedes' : 'Ford'));
      const model = String(car.model || ((car.title as string)?.toLowerCase().includes('sprinter') ? 'Sprinter' : 'Transit'));
      const city = String(car.city || car.location || 'Bakı');

      return {
        id: String(car.id),
        title: String(car.title || `${brand} ${model}`),
        brand,
        make: brand,
        model,
        city,
        location: city,
        year: Number(car.year) || 2011,
        price: Number(car.price) || 0,
        mileage: Number(car.mileage) || 0,
        engine: String(car.engine ?? '').trim(),
        hp: Number(car.hp || car.horsePower || 0),
        horsePower: Number(car.hp || car.horsePower || 0),
        transmission: String(car.transmission ?? '').trim(),
        wheelDrive: String(car.wheelDrive ?? car.driveType ?? '').trim(),
        driveType: String(car.wheelDrive ?? car.driveType ?? '').trim(),
        bodyType: String(car.bodyType ?? '').trim(),
        baseLength: String(car.baseLength ?? '').trim(),
        roofHeight: String(car.roofHeight ?? '').trim(),
        ...(car.seatCount ? { seatCount: String(car.seatCount).trim() } : {}),
        color: String(car.color ?? '').trim(),
        fuelType: String(car.fuelType ?? '').trim(),
        condition: String(car.condition ?? 'Vuruğu yoxdur, rənglənməyib').trim(),
        vinCode: String(car.vinCode ?? '').trim(),
        primaryImage: String(car.primaryImage || (Array.isArray(car.images) && car.images[0]) || ''),
        images: Array.isArray(car.images) ? car.images : [],
        description: String(car.description || ''),
        features: Array.isArray(car.features) ? car.features : [],
        statusBadges: mapLegacyBadges(car.statusBadges ?? car.badges),
        badges: mapLegacyBadges(car.statusBadges ?? car.badges),
        isFeatured: Boolean(car.isFeatured),
        status: car.status === 'sold' ? 'sold' : 'active',
        specs: (typeof car.specs === 'object' && car.specs !== null) ? car.specs : undefined
      };
    });
  } catch (err) {
    console.warn('Failed to sanitize cars for HTML injection:', err);
    return null;
  }
}

/**
 * Injects initial cars data into HTML template as a safe script setting window.__INITIAL_CARS__.
 */
function injectInitialCarsIntoHtml(html: string): string {
  try {
    const cars = getSanitizedCarsForInjection();
    if (!cars || cars.length === 0) {
      return html;
    }
    const safeJson = serializeForScript(cars);
    const scriptTag = `<script>window.__INITIAL_CARS__ = ${safeJson};</script>`;
    if (html.includes('<div id="root">')) {
      return html.replace('<div id="root">', `${scriptTag}\n    <div id="root">`);
    } else if (html.includes('</head>')) {
      return html.replace('</head>', `  ${scriptTag}\n  </head>`);
    } else {
      return `${scriptTag}\n${html}`;
    }
  } catch (e) {
    console.warn('Could not inject initial cars into HTML:', e);
    return html;
  }
}

/**
 * Formats a raw Supabase cars table row into a standard TransitCar model.
 */
function formatSupabaseCarRow(row: Record<string, any>): Record<string, unknown> {
  const specs = (typeof row.specs === 'object' && row.specs !== null) ? (row.specs as Record<string, unknown>) : {};
  const rawBrandInput = String(row.brand || row.make || specs.brand || specs.make || '');
  const rawBrand = rawBrandInput.toLowerCase().includes('mercedes')
    ? 'Mercedes'
    : (rawBrandInput || ((row.title as string)?.toLowerCase().includes('mercedes') ? 'Mercedes' : 'Ford'));
  const rawModel = String(row.model || specs.model || ((row.title as string)?.toLowerCase().includes('sprinter') ? 'Sprinter' : 'Transit'));
  const city = String(row.city || row.location || specs.city || specs.location || 'Bakı');
  const condition = String(row.condition || specs.condition || 'Vuruğu yoxdur, rənglənməyib');

  return {
    id: String(row.id),
    title: String(row.title || `${rawBrand} ${rawModel}`),
    brand: rawBrand,
    make: rawBrand,
    model: rawModel,
    city: city,
    location: city,
    year: Number(row.year || specs.year) || 2011,
    price: Number(row.price || specs.price) || 0,
    mileage: Number(row.mileage || specs.mileage) || 0,
    engine: String(row.engine ?? specs.engine ?? '').trim(),
    hp: Number(row.horse_power || row.horsePower || row.hp || specs.hp) || 0,
    horsePower: Number(row.horse_power || row.horsePower || row.hp || specs.hp) || 0,
    transmission: String(row.transmission ?? specs.transmission ?? '').trim(),
    wheelDrive: String(row.drive_type ?? row.driveType ?? row.wheelDrive ?? specs.wheelDrive ?? specs.drive_type ?? '').trim(),
    driveType: String(row.drive_type ?? row.driveType ?? row.wheelDrive ?? specs.wheelDrive ?? specs.drive_type ?? '').trim(),
    bodyType: String(row.body_type ?? row.bodyType ?? specs.bodyType ?? specs.body_type ?? '').trim(),
    baseLength: String(row.base_length ?? row.baseLength ?? specs.baseLength ?? specs.base_length ?? '').trim(),
    roofHeight: String(row.roof_height ?? row.roofHeight ?? specs.roofHeight ?? specs.roof_height ?? '').trim(),
    seatCount: row.seat_count ? String(row.seat_count).trim() : (row.seatCount ? String(row.seatCount).trim() : (specs.seatCount ? String(specs.seatCount).trim() : (specs.seat_count ? String(specs.seat_count).trim() : undefined))),
    color: String(row.color ?? specs.color ?? '').trim(),
    fuelType: String(row.fuel_type ?? row.fuelType ?? specs.fuelType ?? '').trim(),
    condition: condition,
    vinCode: String(row.vin_code ?? row.vinCode ?? specs.vinCode ?? specs.vin_code ?? '').trim(),
    primaryImage: String(row.primary_image || row.primaryImage || ''),
    images: Array.isArray(row.images) ? row.images : (row.primary_image ? [String(row.primary_image)] : []),
    description: String(row.description || specs.description || ''),
    features: Array.isArray(row.features) ? row.features : (Array.isArray(specs.features) ? specs.features : []),
    statusBadges: mapLegacyBadges(row.badges ?? row.statusBadges),
    badges: mapLegacyBadges(row.badges ?? row.statusBadges),
    isFeatured: Boolean(row.is_featured ?? row.isFeatured ?? specs.isFeatured),
    status: row.status === 'sold' ? 'sold' : 'active',
    specs: specs
  };
}

/**
 * Maps a validated, sanitized car object to a single Supabase database row.
 */
function mapSanitizedCarToSupabaseRow(c: Record<string, unknown>): Record<string, unknown> {
  const rawBrandInput = String(c.brand || c.make || '');
  const brand = rawBrandInput.toLowerCase().includes('mercedes')
    ? 'Mercedes'
    : (rawBrandInput || ((c.title as string)?.toLowerCase().includes('mercedes') ? 'Mercedes' : 'Ford'));
  const model = (c.model as string) || ((c.title as string)?.toLowerCase().includes('sprinter') ? 'Sprinter' : 'Transit');
  const city = (c.city as string) || (c.location as string) || 'Bakı';
  const condition = String(c.condition ?? '').trim();
  const primaryImage = (c.primaryImage as string) || ((Array.isArray(c.images) && typeof c.images[0] === 'string') ? c.images[0] : '');

  return {
    id: String(c.id),
    title: c.title || `${brand} ${model}`,
    brand: brand,
    make: brand,
    model: model,
    city: city,
    location: city,
    year: Number(c.year) || 2011,
    price: Number(c.price) || 0,
    mileage: Number(c.mileage) || 0,
    engine: String(c.engine ?? '').trim(),
    horse_power: Number((c.horsePower as number) || (c.hp as number) || 0),
    transmission: String(c.transmission ?? '').trim(),
    drive_type: String(c.wheelDrive ?? c.driveType ?? '').trim(),
    body_type: String(c.bodyType ?? '').trim(),
    base_length: String(c.baseLength ?? '').trim(),
    roof_height: String(c.roofHeight ?? '').trim(),
    ...(c.seatCount ? { seat_count: String(c.seatCount).trim() } : {}),
    color: String(c.color ?? '').trim(),
    fuel_type: String(c.fuelType ?? '').trim(),
    condition: condition,
    vin_code: (c.vinCode as string) || '',
    primary_image: primaryImage,
    images: Array.isArray(c.images) ? c.images : (primaryImage ? [primaryImage] : []),
    description: c.description || '',
    features: Array.isArray(c.features) ? c.features : [],
    badges: sanitizeStatusBadges(c.statusBadges ?? c.badges),
    is_featured: Boolean(c.isFeatured),
    status: c.status === 'sold' ? 'sold' : 'active',
    specs: (typeof c.specs === 'object' && c.specs !== null) ? {
      ...(c.specs as Record<string, unknown>),
      ...(c.seatCount ? { seatCount: String(c.seatCount).trim() } : {})
    } : {
      brand,
      make: brand,
      model,
      city,
      location: city,
      condition,
      baseLength: String(c.baseLength ?? '').trim(),
      roofHeight: String(c.roofHeight ?? '').trim(),
      ...(c.seatCount ? { seatCount: String(c.seatCount).trim() } : {}),
      transmission: String(c.transmission ?? '').trim(),
      wheelDrive: String(c.wheelDrive ?? c.driveType ?? '').trim(),
      engine: String(c.engine ?? '').trim(),
      hp: Number((c.horsePower as number) || (c.hp as number) || 0),
      color: String(c.color ?? '').trim(),
      fuelType: String(c.fuelType ?? '').trim(),
      bodyType: String(c.bodyType ?? '').trim(),
      year: c.year,
      mileage: c.mileage,
      price: c.price,
      vinCode: c.vinCode
    },
    updated_at: new Date().toISOString()
  };
}

/**
 * Re-fetches the authoritative full list of cars from Supabase and refreshes data/cars.json.
 * Uses withWriteLock to prevent concurrent disk writes from interleaving.
 */
async function refreshDiskCacheFromSupabase(supabase: SupabaseClient): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const formattedCars = data.map(formatSupabaseCarRow);
      await withWriteLock(async () => {
        saveCarsToDisk(formattedCars);
      });
      return formattedCars;
    } else if (error) {
      console.warn('Could not re-fetch authoritative cars from Supabase:', error.message);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown Supabase fetch error';
    console.warn('Exception while refreshing disk cache from Supabase:', msg);
  }
  return getCarsFromDisk();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for accurate client IP behind reverse proxy / Cloud Run
  app.set('trust proxy', 1);

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://ai.studio https://*.google.com;");
    next();
  });

  // Global JSON body parser: 2MB limit (sufficient for catalog sync and general requests)
  // High limit (50MB) is applied strictly per-route on POST /api/upload-image
  app.use((req, res, next) => {
    if (req.path === '/api/upload-image') {
      return next();
    }
    return express.json({ limit: '2mb' })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Static route for vehicle pictures with safe fallback
  app.use('/pics', express.static(path.join(process.cwd(), 'public/pics')));
  app.get('/pics/*', (req, res) => {
    const heroPath = path.join(process.cwd(), 'public/images/ford_transit_hero.jpg');
    if (fs.existsSync(heroPath)) {
      res.sendFile(heroPath);
    } else {
      res.type('image/svg+xml').send("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#0f172a'/><text x='200' y='150' fill='#38bdf8' font-family='sans-serif' font-weight='bold' font-size='16' text-anchor='middle'>KOSALAR AUTO</text></svg>");
    }
  });

  // Supabase Config info endpoint
  app.get('/api/supabase-config', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const sUrl = normalizeSupabaseUrl(rawUrl);
    const sKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    res.json({
      supabaseUrl: sUrl,
      supabaseAnonKey: sKey,
      isConfigured: Boolean(sUrl && sKey && (sUrl.startsWith('http://') || sUrl.startsWith('https://')) && sKey.length > 10),
      bucket: STORAGE_BUCKET_NAME,
      table: 'cars'
    });
  });

  // Analytics Endpoints (Server-side tracking & Admin KPI)
  const whatsappClickRateLimit = new Map<string, { count: number; resetAt: number }>();
  let cachedServerWhatsAppClicks = 0;

  // Cleanup rate limiter map every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of whatsappClickRateLimit.entries()) {
      if (now > entry.resetAt) {
        whatsappClickRateLimit.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // GET /api/analytics - Read analytics KPI (for Admin KPI card)
  app.get('/api/analytics', async (_req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('analytics')
          .select('whatsapp_clicks')
          .eq('id', 1)
          .maybeSingle();

        if (!error && data && typeof data.whatsapp_clicks === 'number') {
          cachedServerWhatsAppClicks = data.whatsapp_clicks;
          res.json({ success: true, whatsappClicks: data.whatsapp_clicks });
          return;
        }
      } catch (err) {
        console.warn('GET /api/analytics Supabase query error:', err);
      }
    }
    res.json({ success: true, whatsappClicks: cachedServerWhatsAppClicks });
  });

  // POST /api/analytics/whatsapp-click - Track WhatsApp click server-side
  app.post('/api/analytics/whatsapp-click', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown').split(',')[0].trim();
    
    // Rate limit: max 20 clicks per 60 seconds per IP
    const now = Date.now();
    const entry = whatsappClickRateLimit.get(clientIp);
    if (entry && now < entry.resetAt) {
      if (entry.count >= 20) {
        res.status(429).json({ success: false, error: 'Too many requests' });
        return;
      }
      entry.count++;
    } else {
      whatsappClickRateLimit.set(clientIp, { count: 1, resetAt: now + 60000 });
    }

    // Input whitelist: optional carId string
    let carId: string | undefined;
    try {
      let b = req.body;
      if (typeof b === 'string') {
        try { b = JSON.parse(b); } catch {}
      }
      if (b && typeof b === 'object' && typeof b.carId === 'string') {
        carId = b.carId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
      }
    } catch {}

    const supabase = getServerSupabase();
    let updatedClicks = cachedServerWhatsAppClicks + 1;

    if (supabase) {
      try {
        // Query current count
        const { data } = await supabase
          .from('analytics')
          .select('whatsapp_clicks')
          .eq('id', 1)
          .maybeSingle();

        const currentVal = (data && typeof data.whatsapp_clicks === 'number') 
          ? data.whatsapp_clicks 
          : cachedServerWhatsAppClicks;
        updatedClicks = currentVal + 1;

        // Upsert to analytics table
        const { error: upErr } = await supabase
          .from('analytics')
          .upsert({
            id: 1,
            whatsapp_clicks: updatedClicks
          }, { onConflict: 'id' });

        if (!upErr) {
          cachedServerWhatsAppClicks = updatedClicks;
        } else {
          console.warn('Server Supabase WhatsApp click upsert notice:', upErr.message);
          cachedServerWhatsAppClicks = updatedClicks;
        }
      } catch (err) {
        console.warn('Server Supabase WhatsApp click sync error:', err);
        cachedServerWhatsAppClicks++;
        updatedClicks = cachedServerWhatsAppClicks;
      }
    } else {
      cachedServerWhatsAppClicks++;
      updatedClicks = cachedServerWhatsAppClicks;
    }

    res.json({ success: true, whatsappClicks: updatedClicks });
  });

  // Cars Catalog APIs (Supabase Database + Persistent Fallback)
  app.get('/api/cars', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');

    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cars')
          .select('*')
          .order('is_featured', { ascending: false })
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const formattedCars = data.map(formatSupabaseCarRow);
          // Async update disk cache without blocking response
          withWriteLock(async () => {
            saveCarsToDisk(formattedCars);
          }).catch(() => {});
          res.json({ success: true, cars: formattedCars, source: 'supabase' });
          return;
        }
      } catch (sbErr: unknown) {
        const msg = sbErr instanceof Error ? sbErr.message : 'Supabase query error';
        console.warn('Supabase fetch failed in /api/cars, using local store:', msg);
      }
    }

    const cars = getCarsFromDisk();
    res.json({ success: true, cars, source: 'local' });
  });

  // Admin authorization middleware
  const requireAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'İcazəsiz əməliyyat: Admin autentifikasiyası tələb olunur' });
      return;
    }

    const token = authHeader.substring(7).trim();

    // 1. Verify server-issued HMAC signed admin session token
    if (verifyAdminSessionToken(token)) {
      return next();
    }

    // 2. Explicit security check: If a normal Supabase authenticated user attempts to access admin endpoints,
    // explicitly reject with 403 Forbidden. A normal Supabase user must NEVER be treated as an administrator.
    const supabase = getServerSupabase();
    if (supabase) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          res.status(403).json({
            success: false,
            error: 'Giriş qadağandır: Supabase istifadəçisi admin hüquqlarına malik deyil. Yalnız etibarlı admin sessiyası qəbul edilir.'
          });
          return;
        }
      } catch {
        // ignore
      }
    }

    res.status(401).json({ success: false, error: 'Sessiyanızın vaxtı bitib və ya icazəniz yoxdur. Zəhmət olmasa yenidən daxil olun.' });
  };

  // Protected: Save / Update Cars Catalog (Atomic single-row operations + authoritative cache refresh)
  app.post('/api/cars', requireAdminAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Case 1: Status toggle sent to /api/cars { carId, status } or { id, status }
    const statusCarId = (req.body.carId || req.body.id) as string | undefined;
    if (statusCarId && req.body.status && (req.body.status === 'active' || req.body.status === 'sold')) {
      const cleanCarId = String(statusCarId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
      const nextStatus: 'active' | 'sold' = req.body.status === 'sold' ? 'sold' : 'active';

      const supabase = getServerSupabase();
      if (!supabase) {
        console.error('Supabase client unavailable during status update in POST /api/cars');
        res.status(502).json({
          success: false,
          error: 'Məlumat bazasına qoşulmaq mümkün olmadı. Supabase konfiqurasiyasını yoxlayın və ya administratorla əlaqə saxlayın.'
        });
        return;
      }

      try {
        const { error: sbErr } = await supabase
          .from('cars')
          .update({
            status: nextStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', cleanCarId);

        if (sbErr) {
          console.error('Supabase status update error in POST /api/cars:', sbErr.message, sbErr);
          res.status(502).json({
            success: false,
            error: `Məlumat bazasına yazıla bilmədi: ${sbErr.message}. Zəhmət olmasa bir azdan yenidən cəhd edin və ya administratorla əlaqə saxlayın.`
          });
          return;
        }

        const authoritativeCars = await refreshDiskCacheFromSupabase(supabase);
        res.json({ success: true, carId: cleanCarId, status: nextStatus, cars: authoritativeCars });
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Supabase status error';
        console.error('Supabase status update exception in POST /api/cars:', msg, err);
        res.status(502).json({
          success: false,
          error: `Məlumat bazasında gözlənilməz xəta: ${msg}. Zəhmət olmasa bir azdan yenidən cəhd edin.`
        });
        return;
      }
    }

    // Case 2: Single car object { car: { ... } } OR single car array { cars: [ { ... } ] }
    const rawSingleCar = req.body.car || (Array.isArray(req.body.cars) && req.body.cars.length === 1 ? req.body.cars[0] : null);

    if (rawSingleCar && typeof rawSingleCar === 'object') {
      const validation = validateAndSanitizeCars([rawSingleCar]);
      if (!validation.valid || !validation.sanitized || validation.sanitized.length === 0) {
        res.status(400).json({ success: false, error: validation.error || 'Daxil edilən elan məlumatları düzgün formatda deyil' });
        return;
      }

      const sanitizedCar = validation.sanitized[0];
      const supabase = getServerSupabase();

      if (!supabase) {
        console.error('Supabase client unavailable during single-car upsert in POST /api/cars');
        res.status(502).json({
          success: false,
          error: 'Məlumat bazasına qoşulmaq mümkün olmadı. Supabase konfiqurasiyasını yoxlayın və ya administratorla əlaqə saxlayın.'
        });
        return;
      }

      try {
        const row = mapSanitizedCarToSupabaseRow(sanitizedCar);
        // Atomic single-row upsert touching ONLY this car's row
        let { error: sbErr } = await supabase.from('cars').upsert(row, { onConflict: 'id' });

        // Resilience: If Supabase table does not yet have 'seat_count' column in schema cache,
        // retry without top-level seat_count (seatCount is already safely preserved in specs JSONB).
        if (sbErr && sbErr.message && (sbErr.message.includes('seat_count') || sbErr.message.includes('seatCount'))) {
          console.warn("Supabase cars table lacks 'seat_count' column; retrying without top-level column (preserved in specs):", sbErr.message);
          const rowWithoutSeat = { ...row };
          delete rowWithoutSeat.seat_count;
          delete (rowWithoutSeat as Record<string, unknown>).seatCount;
          const retryRes = await supabase.from('cars').upsert(rowWithoutSeat, { onConflict: 'id' });
          sbErr = retryRes.error;
        }

        if (sbErr) {
          console.error('Supabase single-car upsert error:', sbErr.message, sbErr);
          res.status(502).json({
            success: false,
            error: `Məlumat bazasına yazıla bilmədi: ${sbErr.message}. Zəhmət olmasa bir azdan yenidən cəhd edin və ya administratorla əlaqə saxlayın.`
          });
          return;
        }

        // Re-fetch authoritative list FROM SUPABASE to refresh disk cache
        const authoritativeCars = await refreshDiskCacheFromSupabase(supabase);
        res.json({ success: true, car: sanitizedCar, cars: authoritativeCars });
        return;
      } catch (sbErr: unknown) {
        const msg = sbErr instanceof Error ? sbErr.message : 'Supabase upsert error';
        console.error('Failed to upsert single car to Supabase:', msg, sbErr);
        res.status(502).json({
          success: false,
          error: `Məlumat bazasında gözlənilməz xəta: ${msg}. Zəhmət olmasa bir azdan yenidən cəhd edin.`
        });
        return;
      }
    }

    // Case 3: Batch array of multiple cars (legacy / initial sync support)
    const { cars } = req.body;
    const validation = validateAndSanitizeCars(cars);
    if (!validation.valid || !validation.sanitized) {
      res.status(400).json({ success: false, error: validation.error || 'Daxil edilən elan məlumatları düzgün formatda deyil' });
      return;
    }

    const sanitizedCars = validation.sanitized;
    const supabase = getServerSupabase();

    if (!supabase) {
      console.error('Supabase client unavailable during batch sync in POST /api/cars');
      res.status(502).json({
        success: false,
        error: 'Məlumat bazasına qoşulmaq mümkün olmadı. Supabase konfiqurasiyasını yoxlayın və ya administratorla əlaqə saxlayın.'
      });
      return;
    }

    try {
      const rows = sanitizedCars.map(mapSanitizedCarToSupabaseRow);
      let { error: sbErr } = await supabase.from('cars').upsert(rows, { onConflict: 'id' });

      if (sbErr && sbErr.message && (sbErr.message.includes('seat_count') || sbErr.message.includes('seatCount'))) {
        console.warn("Supabase batch upsert: cars table lacks 'seat_count' column; retrying batch without top-level column (preserved in specs):", sbErr.message);
        const rowsWithoutSeat = rows.map(r => {
          const copy = { ...r };
          delete copy.seat_count;
          delete (copy as Record<string, unknown>).seatCount;
          return copy;
        });
        const retryRes = await supabase.from('cars').upsert(rowsWithoutSeat, { onConflict: 'id' });
        sbErr = retryRes.error;
      }

      if (sbErr) {
        console.error('Supabase batch upsert error:', sbErr.message, sbErr);
        res.status(502).json({
          success: false,
          error: `Məlumat bazasına yazıla bilmədi: ${sbErr.message}. Zəhmət olmasa bir azdan yenidən cəhd edin və ya administratorla əlaqə saxlayın.`
        });
        return;
      }

      const authoritativeCars = await refreshDiskCacheFromSupabase(supabase);
      res.json({ success: true, cars: authoritativeCars });
      return;
    } catch (sbErr: unknown) {
      const msg = sbErr instanceof Error ? sbErr.message : 'Batch upsert error';
      console.error('Failed to sync cars batch to Supabase:', msg, sbErr);
      res.status(502).json({
        success: false,
        error: `Məlumat bazasında gözlənilməz xəta: ${msg}. Zəhmət olmasa bir azdan yenidən cəhd edin.`
      });
      return;
    }
  });

  // Protected: Atomic Status Toggle Endpoint (PATCH /api/cars/:id/status)
  app.patch('/api/cars/:id/status', requireAdminAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const rawId = req.params.id;
    if (!rawId) {
      res.status(400).json({ success: false, error: 'Avtomobil ID tələb olunur' });
      return;
    }

    const carId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    const nextStatus: 'active' | 'sold' = req.body.status === 'sold' ? 'sold' : 'active';

    const supabase = getServerSupabase();
    if (!supabase) {
      console.error('Supabase client unavailable during status update in PATCH /api/cars/:id/status');
      res.status(502).json({
        success: false,
        error: 'Məlumat bazasına qoşulmaq mümkün olmadı. Supabase konfiqurasiyasını yoxlayın və ya administratorla əlaqə saxlayın.'
      });
      return;
    }

    try {
      // Atomic single-row update touching ONLY this car's status
      const { error: sbErr } = await supabase
        .from('cars')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', carId);

      if (sbErr) {
        console.error('Supabase status update error in PATCH /api/cars/:id/status:', sbErr.message, sbErr);
        res.status(502).json({
          success: false,
          error: `Məlumat bazasına yazıla bilmədi: ${sbErr.message}. Zəhmət olmasa bir azdan yenidən cəhd edin və ya administratorla əlaqə saxlayın.`
        });
        return;
      }

      const authoritativeCars = await refreshDiskCacheFromSupabase(supabase);
      res.json({ success: true, carId, status: nextStatus, cars: authoritativeCars });
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Supabase status error';
      console.error('Supabase status update exception in PATCH /api/cars/:id/status:', msg, err);
      res.status(502).json({
        success: false,
        error: `Məlumat bazasında gözlənilməz xəta: ${msg}. Zəhmət olmasa bir azdan yenidən cəhd edin.`
      });
      return;
    }
  });

  // Protected: Delete car endpoint with Supabase Storage and DB cleanup
  app.delete('/api/cars/:id', requireAdminAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const rawId = req.params.id;
    if (!rawId) {
      res.status(400).json({ success: false, error: 'Avtomobil ID tələb olunur' });
      return;
    }

    const carId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);

    const supabase = getServerSupabase();
    if (!supabase) {
      console.error('Supabase client unavailable during delete in DELETE /api/cars/:id');
      res.status(502).json({
        success: false,
        error: 'Məlumat bazasına qoşulmaq mümkün olmadı. Supabase konfiqurasiyasını yoxlayın və ya administratorla əlaqə saxlayın.'
      });
      return;
    }

    try {
      // Get car images first for storage cleanup
      const { data: dbCar } = await supabase
        .from('cars')
        .select('primary_image, images')
        .eq('id', carId)
        .maybeSingle();

      if (dbCar) {
        const allImages: string[] = [];
        if (dbCar.primary_image) allImages.push(dbCar.primary_image);
        if (Array.isArray(dbCar.images)) allImages.push(...dbCar.images);

        const paths: string[] = [];
        for (const imgUrl of allImages) {
          if (!imgUrl || typeof imgUrl !== 'string') continue;
          const match = imgUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/[^/?#]+\/(.+)$/i);
          if (match && match[1]) {
            const p = decodeURIComponent(match[1]);
            paths.push(p);
            if (p.startsWith('cars/')) paths.push(p.replace(/^cars\//, ''));
            else paths.push(`cars/${p}`);

            // Also clean up associated thumbnail
            if (!p.includes('__thumb.')) {
              const dot = p.lastIndexOf('.');
              if (dot !== -1) {
                const thumbP = `${p.substring(0, dot)}__thumb.webp`;
                paths.push(thumbP);
                if (thumbP.startsWith('cars/')) paths.push(thumbP.replace(/^cars\//, ''));
                else paths.push(`cars/${thumbP}`);
              }
            }
          }
        }

        if (paths.length > 0) {
          await supabase.storage.from('CAR-IMAGES').remove(paths).catch(() => {});
          await supabase.storage.from('car-images').remove(paths).catch(() => {});
          await supabase.storage.from('cars').remove(paths).catch(() => {});
          await supabase.storage.from(STORAGE_BUCKET_NAME).remove(paths).catch(() => {});
        }
      }

      // Atomic delete of targeted DB row
      const { error: sbErr } = await supabase.from('cars').delete().eq('id', carId);
      if (sbErr) {
        console.error('Server Supabase car delete sync error:', sbErr.message, sbErr);
        res.status(502).json({
          success: false,
          error: `Məlumat bazasından silinmə uğursuz oldu: ${sbErr.message}. Zəhmət olmasa yenidən cəhd edin.`
        });
        return;
      }

      // Re-fetch authoritative list from Supabase and refresh disk cache
      const authoritativeCars = await refreshDiskCacheFromSupabase(supabase);
      res.json({ success: true, message: 'Avtomobil uğurla silindi', cars: authoritativeCars });
    } catch (err: unknown) {
      console.error('Server car delete error:', err);
      const msg = err instanceof Error ? err.message : 'Silinmə zamanı xəta baş verdi';
      res.status(502).json({ success: false, error: `Silinmə zamanı xəta baş verdi: ${msg}` });
    }
  });

  // Protected: Delete uploaded image(s) from Supabase Storage and local storage
  app.delete('/api/upload-image', requireAdminAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const { urls, filePaths } = req.body || {};
      const itemsToDelete = Array.isArray(urls) ? urls : Array.isArray(filePaths) ? filePaths : [];

      if (itemsToDelete.length === 0) {
        res.status(400).json({ error: 'Silinəcək şəkil siyahısı tələb olunur' });
        return;
      }

      const paths: string[] = [];
      const localFiles: string[] = [];

      for (const item of itemsToDelete) {
        if (!item || typeof item !== 'string') continue;
        const cleanItem = item.split('?')[0].split('#')[0].trim();
        if (!cleanItem) continue;

        // Check if local file
        if (cleanItem.includes('/pics/uploads/')) {
          const localFileName = cleanItem.split('/pics/uploads/')[1];
          if (localFileName) {
            const cleanLocal = localFileName.replace(/[^a-zA-Z0-9._-]/g, '');
            localFiles.push(cleanLocal);
            if (!cleanLocal.includes('__thumb.')) {
              const dot = cleanLocal.lastIndexOf('.');
              if (dot !== -1) {
                localFiles.push(`${cleanLocal.substring(0, dot)}__thumb.webp`);
              }
            }
          }
        }

        // Check if Supabase Storage URL or path
        const match = cleanItem.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/[^/?#]+\/(.+)$/i);
        if (match && match[1]) {
          const p = decodeURIComponent(match[1]);
          paths.push(p);
          if (p.startsWith('cars/')) paths.push(p.replace(/^cars\//, ''));
          else paths.push(`cars/${p}`);

          if (!p.includes('__thumb.')) {
            const dot = p.lastIndexOf('.');
            if (dot !== -1) {
              const thumbP = `${p.substring(0, dot)}__thumb.webp`;
              paths.push(thumbP);
              if (thumbP.startsWith('cars/')) paths.push(thumbP.replace(/^cars\//, ''));
              else paths.push(`cars/${thumbP}`);
            }
          }
        } else if (!cleanItem.startsWith('http') && !cleanItem.startsWith('/')) {
          paths.push(cleanItem);
          if (cleanItem.startsWith('cars/')) paths.push(cleanItem.replace(/^cars\//, ''));
          else paths.push(`cars/${cleanItem}`);

          if (!cleanItem.includes('__thumb.')) {
            const dot = cleanItem.lastIndexOf('.');
            if (dot !== -1) {
              const thumbItem = `${cleanItem.substring(0, dot)}__thumb.webp`;
              paths.push(thumbItem);
              if (thumbItem.startsWith('cars/')) paths.push(thumbItem.replace(/^cars\//, ''));
              else paths.push(`cars/${thumbItem}`);
            }
          }
        }
      }

      // 1. Delete from Supabase Storage using server credentials
      const supabase = getServerSupabase();
      if (supabase && paths.length > 0) {
        await supabase.storage.from('CAR-IMAGES').remove(paths).catch(() => {});
        await supabase.storage.from('car-images').remove(paths).catch(() => {});
        await supabase.storage.from('cars').remove(paths).catch(() => {});
        await supabase.storage.from(STORAGE_BUCKET_NAME).remove(paths).catch(() => {});
      }

      // 2. Delete local files if any
      for (const localFile of localFiles) {
        try {
          const filePath = path.join(process.cwd(), 'public', 'pics', 'uploads', localFile);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fErr) {
          console.warn('Local file delete warning:', fErr);
        }
      }

      res.json({ success: true, message: 'Şəkillər uğurla silindi' });
    } catch (err: unknown) {
      console.error('Image delete error:', err);
      res.status(500).json({ error: 'Şəkillərin silinməsi zamanı xəta baş verdi' });
    }
  });

  // Protected: Multiple image upload helper endpoint (Supabase Storage First with Magic Byte Inspection)
  app.post('/api/upload-image', express.json({ limit: '50mb' }), requireAdminAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const { dataUrl, filename, storagePath: clientStoragePath, exactFilename } = req.body;
      if (!dataUrl) {
        res.status(400).json({ error: 'dataUrl tələb olunur' });
        return;
      }

      // If it's already an HTTP URL, return as-is
      if (dataUrl.startsWith('http') || (dataUrl.startsWith('/') && !dataUrl.startsWith('data:'))) {
        res.json({ url: dataUrl, success: true });
        return;
      }

      // Parse base64
      const matches = dataUrl.match(/^data:image\/([A-Za-z0-9-+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        res.status(400).json({ error: 'Düzgün şəkil formatı deyil' });
        return;
      }

      const rawExt = matches[1].toLowerCase().replace('jpeg', 'jpg');
      const extension = ['jpg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
      const buffer = Buffer.from(matches[2], 'base64');

      // Maximum 15MB file size limit
      if (buffer.length > 15 * 1024 * 1024) {
        res.status(413).json({ error: 'Fayl həcmi 15MB-dan artıq ola bilməz' });
        return;
      }

      // Magic Byte inspection: Verify the payload is a genuine image (no SVG bypass)
      if (!isValidImageBuffer(buffer)) {
        res.status(400).json({ error: 'Yalnız etibarlı şəkil formatları (JPEG, PNG, WebP, GIF) qəbul edilir' });
        return;
      }

      let storagePath: string;
      if (clientStoragePath && typeof clientStoragePath === 'string') {
        const cleanPath = clientStoragePath.replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/\.\./g, '');
        storagePath = cleanPath.startsWith('cars/') ? cleanPath : `cars/${cleanPath}`;
      } else if (exactFilename && filename && typeof filename === 'string') {
        const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.\./g, '');
        storagePath = `cars/${cleanName}`;
      } else {
        const cleanName = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, '_') : `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
        storagePath = `cars/${Date.now()}_${cleanName}`;
      }

      // 1. Try Supabase Storage upload
      const supabase = getServerSupabase();
      let lastUploadError: unknown = null;
      if (supabase) {
        try {
          const contentType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
          const { error: upErr } = await supabase.storage
            .from(STORAGE_BUCKET_NAME)
            .upload(storagePath, buffer, {
              contentType,
              upsert: true
            });

          if (!upErr) {
            const { data: pubData } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              res.json({ url: pubData.publicUrl, success: true, storage: 'supabase' });
              return;
            }
          } else {
            lastUploadError = upErr;
            console.warn(`Supabase storage upload error on ${STORAGE_BUCKET_NAME}:`, upErr.message);
            // Secondary attempt with leaf name directly
            const leafName = path.basename(storagePath);
            const { error: retryErr } = await supabase.storage
              .from(STORAGE_BUCKET_NAME)
              .upload(leafName, buffer, {
                contentType,
                upsert: true
              });
            if (!retryErr) {
              const { data: fbData } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(leafName);
              if (fbData?.publicUrl) {
                res.json({ url: fbData.publicUrl, success: true, storage: 'supabase' });
                return;
              }
            } else {
              lastUploadError = retryErr;
            }
          }
        } catch (sbStorageErr) {
          lastUploadError = sbStorageErr;
          console.warn('Supabase storage exception:', sbStorageErr);
        }
      }

      console.error('Supabase storage upload failed:', lastUploadError);
      res.status(503).json({ success: false, error: 'Şəkil yaddaşına yüklənmə uğursuz oldu. Zəhmət olmasa bir azdan yenidən cəhd edin.' });
      return;
    } catch (err: unknown) {
      console.error('Image upload failed:', err);
      res.status(500).json({ error: 'Şəkil yüklənmədi' });
    }
  });

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Kosalar Auto API' });
  });

  // Session verification endpoint for admin UI
  app.get('/api/admin/check-session', requireAdminAuth, (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ success: true, authenticated: true });
  });

  // Secure Server-side Admin Verification with Rate Limiting & Constant-time Comparison
  app.post('/api/admin/verify', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown').split(',')[0].trim();
      const rateLimit = checkLoginRateLimit(clientIp);
      if (!rateLimit.allowed) {
        res.status(429).json({
          success: false,
          error: `Həddindən artıq yanlış cəhd! Təhlükəsizlik məqsədilə zəhmət olmasa ${rateLimit.waitSeconds} saniyə gözləyin.`
        });
        return;
      }

      // Thwart timing analysis and brute-force automation
      await new Promise(r => setTimeout(r, 350));

      const { password, email } = req.body || {};
      if (!password || typeof password !== 'string') {
        recordFailedLogin(clientIp);
        res.status(400).json({ success: false, error: 'Şifrə daxil edilməyib' });
        return;
      }

      const cleanPassword = password.trim();

      // 1. Supabase Auth authentication if email was provided
      if (email && typeof email === 'string') {
        const supabase = getServerSupabase();
        if (supabase) {
          try {
            const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password: cleanPassword
            });
            if (!authErr && authData?.session && authData.user) {
              const userRole = authData.user.app_metadata?.role || authData.user.user_metadata?.role || '';
              const adminEmailEnv = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
              const isAllowlistedEmail = adminEmailEnv && authData.user.email?.toLowerCase() === adminEmailEnv;
              const isAdminRole = userRole === 'admin';

              if (isAdminRole || isAllowlistedEmail) {
                resetLoginAttempts(clientIp);
                const sessionToken = createAdminSessionToken();
                res.json({
                  success: true,
                  authType: 'supabase_auth',
                  token: sessionToken,
                  user: {
                    id: authData.user.id,
                    email: authData.user.email
                  }
                });
                return;
              } else {
                recordFailedLogin(clientIp);
                res.status(403).json({
                  success: false,
                  error: 'Giriş qadağandır: Bu Supabase hesabı admin səlahiyyətinə malik deyil.'
                });
                return;
              }
            }
          } catch (sbAuthErr) {
            console.warn('Supabase auth signIn error:', sbAuthErr);
          }
        }
      }

      // 2. Server-side Environment Variable verification with constant-time comparison (FAIL-CLOSED)
      const validAdminPass = process.env.ADMIN_PASSWORD || process.env.KOSALAR_ADMIN_PASS;
      if (!validAdminPass) {
        console.error('[SECURITY ALERT] Login attempt rejected: ADMIN_PASSWORD environment variable is not configured on server!');
        recordFailedLogin(clientIp);
        res.status(503).json({
          success: false,
          error: 'Sistem xətası: Admin şifrəsi server mühitində təyin edilməyib (ADMIN_PASSWORD tələb olunur). Zəhmət olmasa hosting panelində ADMIN_PASSWORD təyin edin.'
        });
        return;
      }

      const isMatch = safeComparePasswords(cleanPassword, validAdminPass);

      if (isMatch) {
        resetLoginAttempts(clientIp);
        const sessionToken = createAdminSessionToken();

        res.json({
          success: true,
          authType: 'server_env',
          token: sessionToken,
          expiresIn: 86400 // 24 hours
        });
        return;
      }

      recordFailedLogin(clientIp);
      res.status(401).json({
        success: false,
        error: 'Daxil edilən şifrə yanlışdır! Zəhmət olmasa təkrar yoxlayın.'
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Admin verify error:', errMsg);
      res.status(500).json({ success: false, error: 'Təsdiqləmə zamanı daxili server xətası baş verdi' });
    }
  });

  // Global express error handler to prevent crashing
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express server caught error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Daxili server xətası' });
    }
  });

  // Vite middleware for dev or static server for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/pics')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (!fs.existsSync(indexPath)) {
          return next();
        }
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const html = injectInitialCarsIntoHtml(template);
        res.status(200).set({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }).send(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      try {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          const template = fs.readFileSync(indexPath, 'utf-8');
          const html = injectInitialCarsIntoHtml(template);
          res.status(200).set({
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
          }).send(html);
          return;
        }
      } catch (e) {
        console.warn('Could not inject cars into production index.html:', e);
      }
      res.set('Cache-Control', 'no-cache').sendFile(path.join(distPath, 'index.html'));
    });
  }

  const configuredAdminPass = process.env.ADMIN_PASSWORD || process.env.KOSALAR_ADMIN_PASS;
  if (!configuredAdminPass) {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️  [TƏHLÜKƏSİZLİK XƏBƏRDARLIĞI] ADMIN_PASSWORD və ya KOSALAR_ADMIN_PASS mühit dəyişəni təyin edilməyib!');
    console.warn('\x1b[33m%s\x1b[0m', '   Admin paneli qapalıdır (Fail-Closed). Zəhmət olmasa hosting/server parametrlərində ADMIN_PASSWORD dəyişənini daxil edin.');
  }

  // Supabase environment variables startup validation
  const startRawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const startNormUrl = normalizeSupabaseUrl(startRawUrl);
  const startKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!startNormUrl || !startKey) {
    const missing: string[] = [];
    if (!startNormUrl) missing.push('SUPABASE_URL (və ya VITE_SUPABASE_URL)');
    if (!startKey) missing.push('SUPABASE_ANON_KEY (və ya SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY)');
    console.warn('\x1b[33m%s\x1b[0m', `⚠️  [SUPABASE XƏBƏRDARLIĞI] Supabase mühit dəyişənləri təyin edilməyib: ${missing.join(', ')}`);
    console.warn('\x1b[33m%s\x1b[0m', '   Supabase əlaqəsi deaktivdir. Server yerli disk-keş (data/cars.json) rejimində davam edir.');
  } else {
    console.log(`✅ Supabase konfiqurasiyası mühit dəyişənlərindən təyin edildi (${startNormUrl})`);
  }

  // Pre-warm disk cache in background from Supabase if configured
  const bgSupabase = getServerSupabase();
  if (bgSupabase) {
    refreshDiskCacheFromSupabase(bgSupabase).catch(err => {
      console.warn('Initial server background cache refresh failed:', err);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// Process-level crash prevention
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught safely:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection caught safely at:', promise, 'reason:', reason);
});

startServer().catch((err) => {
  console.error('Fatal startServer error:', err);
});
