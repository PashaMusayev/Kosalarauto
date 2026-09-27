/**
 * Client-Side Image Compression & Optimization Utility
 * 
 * Automatically downscales large phone camera photos (5-15MB) to:
 * - Max dimension: 1200px (preserving aspect ratio)
 * - Modern WebP format (image/webp) with JPEG fallback
 * - Target file size: ~150KB - 400KB (75-80% quality)
 * - Drastically accelerates upload to Supabase Storage by 10x
 * - Delivers instantaneous slide transitions and mobile performance
 */

import { 
  detectImageFormatFromBuffer, 
  getImageDimensionsFromHeader, 
  ImageFormatInfo 
} from './imageFormatDetector';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0 (default: 0.78)
  preferredMimeType?: 'image/webp' | 'image/jpeg';
  maxSizeBytes?: number; // default: 480KB
  formatInfo?: ImageFormatInfo;
}

export interface CompressionResult {
  file: File;
  blob: Blob;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  originalSizeFormatted: string;
  compressedSizeFormatted: string;
  savedPercent: number;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Format bytes to readable string (e.g., "3.4 MB", "280 KB")
 */
export function formatFileSize(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Checks whether the current browser supports export to image/webp via Canvas
 */
let cachedWebpSupported: boolean | null = null;
export function isWebpSupported(): boolean {
  if (cachedWebpSupported !== null) return cachedWebpSupported;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL('image/webp');
    cachedWebpSupported = dataUrl.startsWith('data:image/webp');
    return cachedWebpSupported;
  } catch (e) {
    cachedWebpSupported = false;
    return false;
  }
}

/**
 * Feature detection for createImageBitmap with resize options
 */
let hasCreateImageBitmapResizeSupport: boolean | null = null;
async function supportsCreateImageBitmapResize(): Promise<boolean> {
  if (hasCreateImageBitmapResizeSupport !== null) return hasCreateImageBitmapResizeSupport;
  if (typeof createImageBitmap !== 'function') {
    hasCreateImageBitmapResizeSupport = false;
    return false;
  }
  try {
    // 1x1 transparent PNG
    const testBlob = new Blob([
      new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
      ])
    ], { type: 'image/png' });

    const bmp = await (createImageBitmap as any)(testBlob, { 
      resizeWidth: 2, 
      resizeHeight: 2, 
      resizeQuality: 'high',
      imageOrientation: 'from-image'
    });
    const supported = bmp.width === 2;
    bmp.close();
    hasCreateImageBitmapResizeSupport = supported;
    return supported;
  } catch (e) {
    hasCreateImageBitmapResizeSupport = false;
    return false;
  }
}

/**
 * Loads an image from a File, Blob, or Data URL safely via HTMLImageElement
 */
function loadImageElement(fileOrBlobOrUrl: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrl = '';
    if (typeof fileOrBlobOrUrl === 'string') {
      img.src = fileOrBlobOrUrl;
    } else {
      objectUrl = URL.createObjectURL(fileOrBlobOrUrl);
      img.src = objectUrl;
    }

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (e) {}
      }
    };

    img.onload = () => {
      cleanup();
      resolve(img);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error("Şəkil faylı deşifrə edilə bilmədi və ya format dəstəklənmir"));
    };
  });
}

export interface DecodedImageSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

/**
 * Determines a single constraining dimension for createImageBitmap resize options.
 * 
 * Passing only ONE resize dimension (the constraining one) lets the browser derive the
 * other dimension according to how it actually decodes and orients the image.
 * This ensures that if a browser ignores EXIF orientation, the resulting bitmap aspect ratio
 * will diverge from the expected aspect ratio, allowing the safety check to detect distortion.
 * 
 * - Portrait (taller): passes only resizeHeight
 * - Landscape (wider): passes only resizeWidth
 * - Square (equal): passes one dimension (resizeWidth)
 * - Smaller than max: passes neither (no upscaling)
 */
