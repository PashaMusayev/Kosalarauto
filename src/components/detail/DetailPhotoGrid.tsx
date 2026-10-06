import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getValidImageUrl, getThumbnailUrl, handleThumbnailLoadError, isThumbnailFailed } from '../../utils/imageFallback';
import { prefetchImages } from '../../utils/imagePreloader';

interface DetailPhotoGridProps {
  isOpen: boolean;
  onClose: () => void;
  imagesList: string[];
  title: string;
  headerTitle?: string;
  mileage?: number | string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onSelectPhoto: (index: number) => void;
  disabledEscape?: boolean;
  initialScrollTop?: number;
  onScrollPositionChange?: (scrollTop: number) => void;
}

// Module-level cache for orientation detection (true = landscape, false = portrait)
export const orientationCache = new Map<string, boolean>();
const inFlightProbes = new Map<string, Promise<boolean>>();

export function isLandscapeUrl(url: string): boolean {
  return orientationCache.get(url) === true;
}

/**
 * Probes the image's natural dimensions via Image().
 * Landscape = width / height >= 1.15
 */
export function probeImageOrientation(img: string): Promise<boolean> {
  const fullImgUrl = getValidImageUrl(img);
  if (orientationCache.has(fullImgUrl)) {
    return Promise.resolve(orientationCache.get(fullImgUrl)!);
  }
  if (inFlightProbes.has(fullImgUrl)) {
    return inFlightProbes.get(fullImgUrl)!;
  }

  const thumbUrl = getThumbnailUrl(fullImgUrl);
  const promise = new Promise<boolean>((resolve) => {
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';

    let resolved = false;
    const finish = (isLandscape: boolean, isReal: boolean) => {
      if (resolved) return;
      resolved = true;
      inFlightProbes.delete(fullImgUrl);
      if (isReal) {
        orientationCache.set(fullImgUrl, isLandscape);
      }
      resolve(isLandscape);
    };

    probe.onload = () => {
      const w = probe.naturalWidth || probe.width;
      const h = probe.naturalHeight || probe.height;
      if (w > 0 && h > 0) {
        finish((w / h) >= 1.15, true);
      } else {
        finish(false, false);
      }
    };

    probe.onerror = () => {
      if (probe.src !== fullImgUrl) {
        probe.src = fullImgUrl;
      } else {
        finish(false, false);
      }
    };

    probe.src = thumbUrl;
    if (probe.complete && probe.naturalWidth > 0) {
      const w = probe.naturalWidth;
      const h = probe.naturalHeight;
      finish((w / h) >= 1.15, true);
    }
  });

  inFlightProbes.set(fullImgUrl, promise);
  return promise;
}

export function probeImagesOrientations(images: string[]): void {
  if (!images || images.length === 0) return;
  for (const img of images) {
    probeImageOrientation(img);
  }
}

export interface GridPairRow {
  type: 'pair';
  items: [
    { img: string; index: number },
    { img: string; index: number }
  ];
}

export interface GridLandscapeRow {
  type: 'landscape';
  item: { img: string; index: number };
}

export interface GridSinglePortraitRow {
  type: 'single-portrait';
  item: { img: string; index: number };
}

export type GridRow = GridPairRow | GridLandscapeRow | GridSinglePortraitRow;

/**
 * Shape-based row builder:
 * - Every LANDSCAPE photo gets its own full-width tile. Consecutive landscapes are simply stacked.
 * - PORTRAIT photos are ALWAYS shown in pairs, side by side. If a portrait's next photo is landscape,
 *   pull the next available portrait from later in the list to complete the pair, and place the landscape(s) below that pair.
 * - If no other portrait remains -> a single full-width portrait tile.
 */
