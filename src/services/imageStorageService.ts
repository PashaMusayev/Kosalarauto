/**
 * Image & Storage operations module
 */
import { STORAGE_BUCKET_NAME } from './supabaseClientInit';
import { getAdminAuthHeaders } from './adminAuthService';
import { getThumbnailUrl } from '../utils/imageFallback';
import { createThumbnail, CompressionResult } from '../utils/imageCompressor';

/**
 * Helper to check whether an image URL is already hosted in our Supabase Storage
 */
export function isSupabaseStorageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.includes('.supabase.co/storage/v1/object/') ||
    clean.includes('/storage/v1/object/public/car-images') ||
    clean.includes('/storage/v1/object/public/car-images/') ||
    clean.includes('/storage/v1/object/public/cars') ||
    clean.includes('/car-images/cars/')
  );
}

/**
 * Downloads an external image from a URL as a Blob
 * Tries direct CORS fetch, then transparent CORS proxy fallbacks.
 * If CORS or network error prevents downloading, throws a clear user-facing error message:
 * "Bu linkdən şəkli endirmək mümkün olmadı, zəhmət olmasa şəkli kompyuterinizdən yükləyin"
 */
export async function downloadExternalImageAsBlob(
  url: string,
  timeoutMs = 12000
): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new Error('Düzgün şəkil linki daxil edin (http:// və ya https:// ilə başlamalıdır)');
  }

  // 1. First attempt: Direct fetch
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(trimmed, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal
    });
    clearTimeout(timer);

    if (response.ok) {
      const blob = await response.blob();
      if (blob && blob.size > 50) {
        let mimeType = blob.type || 'image/jpeg';
        let extension = 'jpg';
        if (mimeType.includes('png')) extension = 'png';
        else if (mimeType.includes('webp')) extension = 'webp';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
        else if (mimeType.includes('gif')) extension = 'gif';
        else if (mimeType.includes('avif')) extension = 'avif';
        return { blob, mimeType, extension };
      }
    }
  } catch (err) {
    console.warn('Direct fetch failed (likely CORS restriction or network error), trying fallback...', err);
  }

  // 2. Second attempt: Transparent CORS image proxy fallback
  const cleanEncUrl = encodeURIComponent(trimmed);
  const proxies = [
    `https://images.weserv.nl/?url=${cleanEncUrl}`,
    `https://api.allorigins.win/raw?url=${cleanEncUrl}`
  ];

  for (const proxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 100) {
          let mimeType = blob.type || 'image/jpeg';
          let extension = 'jpg';
          if (mimeType.includes('png')) extension = 'png';
          else if (mimeType.includes('webp')) extension = 'webp';
          else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
          return { blob, mimeType, extension };
        }
      }
    } catch (proxyErr) {
      console.warn(`Proxy attempt failed (${proxyUrl}):`, proxyErr);
    }
  }

  // 3. User-mandated error message when CORS / fetch fails
  throw new Error("Bu linkdən şəkli endirmək mümkün olmadı, zəhmət olmasa şəkli kompyuterinizdən yükləyin");
}

/**
 * Safe helper to read Blob/File as Data URL, converting ProgressEvent / DOMException into descriptive Errors
 */
function readFileAsDataUrl(blobOrFile: Blob | File, filename?: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error("Şəkil faylının oxunması uğursuz oldu"));
      }
    };
    reader.onerror = () => {
      const domErr = reader.error;
      const name = domErr?.name || '';
      if (name === 'NotReadableError') {
        reject(new Error("Bu şəkil telefonda oxuna bilmədi. Şəkli qalereyadan (məs. Google Photos) əvvəlcə cihaza endirin və yenidən seçin."));
      } else if (name === 'NotFoundError') {
        reject(new Error("Fayl tapılmadı və ya cihaza tam yüklənməyib."));
      } else if (name === 'SecurityError') {
        reject(new Error("Faylı oxumağa icazə verilmədi."));
      } else {
        const detail = domErr?.message || (filename ? `${filename} faylı oxuna bilmədi` : 'Fayl oxunarkən xəta baş verdi');
        reject(new Error(detail));
      }
    };
    reader.onabort = () => {
      reject(new Error("Fayl oxunması dayandırıldı"));
    };
    reader.readAsDataURL(blobOrFile);
  });
}

/**
 * Upload image (File, Blob, or base64 dataUrl) directly to Supabase Storage 'car-images' bucket
 * Includes automatic retry mechanism, extended timeout (30s), and fallback across candidate buckets
 */