export function getSingleResizeDimension(
  width: number,
  height: number,
  maxW = 1200,
  maxH = 1200
): { resizeWidth?: number; resizeHeight?: number } {
  // If the image is smaller than or equal to the max bounds, do not upscale
  if (width <= maxW && height <= maxH) {
    return {};
  }

  // Constraining dimension:
  // If height / maxH > width / maxW, height is more constraining (e.g. portrait)
  if (height / maxH > width / maxW) {
    return { resizeHeight: maxH };
  } else {
    // Width is more constraining (or equal, e.g. landscape or square)
    return { resizeWidth: maxW };
  }
}

/**
 * Layered decoding pipeline with fallbacks:
 * a. createImageBitmap with single-dimension resize (memory efficient for 108MP+)
 * b. createImageBitmap without options
 * c. HTMLImageElement via object URL (native browser decoder)
 * d. HEIC/HEIF fallback via dynamically imported heic2any inside admin
 */
export async function decodeImageWithFallbacks(
  blob: Blob,
  formatInfo?: ImageFormatInfo,
  maxW = 1200,
  maxH = 1200
): Promise<DecodedImageSource> {
  let lastError: Error | null = null;

  // Step a: createImageBitmap with single constraining resize dimension
  if (typeof createImageBitmap === 'function') {
    try {
      const canResize = await supportsCreateImageBitmapResize();
      if (canResize) {
        // Read up to 128KB header slice to cover large APP1 segments with embedded thumbnails
        const slice = blob.slice(0, 131072);
        const headerBytes = new Uint8Array(await slice.arrayBuffer());
        const dims = getImageDimensionsFromHeader(headerBytes);
        if (dims && dims.width > 0 && dims.height > 0) {
          const singleDim = getSingleResizeDimension(dims.width, dims.height, maxW, maxH);
          const resizeOptions: any = {
            resizeQuality: 'high',
            imageOrientation: 'from-image'
          };
          if (singleDim.resizeWidth) {
            resizeOptions.resizeWidth = singleDim.resizeWidth;
          }
          if (singleDim.resizeHeight) {
            resizeOptions.resizeHeight = singleDim.resizeHeight;
          }

          const bmp = await (createImageBitmap as any)(blob, resizeOptions);

          // Safety check (defense in depth):
          // Compare actual bitmap aspect ratio (width/height) to the expected aspect ratio of the oriented source.
          // Because only ONE constraining dimension was passed, the browser derived the other dimension.
          // If the browser oriented the image differently than expected (e.g. ignored orientation),
          // actualAspect and expectedAspect will diverge by ~78%, the check fires, and we fall back to Step b.
          const expectedAspect = dims.width / dims.height;
          const actualAspect = bmp.width / bmp.height;
          const aspectDiff = Math.abs(actualAspect - expectedAspect) / expectedAspect;

          if (aspectDiff > 0.02) {
            console.warn(
              `createImageBitmap resize produced distorted aspect ratio (${actualAspect.toFixed(3)} vs expected ${expectedAspect.toFixed(3)}). Discarding and falling back to natural decode.`
            );
            bmp.close();
            // Fall through to Step b
          } else {
            return {
              source: bmp,
              width: bmp.width,
              height: bmp.height,
              close: () => bmp.close()
            };
          }
        }
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // Step b: createImageBitmap without options (preserves natural aspect ratio on canvas)
    try {
      const bmp = await (createImageBitmap as any)(blob, {
        imageOrientation: 'from-image'
      });
      return {
        source: bmp,
        width: bmp.width,
        height: bmp.height,
        close: () => bmp.close()
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // Step c: HTMLImageElement from object URL (handles JPEG, PNG, WebP, GIF, and iPhone Safari native HEIC)
  try {
    const img = await loadImageElement(blob);
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    };
  } catch (err: unknown) {
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  // Step d: HEIC/HEIF fallback via dynamic heic2any import
  if (formatInfo?.isHeic) {
    try {
      const heic2anyModule = await import('heic2any');
      const heic2any = (heic2anyModule as any).default || heic2anyModule;
      const converted = await heic2any({
        blob,
        toType: 'image/jpeg',
        quality: 0.85
      });
      const jpegBlob = Array.isArray(converted) ? converted[0] : converted;

      // Decode converted JPEG with imageOrientation: 'from-image'
      if (typeof createImageBitmap === 'function') {
        try {
          const bmp = await (createImageBitmap as any)(jpegBlob, {
            imageOrientation: 'from-image'
          });
          return {
            source: bmp,
            width: bmp.width,
            height: bmp.height,
            close: () => bmp.close()
          };
        } catch (e) {}
      }
      const img = await loadImageElement(jpegBlob);
      return {
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      };
    } catch (heicErr: unknown) {
      const hMsg = heicErr instanceof Error ? heicErr.message : String(heicErr);
      throw new Error(`HEIC formatı çevrilə bilmədi: ${hMsg}`);
    }
  }

  throw lastError || new Error("Şəkil faylı deşifrə edilə bilmədi");
}

/**
 * Calculate scaled dimensions fitting within maxWidth and maxHeight,
 * maintaining the exact aspect ratio without upscaling.
 */
export function calculateTargetDimensions(
  origW: number,
  origH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  let targetW = origW;
  let targetH = origH;

  if (targetW > maxW || targetH > maxH) {
    const ratio = Math.min(maxW / targetW, maxH / targetH);
    targetW = Math.round(targetW * ratio);
    targetH = Math.round(targetH * ratio);
  }

  // Ensure minimum dimensions of at least 1px
  targetW = Math.max(1, targetW);
  targetH = Math.max(1, targetH);

  return { width: targetW, height: targetH };
}

/**
 * Renders an image source to a canvas with high-quality smoothing and returns a Blob
 */
function renderCanvasToBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        resolve(null);
        return;
      }

      // Smooth filtering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // White background fallback for transparent source PNGs
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Draw the image
      ctx.drawImage(source, 0, 0, width, height);

      canvas.toBlob(
        (blob) => resolve(blob),
        mimeType,
        quality
      );
    } catch (e) {
      console.warn('Canvas render to blob warning:', e);
      resolve(null);
    }
  });
}