export function buildShapeBasedRows(
  images: string[],
  isLandscapeFn: (img: string) => boolean
): GridRow[] {
  const rows: GridRow[] = [];
  const remaining = images.map((_, i) => i);

  while (remaining.length > 0) {
    const firstIdx = remaining[0];
    const isLand = isLandscapeFn(images[firstIdx]);

    if (isLand) {
      // Landscape -> full-width landscape row (4:3 aspect)
      rows.push({
        type: 'landscape',
        item: { img: images[firstIdx], index: firstIdx }
      });
      remaining.splice(0, 1);
    } else {
      // Portrait -> find next remaining portrait anywhere after it to make a pair
      let partnerIdxInRemaining = -1;
      for (let j = 1; j < remaining.length; j++) {
        const candidateIdx = remaining[j];
        if (!isLandscapeFn(images[candidateIdx])) {
          partnerIdxInRemaining = j;
          break;
        }
      }

      if (partnerIdxInRemaining !== -1) {
        const partnerIdx = remaining[partnerIdxInRemaining];
        rows.push({
          type: 'pair',
          items: [
            { img: images[firstIdx], index: firstIdx },
            { img: images[partnerIdx], index: partnerIdx }
          ]
        });
        remaining.splice(partnerIdxInRemaining, 1);
        remaining.splice(0, 1);
      } else {
        // No other portrait remains -> single full-width portrait tile (4:5 aspect)
        rows.push({
          type: 'single-portrait',
          item: { img: images[firstIdx], index: firstIdx }
        });
        remaining.splice(0, 1);
      }
    }
  }

  return rows;
}

/**
 * Wide tile (full width: landscape 4:3 or single portrait 4:5).
 * Uses full-size image (1200px) with thumbnail placeholder underneath until loaded.
 */
interface WideGridTileProps {
  img: string;
  index: number;
  title: string;
  isEager: boolean;
  aspect?: '4/3' | '4/5';
  onSelect: (index: number) => void;
}