export async function uploadImageToSupabaseStorage(
  fileOrData: File | Blob | string,
  fileName?: string,
  maxRetries = 2,
  storagePath?: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    let dataUrl: string;

    if (typeof fileOrData === 'string') {
      if (fileOrData.startsWith('data:')) {
        dataUrl = fileOrData;
      } else if (fileOrData.startsWith('http://') || fileOrData.startsWith('https://')) {
        if (isSupabaseStorageUrl(fileOrData)) {
          return { success: true, publicUrl: fileOrData };
        }

        try {
          const { blob } = await downloadExternalImageAsBlob(fileOrData);
          dataUrl = await readFileAsDataUrl(blob, fileName);
        } catch (downloadErr: unknown) {
          const msg = downloadErr instanceof Error ? downloadErr.message : 'Xarici şəkil linkindən endirilə bilmədi';
          return {
            success: false,
            error: msg
          };
        }
      } else {
        return { success: false, error: 'Naməlum şəkil formatı' };
      }
    } else {
      const displayName = fileName || (fileOrData instanceof File ? fileOrData.name : undefined);
      dataUrl = await readFileAsDataUrl(fileOrData, displayName);
    }

    let lastError = '';
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAdminAuthHeaders()
          },
          body: JSON.stringify({
            dataUrl,
            filename: fileName,
            storagePath
          })
        });

        const data = await res.json();
        if (res.ok && data.success && data.url) {
          return { success: true, publicUrl: data.url };
        }

        lastError = data?.error || `Server xətası (${res.status})`;
      } catch (reqErr: unknown) {
        lastError = reqErr instanceof Error ? reqErr.message : 'Serverlə əlaqə qurulmadı';
      }

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    return { success: false, error: lastError || 'Şəkil yüklənmədi' };
  } catch (err: unknown) {
    console.error('Image upload exception:', err);
    let msg: string;
    if (err instanceof Error) {
      msg = err.message;
    } else if (typeof err === 'object' && err !== null) {
      const anyErr = err as Record<string, any>;
      if (anyErr?.name === 'NotReadableError' || anyErr?.target?.error?.name === 'NotReadableError') {
        msg = "Bu şəkil telefonda oxuna bilmədi. Şəkli qalereyadan (məs. Google Photos) əvvəlcə cihaza endirin və yenidən seçin.";
      } else if (anyErr?.target?.error?.message) {
        msg = anyErr.target.error.message;
      } else if (anyErr?.message) {
        msg = anyErr.message;
      } else {
        msg = "Fayl oxunarkən və ya yüklənərkən xəta baş verdi";
      }
    } else {
      msg = String(err);
    }
    if (!msg || msg === 'Naməlum xəta' || msg === '[object Object]' || msg === '[object ProgressEvent]') {
      msg = "Fayl oxunarkən və ya yüklənərkən xəta baş verdi";
    }
    return { success: false, error: `Şəkil yüklənmə xətası: ${msg}` };
  }
}

/**
 * Extracts normalized thumbnail storage path (e.g. 'cars/1788000_abc__thumb.webp') from a thumbnail URL.
 */
