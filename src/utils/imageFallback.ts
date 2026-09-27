export const DEFAULT_VEHICLE_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="50%" stop-color="#f1f5f9" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <linearGradient id="vanBody" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#94a3b8" />
      <stop offset="100%" stop-color="#64748b" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>
  
  <!-- Light Clean Background -->
  <rect width="800" height="600" fill="url(#bgGrad)" />
  
  <!-- Subtle Grid Accent Lines -->
  <line x1="0" y1="450" x2="800" y2="450" stroke="#cbd5e1" stroke-width="1.5" opacity="0.6" />
  <line x1="0" y1="480" x2="800" y2="480" stroke="#cbd5e1" stroke-width="1" opacity="0.4" />

  <!-- Van Silhouette -->
  <g transform="translate(130, 90)">
    <!-- Soft Floor Shadow -->
    <ellipse cx="270" cy="305" rx="260" ry="18" fill="#cbd5e1" opacity="0.8" />
    
    <!-- Van Body -->
    <path d="M 30 250 
             L 30 130 
             C 30 100, 50 80, 80 80 
             L 340 80 
             L 420 145 
             L 505 155 
             C 525 160, 535 175, 535 195 
             L 535 260 
             L 490 260 
             C 490 300, 440 300, 440 260 
             L 170 260 
             C 170 300, 120 300, 120 260 
             L 30 260 Z" 
          fill="url(#vanBody)" />
          
    <!-- Side windows & partition (Clean Frosted Glass) -->
    <path d="M 345 95 L 405 145 L 345 145 Z" fill="#e2e8f0" opacity="0.9" stroke="#cbd5e1" stroke-width="2" />
    <rect x="210" y="95" width="120" height="50" rx="4" fill="#e2e8f0" opacity="0.9" stroke="#cbd5e1" stroke-width="2" />
    <rect x="80" y="95" width="115" height="50" rx="4" fill="#e2e8f0" opacity="0.9" stroke="#cbd5e1" stroke-width="2" />

    <!-- Wheels -->
    <circle cx="145" cy="260" r="38" fill="#475569" />
    <circle cx="145" cy="260" r="18" fill="#e2e8f0" />
    <circle cx="465" cy="260" r="38" fill="#475569" />
    <circle cx="465" cy="260" r="18" fill="#e2e8f0" />

    <!-- Headlight -->
    <polygon points="525,175 535,178 535,198 525,198" fill="#f59e0b" opacity="0.9" />
  </g>

  <!-- Brand Badge & Text -->
  <rect x="250" y="405" width="300" height="42" rx="21" fill="url(#badgeGrad)" />
  <text x="400" y="432" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="20" text-anchor="middle" letter-spacing="3">KOSALAR AUTO</text>
  
  <text x="400" y="480" fill="#1e293b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="18" text-anchor="middle">Ford Transit &amp; Mercedes Sprinter</text>
  <text x="400" y="512" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="14" text-anchor="middle">Şəkil hazırlanır və ya yüklənir</text>
</svg>
`)}`;

