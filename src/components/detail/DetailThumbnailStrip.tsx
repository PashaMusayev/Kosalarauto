import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getValidImageUrl, getThumbnailUrl, handleThumbnailLoadError } from '../../utils/imageFallback';

export interface DetailThumbnailStripProps {
  images: string[];
  activeImageIndex: number;
  onSelectImage: (index: number) => void;
  safeTitle: string;
}

/**
 * Desktop Detail Thumbnail Strip (turbo.az style)
 *
 * Rendered under the 4:3 image frame in the left column on desktop (md: and up).
 * Features:
 * - Mouse drag-to-scroll with grab / grabbing cursor and >5px drag suppression.
 * - Horizontal mouse wheel scrolling when strip overflows.
 * - getThumbnailUrl with automatic failed thumbnail fallback & lazy loading.
 * - Smooth horizontal auto-scroll when activeImageIndex changes without moving the page/modal vertically.
 * - Subtle left/right edge fades when thumbnails overflow beyond view.
 */
export const DetailThumbnailStrip: React.FC<DetailThumbnailStripProps> = ({
  images,
  activeImageIndex,
  onSelectImage,
  safeTitle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Drag interaction refs & state
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);
  const isInitialMountRef = useRef(true);

  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Update edge fade indicators
  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  // Monitor resize & initialize scroll indicators
  useEffect(() => {
    updateScrollState();
    const container = containerRef.current;
    if (!container) return;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateScrollState();
      });
      observer.observe(container);
      return () => observer.disconnect();
    }
  }, [updateScrollState, images.length]);

  // Center active thumbnail horizontally when activeImageIndex changes (container-only scroll)
  useEffect(() => {
    const container = containerRef.current;
    const thumb = thumbnailRefs.current[activeImageIndex];
    if (!container || !thumb) return;

    const containerRect = container.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();

    // Calculate thumb position within scrollable content
    const relativeThumbLeft = thumbRect.left - containerRect.left + container.scrollLeft;
    const targetScrollLeft = relativeThumbLeft - (container.clientWidth / 2) + (thumb.clientWidth / 2);
    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    if (maxScrollLeft > 0) {
      const clampedScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
        container.scrollTo({
          left: clampedScrollLeft,
          behavior: 'auto',
        });
      } else {
        container.scrollTo({
          left: clampedScrollLeft,
          behavior: 'smooth',
        });
      }
    }
    updateScrollState();
  }, [activeImageIndex, updateScrollState]);

  // Mouse wheel: scroll horizontally when strip overflows
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const hasOverflow = container.scrollWidth > container.clientWidth + 1;
      if (!hasOverflow) {
        // Let page scroll normally if content doesn't overflow
        return;
      }

      // Read dominant scroll delta
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;

      const canScrollLeftNow = container.scrollLeft > 0;
      const canScrollRightNow = container.scrollLeft < container.scrollWidth - container.clientWidth - 1;

      // Only hijack wheel when there is scroll capacity in that direction
      if ((delta < 0 && canScrollLeftNow) || (delta > 0 && canScrollRightNow)) {
        e.preventDefault();
        container.scrollLeft += delta;
        updateScrollState();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [images.length, updateScrollState]);

  // Mouse pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left mouse button only
    const container = containerRef.current;
    if (!container) return;

    isDownRef.current = true;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = container.scrollLeft;
    hasMovedRef.current = false;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Safe fallback if pointer capture is unsupported
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDownRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const deltaX = e.clientX - startXRef.current;
    if (!hasMovedRef.current && Math.abs(deltaX) > 5) {
      hasMovedRef.current = true;
      setIsDragging(true);
    }

    if (hasMovedRef.current) {
      container.scrollLeft = startScrollLeftRef.current - deltaX;
      updateScrollState();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDownRef.current) return;
    isDownRef.current = false;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Safe fallback
    }

    // Suppress clicks that follow a drag gesture
    if (hasMovedRef.current) {
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 50);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isDownRef.current = false;
    setIsDragging(false);
    hasMovedRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Safe fallback
    }
  };

  const handleThumbClick = (index: number, e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onSelectImage(index);
  };

  if (!images || images.length <= 1) {
    return null;
  }

  return (
    <div className="relative w-full bg-black border-t border-white/10 px-3 py-2.5 overflow-hidden select-none">
      {/* Left Edge Gradient Fade */}
      {canScrollLeft && (
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black via-black/75 to-transparent z-20"
          aria-hidden="true"
        />
      )}

      {/* Right Edge Gradient Fade */}
      {canScrollRight && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black via-black/75 to-transparent z-20"
          aria-hidden="true"
        />
      )}

      {/* Scrollable Track */}
      <div
        ref={containerRef}
        onScroll={updateScrollState}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={(e) => {
          if (hasMovedRef.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        className={`w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 select-none touch-pan-x ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {images.map((imgSrc, idx) => {
          const isActive = idx === activeImageIndex;
          const fullUrl = getValidImageUrl(imgSrc);
          const thumbUrl = getThumbnailUrl(fullUrl);

          return (
            <button
              key={`desktop-thumb-${idx}`}
              ref={(el) => { thumbnailRefs.current[idx] = el; }}
              type="button"
              onClick={(e) => handleThumbClick(idx, e)}
              className={`relative shrink-0 w-[100px] h-[75px] rounded-md overflow-hidden transition-all duration-150 select-none ${
                isActive
                  ? 'border-2 border-blue-600 ring-2 ring-blue-500/40 opacity-100 shadow-md z-10 scale-[1.02]'
                  : 'border border-white/15 opacity-60 hover:opacity-100 hover:border-white/50'
              } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
              title={`${idx + 1}-ci şəkil`}
              aria-label={`${safeTitle} - şəkil ${idx + 1}`}
              aria-selected={isActive}
            >
              <img
                src={thumbUrl}
                alt={`${safeTitle} - şəkil ${idx + 1}`}
                className="w-full h-full object-cover pointer-events-none select-none"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                loading={idx < 8 ? 'eager' : 'lazy'}
                referrerPolicy="no-referrer"
                onError={(e) => handleThumbnailLoadError(e.currentTarget, fullUrl)}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
