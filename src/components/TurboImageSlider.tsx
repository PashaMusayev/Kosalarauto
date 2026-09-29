import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { 
  DEFAULT_VEHICLE_PLACEHOLDER, 
  getValidImageUrl, 
  handleImageLoadError,
  getThumbnailUrl,
  isThumbnailFailed,
  markThumbnailFailed
} from '../utils/imageFallback';
import { prefetchCarouselWindow } from '../utils/imagePreloader';

/**
 * Global memory cache of full-size image URLs that have already loaded
 * in the current browser session. Enables instantaneous, zero-flicker
 * and zero-fade display when switching between slides or revisiting images.
 */
const loadedFullImagesCache = new Set<string>();

interface SlideImageProps {
  src: string;
  alt: string;
  isActiveSlide: boolean;
  isNearActive: boolean;
  isLightbox: boolean;
  isZoomed: boolean;
  isDragging: boolean;
  scale: number;
  pan: { x: number; y: number };
}

/**
 * Three-layer progressive slide image component:
 * 1. Blurred background using thumbnail URL (desktop non-lightbox).
 * 2. Instant thumbnail placeholder layer (w-full h-full object-contain / object-cover).
 * 3. Full-size image on top with ~200ms smooth fade-in (instant for cached images).
 */
const SlideImage: React.FC<SlideImageProps> = ({
  src,
  alt,
  isActiveSlide,
  isNearActive,
  isLightbox,
  isZoomed,
  isDragging,
  scale,
  pan,
}) => {
  const validFullUrl = getValidImageUrl(src);
  const candidateThumb = getThumbnailUrl(validFullUrl);
  const hasCandidateThumb = Boolean(candidateThumb) && candidateThumb !== validFullUrl && !isThumbnailFailed(candidateThumb);

  const [isFullLoaded, setIsFullLoaded] = useState(() => loadedFullImagesCache.has(validFullUrl));
  const [isCached, setIsCached] = useState(() => loadedFullImagesCache.has(validFullUrl));
  const [placeholderVisible, setPlaceholderVisible] = useState(() => !loadedFullImagesCache.has(validFullUrl));
  const [thumbFailed, setThumbFailed] = useState(() => isThumbnailFailed(candidateThumb));

  const hidePlaceholderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullImgRef = useRef<HTMLImageElement | null>(null);

  // Sync state if validFullUrl or candidateThumb changes
  useEffect(() => {
    if (loadedFullImagesCache.has(validFullUrl)) {
      setIsFullLoaded(true);
      setIsCached(true);
      setPlaceholderVisible(false);
    } else {
      const isAlreadyComplete = Boolean(
        fullImgRef.current &&
        fullImgRef.current.complete &&
        fullImgRef.current.naturalWidth > 0
      );
      if (isAlreadyComplete) {
        loadedFullImagesCache.add(validFullUrl);
        setIsFullLoaded(true);
        setIsCached(true);
        setPlaceholderVisible(false);
      } else {
        setIsFullLoaded(false);
        setIsCached(false);
        setPlaceholderVisible(true);
      }
    }
    setThumbFailed(isThumbnailFailed(candidateThumb));
  }, [validFullUrl, candidateThumb]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hidePlaceholderTimerRef.current) {
        clearTimeout(hidePlaceholderTimerRef.current);
        hidePlaceholderTimerRef.current = null;
      }
    };
  }, []);

  const checkImgRef = useCallback((img: HTMLImageElement | null) => {
    fullImgRef.current = img;
    if (!img) return;
    if (loadedFullImagesCache.has(validFullUrl) || (img.complete && img.naturalWidth > 0)) {
      loadedFullImagesCache.add(validFullUrl);
      setIsFullLoaded(true);
      setIsCached(true);
      setPlaceholderVisible(false);
    }
  }, [validFullUrl]);

  const handleFullLoad = useCallback(() => {
    loadedFullImagesCache.add(validFullUrl);
    setIsFullLoaded(true);
    // Smoothly fade in over 200ms, then hide placeholder
    if (hidePlaceholderTimerRef.current) {
      clearTimeout(hidePlaceholderTimerRef.current);
    }
    hidePlaceholderTimerRef.current = setTimeout(() => {
      setPlaceholderVisible(false);
    }, 220);
  }, [validFullUrl]);

  const showPlaceholder = placeholderVisible && hasCandidateThumb && !thumbFailed;
  const blurredBgSrc = hasCandidateThumb && !thumbFailed ? candidateThumb : validFullUrl;

  const imageTransform = isActiveSlide && isZoomed
    ? `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`
    : 'scale(1)';

  // Phase 53: lightbox and slider both use w-full h-full object-contain / object-cover
  // inside the container box so the thumbnail and full-size image occupy the exact same rectangle.
  const sizingClasses = isLightbox
    ? 'w-full h-full object-contain p-2 sm:p-4'
    : 'w-full h-full object-cover md:object-contain';

  return (
    <>
      {/* Layer 1: Turbo.az Desktop Blurred-Background Fill for non-lightbox slides */}
      {!isLightbox && isNearActive && (
        <div className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none select-none z-0" aria-hidden="true">
          <img
            src={blurredBgSrc}
            alt=""
            aria-hidden="true"
            loading={isNearActive ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (blurredBgSrc !== validFullUrl) {
                markThumbnailFailed(blurredBgSrc);
                e.currentTarget.src = validFullUrl;
              }
            }}
            className="w-full h-full object-cover blur-2xl scale-110 brightness-50"
          />
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        </div>
      )}

      {/* Layer 2: Instant Thumbnail Placeholder Layer (hidden once full image loads) */}
      {showPlaceholder && (
        <img
          src={candidateThumb}
          alt=""
          aria-hidden="true"
          loading={isNearActive ? 'eager' : 'lazy'}
          fetchPriority={isActiveSlide ? 'high' : 'low'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            markThumbnailFailed(candidateThumb);
            setThumbFailed(true);
          }}
          className={`select-none pointer-events-none block mx-auto drop-shadow-md absolute inset-0 z-10 ${sizingClasses}`}
          style={{
            width: '100%',
            height: '100%',
            objectPosition: 'center',
            transform: imageTransform,
            transition: isDragging ? 'none' : 'transform 300ms ease',
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        />
      )}

      {/* Layer 3: Full-Size Image Layer with smooth fade-in */}
      <img
        ref={checkImgRef}
        src={validFullUrl}
        alt={alt}
        loading={isNearActive ? 'eager' : 'lazy'}
        fetchPriority={isActiveSlide ? 'high' : 'low'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={handleFullLoad}
        onError={(e) => {
          handleImageLoadError(e.currentTarget);
        }}
        className={`select-none pointer-events-none block mx-auto drop-shadow-md relative z-10 ${sizingClasses}`}
        style={{
          width: '100%',
          height: '100%',
          objectPosition: 'center',
          opacity: isFullLoaded ? 1 : 0,
          transition: isDragging
            ? 'none'
            : isCached
            ? 'transform 300ms ease'
            : 'opacity 200ms ease-out, transform 300ms ease',
          transform: imageTransform,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      />
    </>
  );
};

interface TurboImageSliderProps {
  images: string[];
  activeImageIndex: number;
  onIndexChange: (newIndex: number) => void;
  safeTitle: string;
  onImageClick?: (index?: number) => void;
  isLightbox?: boolean;
  disabledKeyNav?: boolean;
  className?: string;
  onOpenPhotoGrid?: () => void;
}

export const TurboImageSlider: React.FC<TurboImageSliderProps> = ({
  images,
  activeImageIndex,
  onIndexChange,
  safeTitle,
  onImageClick,
  isLightbox = false,
  disabledKeyNav: _disabledKeyNav,
  className,
  onOpenPhotoGrid,
}) => {
  const imagesList = useMemo(() => {
    return images && images.length > 0 ? images : [DEFAULT_VEHICLE_PLACEHOLDER];
  }, [images]);

  const totalImages = imagesList.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Synchronous index ref to prevent rapid-click stale state issues (Issue 3)
  const currentIndexRef = useRef(activeImageIndex);
  const isInternalNavRef = useRef(false);

  // States & Refs for smooth Turbo.az touch & mouse slider
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentTranslateRef = useRef(0);
  const diffRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const isHorizontalDragRef = useRef<boolean | null>(null);

  // Touch vs synthetic click tracking (Fixes Issue 3 conflict)
  const lastTouchTimeRef = useRef(0);
  const lastDoubleTapTimeRef = useRef(0);

  // Zoom states for Turbo.az pinch-to-zoom and double-tap zoom
  const [scale, setScale] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Wrap-around seamless sliding states & refs (Phase 40)
  const [wrapVisualIndex, setWrapVisualIndex] = useState<number | null>(null);
  const isWrappingRef = useRef(false);
  const wrapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNavRef = useRef<'next' | 'prev' | null>(null);
  const handleNextRef = useRef<() => void>(() => {});
  const handlePrevRef = useRef<() => void>(() => {});

  // Clear wrap timeout on unmount
  useEffect(() => {
    return () => {
      if (wrapTimeoutRef.current) {
        clearTimeout(wrapTimeoutRef.current);
        wrapTimeoutRef.current = null;
      }
      pendingNavRef.current = null;
    };
  }, []);

  const scaleRef = useRef(1);
  const isZoomedRef = useRef(false);
  const panRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pinch tracking
  const pinchStartDistRef = useRef(0);
  const pinchStartScaleRef = useRef(1);
  const isPinchingRef = useRef(false);

  // Pan tracking when zoomed
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const panStartPosRef = useRef({ x: 0, y: 0 });
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const touchStartTimeRef = useRef(0);
  const isTouchOnControlRef = useRef(false);

  // Reset zoom on active slide change
  useEffect(() => {
    setScale(1);
    scaleRef.current = 1;
    setIsZoomed(false);
    isZoomedRef.current = false;
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
  }, [activeImageIndex]);

  // Measure container width with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      if (container) {
        const w = container.clientWidth;
        if (w > 0) {
          setContainerWidth(w);
        }
      }
    };

    updateWidth();

    const ro = new ResizeObserver(() => {
      updateWidth();
    });
    ro.observe(container);

    return () => ro.disconnect();
  }, []);

  // Preload neighboring images in background
  useEffect(() => {
    if (totalImages > 0) {
      prefetchCarouselWindow(imagesList, activeImageIndex);
    }
  }, [imagesList, activeImageIndex, totalImages]);

  // Helper to jump immediately to a slide without fly-through sliding transition (for multi-step jumps)
  const applyPositionWithoutTransition = useCallback((targetIndex: number) => {
    const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
    if (!trackRef.current || width <= 0) return;
    const track = trackRef.current;
    track.classList.add('no-transition');
    track.style.setProperty('transition', 'none', 'important');
    track.style.transform = `translateX(${-targetIndex * width}px)`;
    void track.offsetWidth; // Force reflow
    track.classList.remove('no-transition');
    track.style.removeProperty('transition');
  }, [containerWidth]);

  // Seamless loop forward: slide smoothly to clone of first image (at index totalImages), then silently snap to real index 0
  const wrapNext = useCallback(() => {
    if (isWrappingRef.current || totalImages <= 1) return;
    const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
    if (!trackRef.current || width <= 0) {
      isInternalNavRef.current = true;
      currentIndexRef.current = 0;
      onIndexChange(0);
      return;
    }

    isInternalNavRef.current = true;
    isWrappingRef.current = true;
    const track = trackRef.current;

    if (wrapTimeoutRef.current) {
      clearTimeout(wrapTimeoutRef.current);
      wrapTimeoutRef.current = null;
    }

    // Ensure transition is active and dragging class is removed
    track.classList.remove('dragging', 'no-transition');
    track.style.removeProperty('transition');

    // Slide 1 slide-width forward to the clone of the first image (at flex index totalImages)
    track.style.transform = `translateX(${-totalImages * width}px)`;
    setWrapVisualIndex(totalImages);

    wrapTimeoutRef.current = setTimeout(() => {
      if (!trackRef.current) {
        isWrappingRef.current = false;
        isInternalNavRef.current = false;
        return;
      }
      const t = trackRef.current;
      // Instantly swap track position to real first slide (index 0) with transition disabled
      t.classList.add('no-transition');
      t.style.setProperty('transition', 'none', 'important');
      t.style.transform = 'translateX(0px)';
      void t.offsetWidth; // Force synchronous reflow

      isInternalNavRef.current = true;
      currentIndexRef.current = 0;
      onIndexChange(0);
      setWrapVisualIndex(null);

      requestAnimationFrame(() => {
        if (trackRef.current) {
          trackRef.current.classList.remove('no-transition');
          trackRef.current.style.removeProperty('transition');
        }
        isWrappingRef.current = false;
        isInternalNavRef.current = false;

        // Buffer execution: execute at most one pending navigation requested during wrap
        if (pendingNavRef.current) {
          const nextAction = pendingNavRef.current;
          pendingNavRef.current = null;
          if (nextAction === 'next') {
            handleNextRef.current();
          } else if (nextAction === 'prev') {
            handlePrevRef.current();
          }
        }
      });
    }, 350);
  }, [totalImages, containerWidth, onIndexChange]);

  // Seamless loop backward: slide smoothly to clone of last image (at -100%), then silently snap to real last slide
  const wrapPrev = useCallback(() => {
    if (isWrappingRef.current || totalImages <= 1) return;
    const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
    if (!trackRef.current || width <= 0) {
      isInternalNavRef.current = true;
      currentIndexRef.current = totalImages - 1;
      onIndexChange(totalImages - 1);
      return;
    }

    isInternalNavRef.current = true;
    isWrappingRef.current = true;
    const track = trackRef.current;

    if (wrapTimeoutRef.current) {
      clearTimeout(wrapTimeoutRef.current);
      wrapTimeoutRef.current = null;
    }

    // Ensure transition is active and dragging class is removed
    track.classList.remove('dragging', 'no-transition');
    track.style.removeProperty('transition');

    // Slide 1 slide-width backward to the clone of the last image (located at left -100%, so transform is +width)
    track.style.transform = `translateX(${width}px)`;
    setWrapVisualIndex(-1);

    wrapTimeoutRef.current = setTimeout(() => {
      if (!trackRef.current) {
        isWrappingRef.current = false;
        isInternalNavRef.current = false;
        pendingNavRef.current = null;
        return;
      }
      const t = trackRef.current;
      const targetIndex = totalImages - 1;
      // Instantly swap track position to real last slide with transition disabled
      t.classList.add('no-transition');
      t.style.setProperty('transition', 'none', 'important');
      t.style.transform = `translateX(${-targetIndex * width}px)`;
      void t.offsetWidth; // Force synchronous reflow

      isInternalNavRef.current = true;
      currentIndexRef.current = targetIndex;
      onIndexChange(targetIndex);
      setWrapVisualIndex(null);

      requestAnimationFrame(() => {
        if (trackRef.current) {
          trackRef.current.classList.remove('no-transition');
          trackRef.current.style.removeProperty('transition');
        }
        isWrappingRef.current = false;
        isInternalNavRef.current = false;

        // Buffer execution: execute at most one pending navigation requested during wrap
        if (pendingNavRef.current) {
          const nextAction = pendingNavRef.current;
          pendingNavRef.current = null;
          if (nextAction === 'next') {
            handleNextRef.current();
          } else if (nextAction === 'prev') {
            handlePrevRef.current();
          }
        }
      });
    }, 350);
  }, [totalImages, containerWidth, onIndexChange]);

  // Navigate to slide with clean boundary handling and direction awareness (Phase 55)
  const goToSlide = useCallback((newIndex: number, direction?: 'next' | 'prev') => {
    if (isWrappingRef.current) {
      if (direction) {
        pendingNavRef.current = direction;
      } else {
        pendingNavRef.current = newIndex > currentIndexRef.current ? 'next' : 'prev';
      }
      return;
    }
    const prevIndex = currentIndexRef.current;

    // Check for boundary wrap: direction-aware
    // - Wrap forward (wrapNext, via the trailing first-slide clone) ONLY when direction === 'next' AND current index is the last slide.
    // - Wrap backward (wrapPrev, via the leading last-slide clone) ONLY when direction === 'prev' AND current index is the first slide.
    if (totalImages > 1) {
      if (direction === 'next' && prevIndex === totalImages - 1) {
        wrapNext();
        return;
      }
      if (direction === 'prev' && prevIndex === 0) {
        wrapPrev();
        return;
      }
      // If direction is not specified and totalImages > 2, handle boundary wrap for non-adjacent jumps (0 <-> totalImages - 1)
      if (!direction && totalImages > 2) {
        if (prevIndex === totalImages - 1 && newIndex === 0) {
          wrapNext();
          return;
        }
        if (prevIndex === 0 && newIndex === totalImages - 1) {
          wrapPrev();
          return;
        }
      }
    }

    const clampedIndex = Math.max(0, Math.min(totalImages - 1, newIndex));

    isInternalNavRef.current = true;
    currentIndexRef.current = clampedIndex;
    onIndexChange(clampedIndex);

    const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
    if (!trackRef.current || width <= 0) return;

    const track = trackRef.current;
    const isJump = Math.abs(clampedIndex - prevIndex) > 1;

    if (isJump) {
      // Clean non-sliding jump for multi-step jumps (e.g. grid selection, thumbnail clicks)
      applyPositionWithoutTransition(clampedIndex);
    } else {
      // Normal adjacent sliding: 100% UNTOUCHED
      // Uses the exact existing CSS transition: transform 350ms cubic-bezier(0.25, 0.1, 0.25, 1)
      track.style.transform = `translateX(${-clampedIndex * width}px)`;
    }
  }, [totalImages, onIndexChange, containerWidth, applyPositionWithoutTransition, wrapNext, wrapPrev]);

  // Button navigation (synchronous sequential steps using currentIndexRef)
  const handlePrev = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isWrappingRef.current) {
      pendingNavRef.current = 'prev';
      return;
    }
    if (isZoomedRef.current) {
      setScale(1);
      scaleRef.current = 1;
      setIsZoomed(false);
      isZoomedRef.current = false;
      setPan({ x: 0, y: 0 });
      panRef.current = { x: 0, y: 0 };
    }
    const current = currentIndexRef.current;
    if (current > 0) {
      goToSlide(current - 1, 'prev');
    } else if (totalImages > 1) {
      wrapPrev();
    }
  }, [totalImages, goToSlide, wrapPrev]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (isWrappingRef.current) {
      pendingNavRef.current = 'next';
      return;
    }
    if (isZoomedRef.current) {
      setScale(1);
      scaleRef.current = 1;
      setIsZoomed(false);
      isZoomedRef.current = false;
      setPan({ x: 0, y: 0 });
      panRef.current = { x: 0, y: 0 };
    }
    const current = currentIndexRef.current;
    if (current < totalImages - 1) {
      goToSlide(current + 1, 'next');
    } else if (totalImages > 1) {
      wrapNext();
    }
  }, [totalImages, goToSlide, wrapNext]);

  // Keep references fresh for wrap timeout execution
  useEffect(() => {
    handleNextRef.current = handleNext;
    handlePrevRef.current = handlePrev;
  }, [handleNext, handlePrev]);

  // Desktop Lightbox Keyboard Navigation (Phase 61: ArrowLeft / ArrowRight only in desktop lightbox)
  useEffect(() => {
    // 1. Only active when isLightbox === true
    if (!isLightbox) return;

    const mediaQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px) and (hover: hover)')
      : null;

    let isDesktopHover = mediaQuery ? mediaQuery.matches : false;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle ArrowLeft and ArrowRight
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      // Only on desktop (md breakpoint and up with hover capability)
      if (!isDesktopHover) return;

      // Ignore if fewer than 2 images
      if (totalImages <= 1) return;

      // 3. One step per press: ignore auto-repeat events
      if (e.repeat) return;

      // 5. Ignore when a modifier key is held (Ctrl/Alt/Meta/Shift)
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

      // 5. Ignore when focus is inside an input, textarea, select, or contenteditable
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
      }

      // 4. Call e.preventDefault() so the page/modal behind the lightbox does not scroll
      e.preventDefault();

      // 2. ArrowRight -> handleNext(), ArrowLeft -> handlePrev()
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    const handleMediaChange = (evt: MediaQueryListEvent) => {
      isDesktopHover = evt.matches;
    };

    window.addEventListener('keydown', handleKeyDown);
    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleMediaChange);
      } else if (typeof (mediaQuery as any).addListener === 'function') {
        (mediaQuery as any).addListener(handleMediaChange);
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleMediaChange);
        } else if (typeof (mediaQuery as any).removeListener === 'function') {
          (mediaQuery as any).removeListener(handleMediaChange);
        }
      }
    };
  }, [isLightbox, totalImages, handleNext, handlePrev]);

  const prevSyncedIndexRef = useRef(activeImageIndex);

  // Synchronize track position when activeImageIndex or containerWidth changes (when not dragging)
  // Navigation initiated inside the slider already positions/animates the track itself.
  // Only external index changes (photo grid selection, lightbox thumbnail strip, hover preview, car switch)
  // should go through applyPositionWithoutTransition.
  useEffect(() => {
    const isInternal = isInternalNavRef.current;
    isInternalNavRef.current = false;

    if (isWrappingRef.current) return;
    const prevIndex = prevSyncedIndexRef.current;
    prevSyncedIndexRef.current = activeImageIndex;
    const wasExternalChange = currentIndexRef.current !== activeImageIndex;
    currentIndexRef.current = activeImageIndex;

    // Navigation initiated inside the slider (buttons, swipe, click zones) already positions/animates the track
    if (isInternal) {
      return;
    }

    if (isDraggingRef.current) return;
    const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
    if (!trackRef.current || width <= 0) return;

    const isExternalChange = wasExternalChange || activeImageIndex !== prevIndex;

    if (isExternalChange) {
      // Clean non-sliding jump for external changes (photo grid selection, lightbox thumbnail strip, hover preview, car switch)
      applyPositionWithoutTransition(activeImageIndex);
    } else {
      // Container width / resize sync
      trackRef.current.style.transform = `translateX(${-activeImageIndex * width}px)`;
    }
  }, [activeImageIndex, containerWidth, applyPositionWithoutTransition]);

  // On Drag Start for Slider Track
  const onDragStart = useCallback((clientX: number, clientY: number) => {
    if (totalImages <= 1) return;
    if (isWrappingRef.current) return;
    const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
    if (width <= 0) return;

    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = clientX;
    startYRef.current = clientY;
    diffRef.current = 0;
    dragStartTimeRef.current = Date.now();
    isHorizontalDragRef.current = null;
    currentTranslateRef.current = -currentIndexRef.current * width;

    if (trackRef.current) {
      trackRef.current.classList.add('dragging');
    }
  }, [totalImages, containerWidth]);

  // On Drag Move for Slider Track
  const onDragMove = useCallback((clientX: number, clientY: number, e?: TouchEvent | MouseEvent) => {
    if (!isDraggingRef.current) return;

    const dx = clientX - startXRef.current;
    const dy = clientY - startYRef.current;

    // Detect direction intent on first few pixels
    if (isHorizontalDragRef.current === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        isHorizontalDragRef.current = Math.abs(dx) >= Math.abs(dy);
      }
    }

    // User is scrolling vertically, cancel slider drag so page scrolls natively
    if (isHorizontalDragRef.current === false) {
      if (trackRef.current) {
        trackRef.current.classList.remove('dragging');
        const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
        trackRef.current.style.transform = `translateX(${-currentIndexRef.current * width}px)`;
      }
      isDraggingRef.current = false;
      setIsDragging(false);
      return;
    }

    if (isHorizontalDragRef.current === true && e && e.cancelable) {
      e.preventDefault();
    }

    let diff = dx;
    const currentIdx = currentIndexRef.current;
    // Rubber-band resistance if dragging past first or last slide
    if (currentIdx === 0 && diff > 0) {
      diff = diff * 0.35;
    } else if (currentIdx === totalImages - 1 && diff < 0) {
      diff = diff * 0.35;
    }

    diffRef.current = diff;

    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${currentTranslateRef.current + diff}px)`;
    }
  }, [totalImages, containerWidth]);

  // On Drag End for Slider Track (Issue 3: boundary wrap-around navigation)
  const onDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    const diff = diffRef.current;
    const currentIdx = currentIndexRef.current;
    const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
    const threshold = width * 0.25;

    if (trackRef.current) {
      trackRef.current.classList.remove('dragging');
    }

    const elapsed = Date.now() - dragStartTimeRef.current;
    const isBoundary =
      (currentIdx === totalImages - 1 && diff < 0) ||
      (currentIdx === 0 && diff > 0);
    const effectiveThreshold = isBoundary ? threshold * 0.45 : threshold;
    const isQuickFlick = elapsed < 320 && Math.abs(diff) > (isBoundary ? 20 : 35);

    if (Math.abs(diff) < effectiveThreshold && !isQuickFlick) {
      // Snap back smoothly if gesture threshold is not reached
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(${-currentIdx * width}px)`;
      }
    } else {
      // Go to next or prev
      if (diff < 0) {
        // Next slide (wrap around smoothly to first image when swiping past the last image)
        if (currentIdx < totalImages - 1) {
          goToSlide(currentIdx + 1, 'next');
        } else if (totalImages > 1) {
          wrapNext();
        } else {
          if (trackRef.current) {
            trackRef.current.style.transform = `translateX(${-currentIdx * width}px)`;
          }
        }
      } else {
        // Prev slide (wrap around smoothly to last image when swiping before the first image)
        if (currentIdx > 0) {
          goToSlide(currentIdx - 1, 'prev');
        } else if (totalImages > 1) {
          wrapPrev();
        } else {
          if (trackRef.current) {
            trackRef.current.style.transform = `translateX(0px)`;
          }
        }
      }
    }

    // Reset after a brief delay so click handlers can inspect diffRef
    setTimeout(() => {
      diffRef.current = 0;
      isHorizontalDragRef.current = null;
    }, 50);
  }, [totalImages, containerWidth, goToSlide, wrapNext, wrapPrev]);

  const onDragCancel = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    const width = containerRef.current ? containerRef.current.clientWidth : containerWidth;
    if (trackRef.current) {
      trackRef.current.classList.remove('dragging');
      trackRef.current.style.transform = `translateX(${-currentIndexRef.current * width}px)`;
    }
    diffRef.current = 0;
    isHorizontalDragRef.current = null;
  }, [containerWidth]);

  // Touch listener attached with non-passive touchmove for gesture control & zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Issue 1: If touch starts on a button or control, ignore so control handles it directly
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest('button') ||
          target.closest('#btn-all-photos-grid') ||
          target.closest('#badge-detail-image-counter'))
      ) {
        isTouchOnControlRef.current = true;
        return;
      }
      isTouchOnControlRef.current = false;

      // Pinch-zoom with 2 fingers
      if (e.touches.length === 2) {
        e.preventDefault();
        onDragCancel();
        pinchStartDistRef.current = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        pinchStartScaleRef.current = scaleRef.current;
        isPinchingRef.current = true;
        isDraggingRef.current = true;
        setIsDragging(true);
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        touchStartTimeRef.current = Date.now();

        // When zoomed, 1 finger pans the zoomed image, NOT changing slide
        if (scaleRef.current > 1.05) {
          isDraggingRef.current = true;
          setIsDragging(true);
          panStartXRef.current = touch.clientX;
          panStartYRef.current = touch.clientY;
          panStartPosRef.current = { ...panRef.current };
          return;
        }

        // Standard slider swipe
        onDragStart(touch.clientX, touch.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isTouchOnControlRef.current) return;

      // Pinching with 2 fingers
      if (e.touches.length === 2 && isPinchingRef.current) {
        e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        if (pinchStartDistRef.current > 0) {
          let newScale = pinchStartScaleRef.current * (currentDist / pinchStartDistRef.current);
          newScale = Math.max(1, Math.min(3.5, newScale));
          scaleRef.current = newScale;
          setScale(newScale);
          if (newScale > 1.05) {
            isZoomedRef.current = true;
            setIsZoomed(true);
          } else {
            isZoomedRef.current = false;
            setIsZoomed(false);
            setPan({ x: 0, y: 0 });
            panRef.current = { x: 0, y: 0 };
          }
        }
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];

        // When zoomed, pan within the zoomed image
        if (scaleRef.current > 1.05) {
          e.preventDefault();
          const dx = touch.clientX - panStartXRef.current;
          const dy = touch.clientY - panStartYRef.current;

          const containerH = container.clientHeight || 400;
          const maxX = Math.max(0, (containerWidth * (scaleRef.current - 1)) / 2);
          const maxY = Math.max(0, (containerH * (scaleRef.current - 1)) / 2);

          const newPanX = Math.max(-maxX, Math.min(maxX, panStartPosRef.current.x + dx));
          const newPanY = Math.max(-maxY, Math.min(maxY, panStartPosRef.current.y + dy));

          panRef.current = { x: newPanX, y: newPanY };
          setPan({ x: newPanX, y: newPanY });
          return;
        }

        // Standard slider drag
        onDragMove(touch.clientX, touch.clientY, e);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Issue 1: If touch was on a button or control, exit immediately
      if (isTouchOnControlRef.current) {
        isTouchOnControlRef.current = false;
        return;
      }

      lastTouchTimeRef.current = Date.now();

      // Pinch end
      if (isPinchingRef.current) {
        isPinchingRef.current = false;
        isDraggingRef.current = false;
        setIsDragging(false);
        if (scaleRef.current <= 1.05) {
          setScale(1);
          scaleRef.current = 1;
          setIsZoomed(false);
          isZoomedRef.current = false;
          setPan({ x: 0, y: 0 });
          panRef.current = { x: 0, y: 0 };
        }
        return;
      }

      const touch = e.changedTouches[0];
      const now = Date.now();
      const distFromStart = touch
        ? Math.hypot(touch.clientX - touchStartPosRef.current.x, touch.clientY - touchStartPosRef.current.y)
        : 0;

      // When zoomed in (scale > 1.05)
      if (scaleRef.current > 1.05) {
        // Double-tap to zoom out
        if (distFromStart < 15 && (now - touchStartTimeRef.current < 320)) {
          if (now - lastTapRef.current < 320) {
            e.preventDefault();
            lastDoubleTapTimeRef.current = now;
            lastTapRef.current = 0;
            if (singleTapTimeoutRef.current) {
              clearTimeout(singleTapTimeoutRef.current);
              singleTapTimeoutRef.current = null;
            }

            // Zoom out to 1x
            setScale(1);
            scaleRef.current = 1;
            setIsZoomed(false);
            isZoomedRef.current = false;
            setPan({ x: 0, y: 0 });
            panRef.current = { x: 0, y: 0 };
            isDraggingRef.current = false;
            setIsDragging(false);
            onDragCancel();
            return;
          } else {
            lastTapRef.current = now;
          }
        }

        // ISSUE 4: Detect swipe-to-navigate while zoomed
        // If the user makes a clear, deliberate horizontal swipe gesture, switch slides and reset zoom to 1x
        if (touch && totalImages > 1) {
          const dx = touch.clientX - touchStartPosRef.current.x;
          const dy = touch.clientY - touchStartPosRef.current.y;
          const dt = Math.max(1, now - touchStartTimeRef.current);
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          const speedX = absDx / dt;

          const isHorizontalMotion = absDx >= absDy * 1.5 && absDy < 80;
          const isQuickFlick = absDx >= 45 && dt < 350 && speedX >= 0.35;
          const isSubstantialSwipe = absDx >= 85 && dt < 650 && absDx >= absDy * 2;

          if (isHorizontalMotion && (isQuickFlick || isSubstantialSwipe)) {
            // Reset zoom back to 1x for the newly selected image
            setScale(1);
            scaleRef.current = 1;
            setIsZoomed(false);
            isZoomedRef.current = false;
            setPan({ x: 0, y: 0 });
            panRef.current = { x: 0, y: 0 };
            isDraggingRef.current = false;
            setIsDragging(false);

            if (dx < 0) {
              handleNext();
            } else {
              handlePrev();
            }
            return;
          }
        }

        isDraggingRef.current = false;
        setIsDragging(false);
        return;
      }

      // When not zoomed (scale <= 1.05)
      // Double-tap to zoom in with focal-point targeting (Issue 2)
      if (distFromStart < 15 && (now - touchStartTimeRef.current < 320)) {
        if (now - lastTapRef.current < 320) {
          // Double-tap confirmed! Strictly prevent single tap navigation/click
          e.preventDefault();
          lastDoubleTapTimeRef.current = now;
          lastTapRef.current = 0;
          if (singleTapTimeoutRef.current) {
            clearTimeout(singleTapTimeoutRef.current);
            singleTapTimeoutRef.current = null;
          }

          // Focal-point zoom: calculate pan so tapped point is centered in zoomed view
          const targetScale = 2.5;
          let initialPanX = 0;
          let initialPanY = 0;

          if (container && touch) {
            const rect = container.getBoundingClientRect();
            const tapX = touch.clientX - rect.left;
            const tapY = touch.clientY - rect.top;
            const containerW = rect.width || containerWidth || 400;
            const containerH = rect.height || container.clientHeight || 400;

            const deltaX = tapX - containerW / 2;
            const deltaY = tapY - containerH / 2;

            const rawPanX = -deltaX * (targetScale - 1);
            const rawPanY = -deltaY * (targetScale - 1);

            const maxX = Math.max(0, (containerW * (targetScale - 1)) / 2);
            const maxY = Math.max(0, (containerH * (targetScale - 1)) / 2);

            initialPanX = Math.max(-maxX, Math.min(maxX, rawPanX));
            initialPanY = Math.max(-maxY, Math.min(maxY, rawPanY));
          }

          // Zoom in to 2.5x with focal point
          setScale(targetScale);
          scaleRef.current = targetScale;
          setIsZoomed(true);
          isZoomedRef.current = true;
          setPan({ x: initialPanX, y: initialPanY });
          panRef.current = { x: initialPanX, y: initialPanY };

          onDragCancel();
          return;
        } else {
          lastTapRef.current = now;
          // Trigger onImageClick ONLY if a second tap does NOT follow within 300ms (and not in lightbox)
          if (!isZoomedRef.current && !isLightbox && onImageClick) {
            if (singleTapTimeoutRef.current) {
              clearTimeout(singleTapTimeoutRef.current);
            }
            const clickIdx = currentIndexRef.current;
            singleTapTimeoutRef.current = setTimeout(() => {
              if (Date.now() - lastDoubleTapTimeRef.current > 500) {
                onImageClick(clickIdx);
              }
              singleTapTimeoutRef.current = null;
            }, 300);
          }
        }
      }

      onDragEnd();
    };

    const handleTouchCancel = () => {
      if (isTouchOnControlRef.current) {
        isTouchOnControlRef.current = false;
        return;
      }

      lastTouchTimeRef.current = Date.now();
      isPinchingRef.current = false;
      isDraggingRef.current = false;
      setIsDragging(false);
      onDragCancel();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [containerWidth, onDragStart, onDragMove, onDragEnd, onDragCancel, isLightbox, onImageClick, totalImages, handleNext, handlePrev]);

  // Desktop Mouse Drag Handling (Standard drag only; desktop has no zoom capability - Issue 1)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left-click

    // Ignore drag start if clicking buttons or controls
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('#badge-detail-image-counter')) {
      return;
    }

    onDragStart(e.clientX, e.clientY);

    const handleMouseMove = (me: MouseEvent) => {
      onDragMove(me.clientX, me.clientY, me);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Slide click handler (Desktop lightbox navigation / click to open modal)
  const handleSlideClick = (index: number, e: React.MouseEvent) => {
    // If click is synthetic from a touch event or occurred right after a double tap, ignore it! (Issue 3)
    const isSyntheticTouchClick =
      Date.now() - lastTouchTimeRef.current < 700 ||
      Date.now() - lastDoubleTapTimeRef.current < 1000;

    if (isSyntheticTouchClick) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (isWrappingRef.current || Math.abs(diffRef.current) >= 6 || isZoomed || scaleRef.current > 1.05) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (isLightbox) {
      if (totalImages > 1) {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = rect.width > 0 ? clickX / rect.width : 0.5;
        if (ratio <= 0.35) {
          handlePrev(e);
        } else if (ratio >= 0.65) {
          handleNext(e);
        }
      }
    } else {
      if (onImageClick) {
        onImageClick(index);
      }
    }
  };

  const displayIndex =
    wrapVisualIndex !== null
      ? wrapVisualIndex === -1
        ? totalImages - 1
        : 0
      : activeImageIndex;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className={`relative select-none overflow-hidden block ${
        isLightbox
          ? 'h-full w-full flex-1 min-h-0 bg-black cursor-default'
          : `group ${className || 'bg-black w-full aspect-[4/3] md:aspect-auto md:h-[500px] mx-auto flex items-center justify-center'} ${
              isZoomed ? 'cursor-move' : 'cursor-grab active:cursor-grabbing'
            }`
      }`}
      style={{ backgroundColor: '#000000', touchAction: isZoomed ? 'none' : 'pan-y' }}
    >
      {/* Smooth Slider Track */}
      <div
        ref={trackRef}
        className="slider-track relative flex h-full w-full bg-black"
        style={{
          transform:
            wrapVisualIndex !== null
              ? wrapVisualIndex === -1
                ? containerWidth > 0 ? `translateX(${containerWidth}px)` : 'translateX(0px)'
                : containerWidth > 0 ? `translateX(${-wrapVisualIndex * containerWidth}px)` : 'translateX(0px)'
              : containerWidth > 0 ? `translateX(${-activeImageIndex * containerWidth}px)` : 'translateX(0px)',
        }}
      >
        {/* Clone of Last Slide (Prepended absolutely at -100% for smooth backward wrap) */}
        {totalImages > 1 && (
          <div
            key="clone-last-slide"
            aria-hidden="true"
            className="absolute top-0 bottom-0 h-full flex items-center justify-center overflow-hidden bg-black select-none pointer-events-none"
            style={{
              left: 0,
              width: containerWidth > 0 ? `${containerWidth}px` : '100%',
              transform: 'translateX(-100%)',
            }}
          >
            <SlideImage
              src={imagesList[totalImages - 1]}
              alt={`${safeTitle} - last clone`}
              isActiveSlide={false}
              isNearActive={true}
              isLightbox={isLightbox}
              isZoomed={false}
              isDragging={isDragging}
              scale={1}
              pan={{ x: 0, y: 0 }}
            />
          </div>
        )}

        {imagesList.map((imgSrc, index) => {
          const isActiveSlide = index === activeImageIndex;
          const isNearActive =
            Math.abs(index - activeImageIndex) <= 1 ||
            (totalImages > 1 && (
              (activeImageIndex === 0 && index === totalImages - 1) ||
              (activeImageIndex === totalImages - 1 && index === 0)
            ));

          return (
            <div
              key={`${index}-${imgSrc}`}
              onClick={(e) => handleSlideClick(index, e)}
              className="w-full h-full shrink-0 flex items-center justify-center overflow-hidden relative bg-black select-none"
              style={{ width: containerWidth > 0 ? `${containerWidth}px` : '100%' }}
            >
              <SlideImage
                src={imgSrc}
                alt={`${safeTitle} - ${index + 1}`}
                isActiveSlide={isActiveSlide}
                isNearActive={isNearActive}
                isLightbox={isLightbox}
                isZoomed={isZoomed}
                isDragging={isDragging}
                scale={scale}
                pan={pan}
              />
            </div>
          );
        })}

        {/* Clone of First Slide (Appended in normal flex flow for smooth forward wrap) */}
        {totalImages > 1 && (
          <div
            key="clone-first-slide"
            aria-hidden="true"
            className="w-full h-full shrink-0 flex items-center justify-center overflow-hidden relative bg-black select-none pointer-events-none"
            style={{ width: containerWidth > 0 ? `${containerWidth}px` : '100%' }}
          >
            <SlideImage
              src={imagesList[0]}
              alt={`${safeTitle} - first clone`}
              isActiveSlide={false}
              isNearActive={true}
              isLightbox={isLightbox}
              isZoomed={false}
              isDragging={isDragging}
              scale={1}
              pan={{ x: 0, y: 0 }}
            />
          </div>
        )}
      </div>

      {/* Turbo.az Image Controls: Bottom-Center Counter & Bottom-Right "Bütün şəkillər" Button */}
      {!isLightbox && (
        <>
          {/* Mərkəzi Şəkil Sayğacı (Bottom-Center, bg-black/40 backdrop-blur-sm, desktopda hover zamanı) */}
          <div
            id="badge-detail-image-counter"
            className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-medium opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 select-none shadow-xs"
          >
            <span>{displayIndex + 1}</span>
            <span className="text-white/60 font-light">/</span>
            <span>{totalImages}</span>
          </div>

          {/* Sağ Aşağı "Bütün şəkillər" Düyməsi (Bottom-Right, Frosted Glass light look) */}
          {onOpenPhotoGrid && totalImages > 1 && (
            <button
              type="button"
              id="btn-all-photos-grid"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenPhotoGrid();
              }}
              className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex md:hidden items-center gap-1.5 backdrop-blur-md bg-white/70 hover:bg-white/90 text-gray-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/20 transition-all cursor-pointer select-none active:scale-95 shadow-xs"
              title="Bütün şəkillər"
              aria-label="Bütün şəkillər"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-gray-700" />
              <span>Bütün şəkillər</span>
            </button>
          )}
        </>
      )}

      {/* Turbo.az Desktop Ox Düymələri (Desktop button-only navigation, Issue 1) */}
      {totalImages > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={`hidden sm:flex absolute left-3.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 text-white items-center justify-center z-20 border border-white/20 transition-all cursor-pointer shadow-md ${
              !isLightbox
                ? 'opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 duration-200'
                : 'opacity-100'
            }`}
            title="Əvvəlki şəkil"
            aria-label="Əvvəlki şəkil"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={`hidden sm:flex absolute right-3.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 active:scale-95 text-white items-center justify-center z-20 border border-white/20 transition-all cursor-pointer shadow-md ${
              !isLightbox
                ? 'opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 duration-200'
                : 'opacity-100'
            }`}
            title="Növbəti şəkil"
            aria-label="Növbəti şəkil"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}
    </div>
  );
};