export function getValidImageUrl(url?: string, options?: { width?: number; quality?: number }): string {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return DEFAULT_VEHICLE_PLACEHOLDER;
  }
  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:') || cleanUrl.endsWith('.svg')) {
    return cleanUrl;
  }

  // Normalize bucket casing: 'CAR-IMAGES' -> 'car-images'
  if (cleanUrl.includes('supabase.co/storage/v1/')) {
    cleanUrl = cleanUrl
      .replace(/\/storage\/v1\/object\/public\/CAR-IMAGES\//i, '/storage/v1/object/public/car-images/')
      .replace(/\/storage\/v1\/render\/image\/public\/CAR-IMAGES\//i, '/storage/v1/render/image/public/car-images/');

    // If options explicitly passed, append render params
    if (options?.width || options?.quality) {
      if (cleanUrl.includes('width=') || cleanUrl.includes('quality=')) {
        return cleanUrl;
      }
      const width = options?.width ?? 800;
      const quality = options?.quality ?? 75;
      const separator = cleanUrl.includes('?') ? '&' : '?';
      return `${cleanUrl}${separator}width=${width}&quality=${quality}`;
    }

    return cleanUrl;
  }

  return cleanUrl;
}

/**
 * Version constant for thumbnails. Incrementing busts cached thumbnails across CDN and browsers.
 */
export const THUMBNAIL_VERSION = 2;

/**
 * In-memory set of thumbnail URLs that failed to load during the current browser session.
 * Prevents repeating 404 network storms on slow connections.
 */
const failedThumbnailUrls = new Set<string>();

export function markThumbnailFailed(url?: string): void {
  if (!url || typeof url !== 'string') return;
  const trimmed = url.trim();
  failedThumbnailUrls.add(trimmed);
  failedThumbnailUrls.add(trimmed.split('?')[0]);
}

export function isThumbnailFailed(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return failedThumbnailUrls.has(trimmed) || failedThumbnailUrls.has(trimmed.split('?')[0]);
}

/**
 * Deterministically derives the thumbnail URL for a given full-size car image URL.
 * Suffix convention: name.webp -> name__thumb.webp?v=2 (always .webp with cache-busting version)
 * 
 * If the thumbnail has failed during this session (recorded in failedThumbnailUrls),
 * returns the full-size URL directly without attempting the thumbnail.
 */
export function getThumbnailUrl(fullUrl?: string): string {
  if (!fullUrl || typeof fullUrl !== 'string' || fullUrl.trim() === '') {
    return DEFAULT_VEHICLE_PLACEHOLDER;
  }

  const clean = fullUrl.trim();

  // Non-image or transient formats: return as-is
  if (
    clean.startsWith('data:') ||
    clean.startsWith('blob:') ||
    clean.endsWith('.svg')
  ) {
    return clean;
  }

  // If already a thumbnail URL, ensure it has the cache-busting version parameter
  if (clean.includes('__thumb.')) {
    if (clean.includes(`v=${THUMBNAIL_VERSION}`)) {
      return clean;
    }
    const [pathPart, queryPart] = clean.split('?');
    const newQuery = queryPart ? `${queryPart}&v=${THUMBNAIL_VERSION}` : `v=${THUMBNAIL_VERSION}`;
    return `${pathPart}?${newQuery}`;
  }

  // Only apply thumbnail convention to Supabase Storage or local /pics/uploads/ paths
  const isSupabase = clean.includes('.supabase.co/storage/v1/') || clean.includes('/storage/v1/object/public/');
  const isLocalUpload = clean.includes('/pics/uploads/');
  const isBucketRelative = clean.startsWith('cars/');

  if (!isSupabase && !isLocalUpload && !isBucketRelative) {
    // External third-party URL (e.g. unsplash, external hosting): return full URL as-is
    return clean;
  }

  // Parse URL components to separate query/hash from the file path
  const [urlWithoutHash] = clean.split('#');
  const [urlWithoutQuery, query] = urlWithoutHash.split('?');

  const lastSlash = urlWithoutQuery.lastIndexOf('/');
  const lastDot = urlWithoutQuery.lastIndexOf('.');

  if (lastDot <= lastSlash) {
    // No file extension detected
    return clean;
  }

  const basePath = urlWithoutQuery.substring(0, lastDot);
  const versionParam = `v=${THUMBNAIL_VERSION}`;
  const queryStr = query ? `${query}&${versionParam}` : versionParam;
  const candidateThumbUrl = `${basePath}__thumb.webp?${queryStr}`;

  // If this thumbnail previously failed in this session, avoid re-requesting a 404
  if (isThumbnailFailed(candidateThumbUrl)) {
    return clean;
  }

  return candidateThumbUrl;
}

/**
 * Error handler specifically for thumbnail <img> elements.
 * 1. Marks candidate thumbnail URL as failed so subsequent renders bypass it.
 * 2. Attempts falling back to the full-size image URL.
 * 3. If the full-size image also fails, uses handleImageLoadError for retry/placeholder.
 */
export function handleThumbnailLoadError(
  imgElement: HTMLImageElement,
  fullUrl: string,
  fallbackSrc: string = DEFAULT_VEHICLE_PLACEHOLDER
): void {
  const currentSrc = imgElement.src || '';
  if (currentSrc) {
    markThumbnailFailed(currentSrc);
  }

  const validFullUrl = getValidImageUrl(fullUrl);
  if (validFullUrl && validFullUrl !== currentSrc) {
    // Try the full-size image
    imgElement.onerror = () => handleImageLoadError(imgElement, fallbackSrc);
    imgElement.src = validFullUrl;
    return;
  }

  handleImageLoadError(imgElement, fallbackSrc);
}

/**
 * Robust image error handler with automatic retry and bucket normalization
 */
export function handleImageLoadError(
  imgElement: HTMLImageElement,
  fallbackSrc: string = DEFAULT_VEHICLE_PLACEHOLDER
): void {
  const currentSrc = imgElement.src || '';
  const attempts = Number(imgElement.dataset.retryCount || '0');

  // Attempt 1: If URL has uppercase CAR-IMAGES, try lowercase car-images
  if (currentSrc.includes('/CAR-IMAGES/')) {
    imgElement.dataset.retryCount = String(attempts + 1);
    imgElement.src = currentSrc.replace('/CAR-IMAGES/', '/car-images/');
    return;
  }

  // Attempt 2: If URL has transform params (?width=...), try raw clean URL
  if (currentSrc.includes('?') && currentSrc.includes('supabase.co')) {
    imgElement.dataset.retryCount = String(attempts + 1);
    imgElement.src = currentSrc.split('?')[0];
    return;
  }

  // Attempt 3: Retry once with timestamp cache-buster after 600ms on network hiccup
  if (attempts < 2 && currentSrc && !currentSrc.startsWith('data:')) {
    imgElement.dataset.retryCount = String(attempts + 1);
    setTimeout(() => {
      const sep = currentSrc.includes('?') ? '&' : '?';
      imgElement.src = `${currentSrc.split('#')[0]}${sep}retry=${Date.now()}`;
    }, 600);
    return;
  }

  // Final: Fall back to default vehicle placeholder
  imgElement.onerror = null;
  imgElement.src = fallbackSrc;
}