/**
 * Compresses an image File or Blob to WebP (or JPEG fallback)
 * with max dimensions of 1200px and optimal quality (75-80%).
 * Uses layered decode fallbacks (createImageBitmap, HTMLImageElement, heic2any).
 */
export async function compressImage(
  input: File | Blob,
  fileName?: string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const maxW = options.maxWidth || 1200;
  const maxH = options.maxHeight || 1200;
  const quality = options.quality ?? 0.78; // 78% balanced quality
  const targetMaxBytes = options.maxSizeBytes || 480 * 1024; // 480KB limit

  const originalSize = input.size;
  const origName = fileName || (input as File).name || `photo_${Date.now()}`;

  // Determine format info
  let formatInfo = options.formatInfo;
  if (!formatInfo) {
    try {
      const slice = input.slice(0, 131072);
      const headerBytes = new Uint8Array(await slice.arrayBuffer());
      formatInfo = detectImageFormatFromBuffer(headerBytes);
      if (
        !formatInfo.isHeic &&
        (origName.toLowerCase().endsWith('.heic') ||
         origName.toLowerCase().endsWith('.heif') ||
         (input.type && input.type.toLowerCase().includes('heic')))
      ) {
        formatInfo.isHeic = true;
        formatInfo.format = 'heic';
      }
    } catch (e) {
      // Fallback
    }
  }

  // Determine MIME type (prefer WebP)
  const canUseWebp = isWebpSupported() && options.preferredMimeType !== 'image/jpeg';
  const targetMime = canUseWebp ? 'image/webp' : 'image/jpeg';
  const targetExt = canUseWebp ? 'webp' : 'jpg';

  // Decode image via layered fallbacks
  const decoded = await decodeImageWithFallbacks(input, formatInfo, maxW, maxH);
  const { width: origWidth, height: origHeight } = decoded;

  try {
    // Pass 1: Scale to target dimensions (max 1200px)
    let { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
      origWidth,
      origHeight,
      maxW,
      maxH
    );

    let blob = await renderCanvasToBlob(decoded.source, targetWidth, targetHeight, targetMime, quality);

    // Fallback to JPEG if WebP was not generated
    if (!blob && targetMime === 'image/webp') {
      blob = await renderCanvasToBlob(decoded.source, targetWidth, targetHeight, 'image/jpeg', quality);
    }

    // Pass 2: If still exceeds targetMaxBytes (e.g., heavily detailed image), reduce quality slightly
    if (blob && blob.size > targetMaxBytes) {
      const reducedQuality = Math.max(0.68, quality - 0.1);
      const reducedDims = calculateTargetDimensions(origWidth, origHeight, Math.min(1080, maxW), Math.min(1080, maxH));
      const pass2Blob = await renderCanvasToBlob(
        decoded.source,
        reducedDims.width,
        reducedDims.height,
        blob.type || targetMime,
        reducedQuality
      );
      if (pass2Blob && pass2Blob.size < blob.size) {
        blob = pass2Blob;
        targetWidth = reducedDims.width;
        targetHeight = reducedDims.height;
      }
    }

    // If compression failed completely, throw descriptive error so caller marks it failed or uses final fallback
    if (!blob) {
      throw new Error("Şəkli sıxmaq (WebP/JPEG) mümkün olmadı");
    }

    // Generate clean new filename with .webp or .jpg extension
    const baseName = origName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const finalFileName = `${baseName}.${targetExt}`;

    const compressedFile = new File([blob], finalFileName, {
      type: blob.type || targetMime,
      lastModified: Date.now()
    });

    const previewUrl = URL.createObjectURL(blob);
    const compressedSize = blob.size;
    const savedPercent = originalSize > 0 
      ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
      : 0;

    return {
      file: compressedFile,
      blob,
      previewUrl,
      originalSize,
      compressedSize,
      originalSizeFormatted: formatFileSize(originalSize),
      compressedSizeFormatted: formatFileSize(compressedSize),
      savedPercent,
      width: targetWidth,
      height: targetHeight,
      mimeType: blob.type || targetMime
    };
  } finally {
    // Release bitmap / image memory
    decoded.close?.();
  }
}

