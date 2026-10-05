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

interface GridPairRow {
  type: 'pair';
  items: { img: string; index: number }[];
}

interface GridWideRow {
  type: 'wide';
  item: { img: string; index: number };
}

type GridRow = GridPairRow | GridWideRow;

function buildGridRows(images: string[]): GridRow[] {
  const rows: GridRow[] = [];
  let i = 0;
  while (i < images.length) {
    const remaining = images.length - i;
    if (remaining === 1) {
      // Single remaining item: render as wide tile (no empty half)
      rows.push({
        type: 'wide',
        item: { img: images[i], index: i }
      });
      i += 1;
    } else if (remaining === 2) {
      // Exactly 2 remaining: render as pair
      rows.push({
        type: 'pair',
        items: [
          { img: images[i], index: i },
          { img: images[i + 1], index: i + 1 }
        ]
      });
      i += 2;
    } else {
      // 3 or more: pair (positions 1-2), then wide (position 3)
      rows.push({
        type: 'pair',
        items: [
          { img: images[i], index: i },
          { img: images[i + 1], index: i + 1 }
        ]
      });
      rows.push({
        type: 'wide',
        item: { img: images[i + 2], index: i + 2 }
      });
      i += 3;
    }
  }
  return rows;
}

/**
 * Wide tile (full width, landscape aspect around 5:3).
 * Uses full-size image (1200px) with thumbnail placeholder underneath until loaded.
 */
interface WideGridTileProps {
  img: string;
  index: number;
  title: string;
  isEager: boolean;
  onSelect: (index: number) => void;
}

const WideGridTile: React.FC<WideGridTileProps> = ({
  img,
  index,
  title,
  isEager,
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

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className="relative w-full aspect-[5/3] bg-slate-100 overflow-hidden cursor-pointer block select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]"
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
 * Pair tile (half width, portrait-ish aspect around 4:5).
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

  // Restore scroll position when grid opens/mounts (Phase 34)
  useLayoutEffect(() => {
    if (isOpen && scrollContainerRef.current && initialScrollTop > 0) {
      scrollContainerRef.current.scrollTop = initialScrollTop;
      const rafId = requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = initialScrollTop;
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isOpen, initialScrollTop]);

  // Thumbnail prefetching on open
  useEffect(() => {
    if (isOpen && imagesList && imagesList.length > 0) {
      const thumbs = imagesList.map((img) => getThumbnailUrl(getValidImageUrl(img)));
      prefetchImages(thumbs);
    }
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

  // Header display string: Turbo.az format e.g. "Mercedes Sprinter, 2.4 L, 2012 il, 215 000 km"
  const displayHeader = useMemo(() => {
    if (headerTitle) return headerTitle;

    let kmPart = '';
    if (mileage !== undefined && mileage !== null && String(mileage).trim() !== '') {
      const num = Number(mileage);
      if (!isNaN(num) && num > 0) {
        kmPart = `${Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`;
      }
    }

    if (kmPart && !title.includes(' km')) {
      return `${title}, ${kmPart}`;
    }
    return title;
  }, [headerTitle, title, mileage]);

  // Group images into 2-1-2-1 mosaic rows
  const rows = useMemo(() => buildGridRows(imagesList), [imagesList]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`fixed inset-0 z-[65] flex flex-col bg-white select-none overflow-hidden ${
            disabledEscape ? 'pointer-events-none' : ''
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={`${displayHeader} - Bütün şəkillər`}
        >
          {/* Turbo.az Mobil Şəkil Qalereyası Başlığı */}
          <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between shadow-xs shrink-0">
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
            <div className="flex-1 min-w-0 px-3 text-center">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                {displayHeader}
              </h2>
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

          {/* Mosaic Layout (2-1-2-1 təkrar olunan qrid - Turbo.az Mobil Tərzi) */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto overscroll-contain bg-white"
          >
            <div className="flex flex-col gap-[2px] bg-white w-full">
              {rows.map((row, rowIdx) => {
                if (row.type === 'pair') {
                  return (
                    <div key={`row-${rowIdx}`} className="grid grid-cols-2 gap-[2px] w-full">
                      {row.items.map((item) => (
                        <PairGridTile
                          key={`photo-grid-pair-${item.index}`}
                          img={item.img}
                          index={item.index}
                          title={title}
                          isEager={item.index < 3}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                  );
                }

                return (
                  <div key={`row-${rowIdx}`} className="w-full">
                    <WideGridTile
                      key={`photo-grid-wide-${row.item.index}`}
                      img={row.item.img}
                      index={row.item.index}
                      title={title}
                      isEager={row.item.index < 3}
                      onSelect={handleSelect}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