export function getThumbnailStoragePath(thumbUrl: string): string | null {
  if (!thumbUrl || typeof thumbUrl !== 'string') return null;
  const clean = thumbUrl.trim().split('?')[0].split('#')[0];
  const match = clean.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/[^/?#]+\/(.+)$/i);
  if (match && match[1]) {
    const decoded = decodeURIComponent(match[1]);
    return decoded.startsWith('cars/') ? decoded : `cars/${decoded}`;
  }
  if (clean.includes('/pics/uploads/')) {
    const filename = clean.split('/pics/uploads/')[1];
    return filename ? `cars/${filename}` : null;
  }
  if (clean.startsWith('cars/')) {
    return clean;
  }
  const extracted = extractStoragePathFromUrl(clean);
  if (extracted) {
    return extracted.startsWith('cars/') ? extracted : `cars/${extracted}`;
  }
  return null;
}

export interface UploadThumbnailOptions {
  isPreGeneratedThumb?: boolean;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * Generates and uploads an optimized thumbnail (max 800px WebP, quality ~0.80)
 * for a corresponding full-size image, using deterministic naming convention.
 * If sourceImage is a pre-generated thumbnail blob (single compression), uploads directly without recompression.
 */
export async function uploadThumbnailForImage(
  sourceImage: File | Blob | string,
  fullImageUrl: string,
  options: UploadThumbnailOptions = {}
): Promise<{ success: boolean; thumbUrl?: string; error?: string }> {
  try {
    const thumbUrl = getThumbnailUrl(fullImageUrl);
    if (!thumbUrl || thumbUrl === fullImageUrl) {
      return { success: false, error: 'Could not determine thumbnail URL' };
    }

    const storagePath = getThumbnailStoragePath(thumbUrl);
    if (!storagePath) {
      return { success: false, error: 'Could not extract storage path for thumbnail' };
    }

    let fileToUpload: File;

    if (options.isPreGeneratedThumb && typeof sourceImage !== 'string' && sourceImage instanceof Blob) {
      // Pre-made thumbnail from single-compression pipeline: upload directly without re-compression
      const fileName = storagePath.split('/').pop() || 'thumb.webp';
      fileToUpload = sourceImage instanceof File
        ? sourceImage
        : new File([sourceImage], fileName, { type: sourceImage.type || 'image/webp' });
    } else {
      // Generate thumbnail (max 800px, WebP quality ~0.80 by default, ~0.82 for backfill)
      const quality = options.quality ?? 0.80;
      const maxWidth = options.maxWidth ?? 800;
      const maxHeight = options.maxHeight ?? 800;

      let compRes: CompressionResult;
      if (typeof sourceImage === 'string') {
        const { blob } = await downloadExternalImageAsBlob(sourceImage);
        compRes = await createThumbnail(blob, 'thumb.webp', { quality, maxWidth, maxHeight });
      } else {
        compRes = await createThumbnail(sourceImage, 'thumb.webp', { quality, maxWidth, maxHeight });
      }
      fileToUpload = compRes.file;
    }

    const uploadRes = await uploadImageToSupabaseStorage(
      fileToUpload,
      undefined,
      2,
      storagePath
    );

    return {
      success: Boolean(uploadRes.success),
      thumbUrl: uploadRes.publicUrl || thumbUrl,
      error: uploadRes.error
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Upload thumbnail notice:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Extract relative file path and bucket inside Supabase Storage from public/signed URLs
 */
export function extractStoragePathFromUrl(urlOrPath: string, defaultBucket = STORAGE_BUCKET_NAME): string | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;

  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  // Ignore data URLs and local assets (e.g. /pics/...)
  if (trimmed.startsWith('data:') || trimmed.startsWith('/pics/') || trimmed.startsWith('blob:')) {
    return null;
  }

  // Strip query string and fragment
  const cleanUrl = trimmed.split('?')[0].split('#')[0];

  // Direct extraction for /cars/ and /car-images/ URL formats
  if (cleanUrl.includes('/cars/')) {
    const parts = cleanUrl.split('/cars/');
    const after = parts[parts.length - 1];
    if (after) return decodeURIComponent(after);
  }

  if (cleanUrl.includes('/car-images/')) {
    const parts = cleanUrl.split('/car-images/');
    const after = parts[parts.length - 1];
    if (after) return decodeURIComponent(after);
  }

  // Pattern 1: Standard Supabase Storage public/signed/authenticated URL with any bucket name
  const supabasePattern = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/?#]+)\/(.+)$/i;
  const matchSupabase = cleanUrl.match(supabasePattern);
  if (matchSupabase && matchSupabase[2]) {
    return decodeURIComponent(matchSupabase[2]);
  }

  // Pattern 2: Render image URL: /storage/v1/render/image/(public|sign|authenticated)/<bucket>/<path...>
  const renderPattern = /\/storage\/v1\/render\/image\/(?:public|sign|authenticated)\/([^/?#]+)\/(.+)$/i;
  const matchRender = cleanUrl.match(renderPattern);
  if (matchRender && matchRender[2]) {
    return decodeURIComponent(matchRender[2]);
  }

  // Pattern 3: Explicit bucket reference: /cars/... or /car-images/...
  const patternBucket = new RegExp(`^/?(?:cars|car-images|${defaultBucket})/(.+)$`, 'i');
  const matchBucket = cleanUrl.match(patternBucket);
  if (matchBucket && matchBucket[1]) {
    return decodeURIComponent(matchBucket[1]);
  }

  // Pattern 4: Relative path already inside bucket (e.g. "cars/12345_pic.jpg")
  if (cleanUrl.startsWith('cars/') && !cleanUrl.includes('://')) {
    return decodeURIComponent(cleanUrl);
  }

  // Pattern 5: Plain filename (e.g. "17400000_photo.jpg")
  if (!cleanUrl.includes('://') && !cleanUrl.startsWith('/')) {
    return decodeURIComponent(cleanUrl);
  }

  return null;
}

/**
 * Remove multiple images from Supabase Storage buckets ('cars', 'car-images')
 */
export async function deleteImagesFromSupabaseStorage(
  imageUrls: string[],
  primaryBucket = STORAGE_BUCKET_NAME
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  try {
    const res = await fetch('/api/upload-image', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminAuthHeaders()
      },
      body: JSON.stringify({ urls: imageUrls })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, deletedCount: imageUrls.length };
    }
    return { success: false, deletedCount: 0, error: data?.error || 'Şəkillər silinmədi' };
  } catch (err: unknown) {
    console.error('Image delete exception:', err);
    const msg = err instanceof Error ? err.message : 'Serverlə əlaqə xətası';
    return { success: false, deletedCount: 0, error: msg };
  }
}