/**
 * Batch compresses a list of files with progress tracking
 */
export async function compressImageFiles(
  files: File[],
  onProgress?: (index: number, total: number, result?: CompressionResult) => void,
  options?: CompressionOptions
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    try {
      const res = await compressImage(file, file.name, options);
      results.push(res);
      if (onProgress) {
        onProgress(i + 1, total, res);
      }
    } catch (err) {
      console.error(`Failed to compress ${file.name}:`, err);
      // Fallback: use original file wrapped as CompressionResult
      const previewUrl = URL.createObjectURL(file);
      const fallbackResult: CompressionResult = {
        file,
        blob: file,
        previewUrl,
        originalSize: file.size,
        compressedSize: file.size,
        originalSizeFormatted: formatFileSize(file.size),
        compressedSizeFormatted: formatFileSize(file.size),
        savedPercent: 0,
        width: 1200,
        height: 900,
        mimeType: file.type || 'image/jpeg'
      };
      results.push(fallbackResult);
      if (onProgress) {
        onProgress(i + 1, total, fallbackResult);
      }
    }
  }

  return results;
}

/**
 * Produces an optimized thumbnail image:
 * max 800px on the long side (short side ~600px for 4:3), WebP quality ~0.80 (target roughly 50-100KB).
 */
export async function createThumbnail(
  input: File | Blob,
  fileName?: string,
  options: Partial<CompressionOptions> = {}
): Promise<CompressionResult> {
  return compressImage(input, fileName || 'thumb.webp', {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.80,
    maxSizeBytes: 120 * 1024,
    preferredMimeType: 'image/webp',
    ...options
  });
}

