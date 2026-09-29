import React from 'react';
import { getValidImageUrl, getThumbnailUrl, handleThumbnailLoadError } from '../../utils/imageFallback';

export interface DetailThumbnailStripProps {
  images: string[];
  activeImageIndex: number;
  onSelectImage: (index: number) => void;
  onOpenLightboxAt: (index: number) => void;
  onHoverPreview: (index: number | null) => void;
  safeTitle: string;
}

/**
 * Desktop Detail Thumbnail Strip (turbo.az style)
 *
 * Rendered under the 4:3 image frame in the left column on desktop (md: and up).
 * Features:
 * - At most 9 tiles in ONE row spanning 100% width of the image frame.
 * - Visual separation via crisp white gaps on a white container (no black borders).
 * - If totalImages > 9, the 9th tile shows image #9 under a semi-transparent dark overlay (+N).
 * - Desktop hover preview: hovering previews the image in the main frame; mouse leave restores selection.
 * - Clicking a tile commits the selection; clicking "+N" opens the lightbox at image #9.
 * - Highlight: active tile has a clear blue ring. If active image is >= 8, highlights the "+N" tile.
 * - Clean clickable buttons without pointer capture or drag-to-scroll.
 */
export const DetailThumbnailStrip: React.FC<DetailThumbnailStripProps> = ({
  images,
  activeImageIndex,
  onSelectImage,
  onOpenLightboxAt,
  onHoverPreview,
  safeTitle,
}) => {
  const totalImages = images?.length || 0;

  if (!images || totalImages <= 1) {
    return null;
  }

  // Show at most 9 tiles in one fixed row
  const visibleCount = Math.min(totalImages, 9);
  const tiles = images.slice(0, visibleCount);
  const hasMore = totalImages > 9;
  const remainingCount = totalImages - 9;

  return (
    <div 
      className="w-full bg-white pt-1.5 pb-0.5 px-0 select-none"
      onMouseLeave={() => onHoverPreview(null)}
    >
      <div 
        className="grid w-full gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))`,
        }}
      >
        {tiles.map((imgSrc, idx) => {
          const isPlusNTile = idx === 8 && hasMore;
          const isActive = isPlusNTile ? activeImageIndex >= 8 : activeImageIndex === idx;
          const fullUrl = getValidImageUrl(imgSrc);
          const thumbUrl = getThumbnailUrl(fullUrl);

          return (
            <button
              key={`detail-tile-${idx}`}
              type="button"
              onClick={() => {
                onHoverPreview(null);
                if (isPlusNTile) {
                  onOpenLightboxAt(8);
                } else {
                  onSelectImage(idx);
                }
              }}
              onMouseEnter={() => {
                // If it's the 9th tile with +N, hovering still previews image #9 (index 8)
                onHoverPreview(idx);
              }}
              className={`relative aspect-[4/3] w-full rounded-sm overflow-hidden transition-all duration-150 cursor-pointer group bg-slate-100 ${
                isActive
                  ? 'ring-2 ring-blue-600 ring-offset-1 ring-offset-white opacity-100 z-10'
                  : 'opacity-75 hover:opacity-100'
              }`}
              title={isPlusNTile ? `Bütün şəkillər (+${remainingCount})` : `${idx + 1}-ci şəkil`}
              aria-label={isPlusNTile ? `Bütün ${totalImages} şəkli göstər` : `${safeTitle} - şəkil ${idx + 1}`}
              aria-selected={isActive}
            >
              <img
                src={thumbUrl}
                alt={`${safeTitle} - şəkil ${idx + 1}`}
                className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-150 group-hover:scale-105"
                draggable={false}
                loading={idx < 8 ? 'eager' : 'lazy'}
                referrerPolicy="no-referrer"
                onError={(e) => handleThumbnailLoadError(e.currentTarget, fullUrl)}
              />

              {isPlusNTile && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center transition-colors group-hover:bg-black/45 pointer-events-none">
                  <span className="text-white font-bold text-xs lg:text-sm tracking-wide select-none drop-shadow-sm">
                    +{remainingCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