const WideGridTile: React.FC<WideGridTileProps> = ({
  img,
  index,
  title,
  isEager,
  aspect = '4/3',
  onSelect
}) => {
  const fullImgUrl = getValidImageUrl(img);
  const thumbUrl = getThumbnailUrl(fullImgUrl);
  const [thumbFailed, setThumbFailed] = useState(() => isThumbnailFailed(thumbUrl));
  const [isFullLoaded, setIsFullLoaded] = useState(false);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  const handleFullLoad = () => {
    setIsFullLoaded(true);
    setTimeout(() => {
      setPlaceholderVisible(false);
    }, 200);
  };

  const showThumbPlaceholder = placeholderVisible && !thumbFailed && thumbUrl !== fullImgUrl;
  const aspectClass = aspect === '4/5' ? 'aspect-[4/5]' : 'aspect-[4/3]';

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={`relative w-full ${aspectClass} bg-slate-100 overflow-hidden cursor-pointer block select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]`}
      title={`${index + 1}-ci şəkil`}
      aria-label={`${title} - ${index + 1}-ci şəkil`}
    >
      {/* Thumbnail placeholder underneath */}
      {showThumbPlaceholder && (
        <img
          src={thumbUrl}
          alt=""
          aria-hidden="true"
          loading={isEager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setThumbFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
        />
      )}

      {/* Full-size 1200px sharp image on top */}
      <img
        src={fullImgUrl}
        alt={`${title} - ${index + 1}`}
        loading={isEager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={handleFullLoad}
        ref={(el) => {
          if (el && el.complete && el.naturalWidth > 0 && !isFullLoaded) {
            setIsFullLoaded(true);
            setPlaceholderVisible(false);
          }
        }}
        className={`w-full h-full object-cover object-center transition-opacity duration-200 ${
          isFullLoaded || !showThumbPlaceholder ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </button>
  );
};

/**
 * Pair tile (half width, portrait aspect 4:5).
 * Uses thumbnail (800px) with failed thumbnail fallback.
 */
interface PairGridTileProps {
  img: string;
  index: number;
  title: string;
  isEager: boolean;
  onSelect: (index: number) => void;
}

const PairGridTile: React.FC<PairGridTileProps> = ({
  img,
  index,
  title,
  isEager,
  onSelect
}) => {
  const fullImgUrl = getValidImageUrl(img);
  const thumbUrl = getThumbnailUrl(fullImgUrl);

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden cursor-pointer block select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
      title={`${index + 1}-ci şəkil`}
      aria-label={`${title} - ${index + 1}-ci şəkil`}
    >
      <img
        src={thumbUrl}
        alt={`${title} - ${index + 1}`}
        loading={isEager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={(e) => handleThumbnailLoadError(e.currentTarget, fullImgUrl)}
        className="w-full h-full object-cover object-center"
      />
    </button>
  );
};

export const DetailPhotoGrid: React.FC<DetailPhotoGridProps> = ({
  isOpen,
  onClose,
  imagesList,
  title,
  headerTitle,
  mileage,
  isFavorite = false,
  onToggleFavorite,
  onSelectPhoto,
  disabledEscape = false,
  initialScrollTop = 0,
  onScrollPositionChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ready state: true once all orientations are known or timeout fires
  const [isReady, setIsReady] = useState<boolean>(() => {
    if (!isOpen || imagesList.length === 0) return true;
    return imagesList.every((img) => orientationCache.has(getValidImageUrl(img)));
  });

  // Restore scroll position when grid opens/mounts (Phase 34)
  useLayoutEffect(() => {
    if (isOpen && scrollContainerRef.current && initialScrollTop > 0 && isReady) {
      scrollContainerRef.current.scrollTop = initialScrollTop;
      const rafId = requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = initialScrollTop;
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isOpen, initialScrollTop, isReady]);

  // Thumbnail prefetching on open
  useEffect(() => {
    if (isOpen && imagesList && imagesList.length > 0) {
      const thumbs = imagesList.map((img) => getThumbnailUrl(getValidImageUrl(img)));
      prefetchImages(thumbs);
    }
  }, [isOpen, imagesList]);

  // Orientation probing with ~4s timeout.
  // Critical: Unresolved images are NOT permanently cached as false!
  // They safely fallback to portrait for this render while the background probe finishes.
  useEffect(() => {
    if (!isOpen || imagesList.length === 0) return;

    const unknownImages = imagesList.filter(
      (img) => !orientationCache.has(getValidImageUrl(img))
    );

    if (unknownImages.length === 0) {
      setIsReady(true);
      return;
    }

    let isMounted = true;
    const probes = unknownImages.map((img) => probeImageOrientation(img));

    const timer = setTimeout(() => {
      if (!isMounted) return;
      // Timeout fallback: unblock rendering safely without corrupting orientationCache
      setIsReady(true);
    }, 4000);

    Promise.all(probes).then(() => {
      if (!isMounted) return;
      clearTimeout(timer);
      setIsReady(true);
    });

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, imagesList]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    onScrollPositionChange?.(e.currentTarget.scrollTop);
  };

  const handleSelect = (idx: number) => {
    if (scrollContainerRef.current) {
      onScrollPositionChange?.(scrollContainerRef.current.scrollTop);
    }
    onSelectPhoto(idx);
  };

  // Header two-line formatting (Turbo.az style):
  // Line 1: brand/model, engine and year ending with comma — e.g. "Ford Transit, 2.4 L, 2006 il,"
  // Line 2: the mileage — e.g. "170 000 km"
  // If no mileage: show only line 1 without trailing comma
  const { line1, line2 } = useMemo(() => {
    let kmStr = '';
    if (mileage !== undefined && mileage !== null && String(mileage).trim() !== '') {
      const num = Number(mileage);
      if (!isNaN(num) && num > 0) {
        kmStr = `${Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`;
      }
    }

    let base = '';
    if (headerTitle) {
      if (kmStr && headerTitle.endsWith(kmStr)) {
        base = headerTitle.slice(0, -kmStr.length).replace(/,\s*$/, '').trim();
      } else {
        const kmMatch = headerTitle.match(/,\s*([\d\s]+km)$/i);
        if (kmMatch) {
          if (!kmStr) kmStr = kmMatch[1].trim();
          base = headerTitle.replace(/,\s*[\d\s]+km$/i, '').trim();
        } else {
          base = headerTitle.trim();
        }
      }
    }

    if (!base) {
      base = title.trim();
    }

    if (kmStr) {
      return {
        line1: `${base.replace(/,\s*$/, '')},`,
        line2: kmStr
      };
    }

    return {
      line1: base.replace(/,\s*$/, ''),
      line2: null
    };
  }, [headerTitle, title, mileage]);

  // Compute shape-based rows using orientation cache (Phase 67e)
  const rows = useMemo(() => {
    return buildShapeBasedRows(imagesList, (img) => isLandscapeUrl(getValidImageUrl(img)));
  }, [imagesList, isReady]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`fixed inset-0 z-[65] flex flex-col bg-[#EEF1F6] select-none overflow-hidden ${
            disabledEscape ? 'pointer-events-none' : ''
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={`${line1} ${line2 || ''} - Bütün şəkillər`}
        >
          {/* Turbo.az Mobil Şəkil Qalereyası Başlığı */}
          <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-3.5 py-2 flex items-center justify-between shadow-xs shrink-0 min-h-[58px]">
            {/* Geri Düyməsi */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClose();
              }}
              className="w-10 h-10 rounded-xl text-slate-800 bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
              title="Geri"
              aria-label="Geri"
            >
              <ArrowLeft className="w-5 h-5 text-slate-800" />
            </button>

            {/* Avtomobil Başlığı və Yürüş (Turbo.az stili 2 sətirli mərkəzləşdirilmiş başlıq) */}
            <div className="flex-1 min-w-0 px-2 sm:px-3 text-center flex flex-col items-center justify-center">
              <h2 className="text-[16px] sm:text-[17px] font-semibold text-slate-900 leading-snug text-center break-words line-clamp-2">
                {line1}
              </h2>
              {line2 && (
                <p className="text-[15px] sm:text-[16px] font-semibold text-slate-800 leading-snug text-center mt-0.5">
                  {line2}
                </p>
              )}
            </div>

            {/* Sevimlilər (Ürək) Düyməsi (X düyməsini əvəz edir) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleFavorite?.();
              }}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
              title={isFavorite ? 'Seçilmişlərdən çıxar' : 'Seçilmişlərə əlavə et'}
              aria-label={isFavorite ? 'Seçilmişlərdən çıxar' : 'Seçilmişlərə əlavə et'}
            >
              <Heart
                className={`w-5 h-5 transition-transform active:scale-125 ${
                  isFavorite ? 'fill-red-500 text-red-500 stroke-red-500' : 'text-slate-700 stroke-[2]'
                }`}
              />
            </button>
          </div>

          {/* Mosaic Layout (Shape-based layout - Turbo.az Mobil Tərzi) */}
          {!isReady ? (
            /* Neutral skeleton placeholder while sizes probe (at most 4s, usually instant) */
            <div className="flex-1 overflow-hidden bg-[#EEF1F6]">
              <div className="flex flex-col gap-2 pt-2 bg-[#EEF1F6] w-full animate-pulse">
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="w-full aspect-[4/5] bg-slate-200" />
                  <div className="w-full aspect-[4/5] bg-slate-200" />
                </div>
                <div className="w-full aspect-[4/3] bg-slate-200" />
                <div className="grid grid-cols-2 gap-2 w-full">
                  <div className="w-full aspect-[4/5] bg-slate-200" />
                  <div className="w-full aspect-[4/5] bg-slate-200" />
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto overscroll-contain bg-[#EEF1F6]"
            >
              <div className="flex flex-col gap-2 pt-2 pb-6 bg-[#EEF1F6] w-full">
                {rows.map((row, rowIdx) => {
                  if (row.type === 'pair') {
                    return (
                      <div key={`row-${rowIdx}`} className="grid grid-cols-2 gap-2 w-full">
                        {row.items.map((item) => (
                          <PairGridTile
                            key={`photo-grid-pair-${item.index}`}
                            img={item.img}
                            index={item.index}
                            title={title}
                            isEager={rowIdx < 2}
                            onSelect={handleSelect}
                          />
                        ))}
                      </div>
                    );
                  }

                  if (row.type === 'landscape') {
                    return (
                      <div key={`row-${rowIdx}`} className="w-full">
                        <WideGridTile
                          key={`photo-grid-land-${row.item.index}`}
                          img={row.item.img}
                          index={row.item.index}
                          title={title}
                          isEager={rowIdx < 2}
                          aspect="4/3"
                          onSelect={handleSelect}
                        />
                      </div>
                    );
                  }

                  // Single leftover portrait (full width 4:5)
                  return (
                    <div key={`row-${rowIdx}`} className="w-full">
                      <WideGridTile
                        key={`photo-grid-port-single-${row.item.index}`}
                        img={row.item.img}
                        index={row.item.index}
                        title={title}
                        isEager={rowIdx < 2}
                        aspect="4/5"
                        onSelect={handleSelect}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
