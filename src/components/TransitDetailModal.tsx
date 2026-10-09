import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, Variants, MotionValue, animate, usePresence } from 'motion/react';
import { X } from 'lucide-react';
import { TransitCar } from '../types';
import { WHATSAPP_NUMBER } from '../data/transits';
import { DEFAULT_VEHICLE_PLACEHOLDER, getThumbnailUrl, isThumbnailFailed } from '../utils/imageFallback';
import { useBodyScrollLock } from '../utils/scrollLock';
import { TurboImageSlider } from './TurboImageSlider';
import { prefetchImages, prefetchCarouselWindow } from '../utils/imagePreloader';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSwipeToClose } from '../hooks/useSwipeToClose';
import { DETAIL_OPEN_TRANSITION, DETAIL_CLOSE_TRANSITION } from '../utils/detailTransition';
import { buildWhatsappInquiry } from '../utils/whatsappMessage';

// Subcomponents
import { DetailModalErrorBoundary } from './detail/DetailModalErrorBoundary';
import { 
  formatNumberSafe, 
  formatBrandDisplayName, 
  formatModelDisplayName, 
  parseAndFilterFeatures 
} from './detail/detailUtils';
import { DetailMobileHeader } from './detail/DetailMobileHeader';
import { DetailDesktopSidebar } from './detail/DetailDesktopSidebar';
import { DetailMobileTitleBlock } from './detail/DetailMobileTitleBlock';
import { DetailMobileSpecs } from './detail/DetailMobileSpecs';
import { DetailSpecTable } from './detail/DetailSpecTable';
import { DetailThumbnailStrip } from './detail/DetailThumbnailStrip';
import { DetailFeaturesAndShowroom } from './detail/DetailFeaturesAndShowroom';
import { DetailSimilarCars } from './detail/DetailSimilarCars';
import { DetailMobileBottomBar } from './detail/DetailMobileBottomBar';
import { DetailLightbox } from './detail/DetailLightbox';
import { DetailPhotoGrid, probeImagesOrientations } from './detail/DetailPhotoGrid';

export { formatBrandDisplayName, formatModelDisplayName };

export interface TransitDetailModalProps {
  car: TransitCar | null;
  onClose: () => void;
  onBack?: () => void;
  direction?: 'forward' | 'back';
  isFavorite?: boolean;
  onToggleFavorite?: (carId: string) => void;
  allCars?: TransitCar[];
  onSelectCar?: (car: TransitCar) => void;
  favorites?: string[];
  detailX: MotionValue<number>;
}

interface TransitDetailModalContentProps {
  car: TransitCar;
  onClose: () => void;
  onBack?: () => void;
  direction?: 'forward' | 'back';
  isFavorite?: boolean;
  onToggleFavorite?: (carId: string) => void;
  allCars?: TransitCar[];
  onSelectCar?: (car: TransitCar) => void;
  favorites?: string[];
  detailX: MotionValue<number>;
}

// Desktop slide transition variants (Outer shell open/close from catalog)
const desktopSlideVariants: Variants = {
  initial: { 
    y: '100%' 
  },
  animate: { 
    y: 0,
    transition: { 
      duration: 0.45, 
      ease: 'easeOut' 
    } 
  },
  exit: { 
    y: '100%',
    pointerEvents: 'none',
    transition: { 
      duration: 0.35, 
      ease: 'easeIn' 
    } 
  }
};

// Mobile car switch variants (direction-aware)
const mobileCardSwitchVariants: Variants = {
  initial: (direction: 'forward' | 'back') => ({ 
    x: direction === 'back' ? '-20%' : '100%',
    zIndex: direction === 'back' ? 1 : 2,
    boxShadow: direction === 'back' ? 'none' : '-8px 0 24px rgba(0, 0, 0, 0.3)'
  }),
  animate: { 
    x: 0,
    zIndex: 2,
    boxShadow: 'none',
    transition: { 
      duration: 0.55, 
      ease: 'easeOut' 
    } 
  },
  exit: (direction: 'forward' | 'back') => ({ 
    x: direction === 'back' ? '100%' : '-20%',
    zIndex: direction === 'back' ? 2 : 1,
    boxShadow: direction === 'back' ? '-8px 0 24px rgba(0, 0, 0, 0.3)' : 'none',
    pointerEvents: 'none',
    transition: { 
      duration: 0.35, 
      ease: 'easeIn' 
    } 
  })
};

// Desktop car switch variants (direction-aware)
const desktopCardSwitchVariants: Variants = {
  initial: (direction: 'forward' | 'back') => ({ 
    y: direction === 'back' ? 0 : '100%',
    opacity: direction === 'back' ? 0.3 : 1,
    zIndex: direction === 'back' ? 1 : 2,
    boxShadow: direction === 'back' ? 'none' : '0 -8px 24px rgba(0, 0, 0, 0.3)'
  }),
  animate: { 
    y: 0,
    opacity: 1,
    zIndex: 2,
    boxShadow: 'none',
    transition: { 
      duration: 0.45, 
      ease: 'easeOut' 
    } 
  },
  exit: (direction: 'forward' | 'back') => ({ 
    y: direction === 'back' ? '100%' : 0,
    opacity: direction === 'back' ? 1 : 0.3,
    zIndex: direction === 'back' ? 2 : 1,
    boxShadow: direction === 'back' ? '0 -8px 24px rgba(0, 0, 0, 0.3)' : 'none',
    pointerEvents: 'none',
    transition: { 
      duration: 0.35, 
      ease: 'easeIn' 
    } 
  })
};

// ----------------------------------------------------------------------
// KEYED INNER CONTENT PANEL (Modal Card & Contents)
// ----------------------------------------------------------------------
interface TransitDetailCardProps {
  car: TransitCar;
  isMobile: boolean;
  onClose: () => void;
  onBack?: () => void;
  direction?: 'forward' | 'back';
  isFavorite: boolean;
  onToggleFavorite?: (carId: string) => void;
  allCars: TransitCar[];
  onSelectSimilarCar: (car: TransitCar) => void;
  favorites: string[];
  isPhotoGridOpen: boolean;
  isLightboxOpen: boolean;
  openPhotoGrid: () => void;
  openLightbox: (source?: 'detail' | 'grid', index?: number) => void;
  parentActiveImageIndex: number;
  onParentActiveImageChange: (index: number) => void;
}

const TransitDetailCard: React.FC<TransitDetailCardProps> = ({
  car,
  isMobile,
  onClose,
  onBack,
  direction = 'forward',
  isFavorite,
  onToggleFavorite,
  allCars,
  onSelectSimilarCar,
  favorites,
  isPhotoGridOpen,
  isLightboxOpen,
  openPhotoGrid,
  openLightbox,
  parentActiveImageIndex,
  onParentActiveImageChange
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync with parent activeImageIndex when updated externally (e.g. from lightbox)
  useEffect(() => {
    setActiveImageIndex(parentActiveImageIndex);
    setPreviewImageIndex(null);
  }, [parentActiveImageIndex, car?.id]);

  // Ensure scroll container starts at top on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, []);

  // Safe Image Array Extraction
  const imagesList = useMemo(() => {
    if (!car) return [];
    const list: string[] = [];
    
    // Add primaryImage first if valid
    if (car?.primaryImage && typeof car.primaryImage === 'string' && car.primaryImage.trim().length > 0) {
      list.push(car.primaryImage.trim());
    }

    // Add secondary images safely
    if (car?.images && Array.isArray(car.images)) {
      for (const img of car.images) {
        if (typeof img === 'string' && img.trim().length > 0 && !list.includes(img.trim())) {
          list.push(img.trim());
        }
      }
    }

    return list.length > 0 ? list : [DEFAULT_VEHICLE_PLACEHOLDER];
  }, [car]);

  // Progressive Preloading & Early Orientation Probing: Detail pəncərəsi açılanda və ya maşın dəyişəndə
  // bütün şəkillərin kiçik miniatürlərini arxa fonda yüklə və oriyentasiyalarını qabaqcadan təyin et
  useEffect(() => {
    if (!imagesList || imagesList.length === 0) return;
    const t = setTimeout(() => {
      const thumbsToPrefetch = imagesList
        .map((img) => getThumbnailUrl(img))
        .filter((thumb) => Boolean(thumb) && !isThumbnailFailed(thumb));
      prefetchImages(thumbsToPrefetch);
      prefetchImages(imagesList.slice(0, 4));
      probeImagesOrientations(imagesList);
    }, 800);
    return () => clearTimeout(t);
  }, [imagesList]);

  // Aktiv şəkil dəyişdikdə: Növbəti 2 və əvvəlki 1 şəkli arxa fonda təmin et
  useEffect(() => {
    if (imagesList && imagesList.length > 0) {
      prefetchCarouselWindow(imagesList, activeImageIndex);
    }
  }, [imagesList, activeImageIndex]);

  // Safe fallback values
  const safeTitle = car?.title || 'Ford Transit';
  const safeMake = formatBrandDisplayName(car?.brand || car?.make, car?.title);
  const safeModel = formatModelDisplayName(car?.model, car?.title);
  const safeYear = car?.year ? String(car.year) : '';
  const safePrice = formatNumberSafe(car?.price, '0');
  const safeMileage = formatNumberSafe(car?.mileage, '0');
  const safeEngine = car?.engine ? String(car.engine).trim() : '';
  const safeFuelType = car?.fuelType ? String(car.fuelType).trim() : '';
  const safeTransmission = car?.transmission ? String(car.transmission).trim() : '';
  const safeBodyType = car?.bodyType ? String(car.bodyType).trim() : '';
  const safeColor = car?.color ? String(car.color).trim() : '';
  const safeWheelDrive = car?.wheelDrive ? String(car.wheelDrive).trim() : '';
  const safeBaseLength = car?.baseLength ? String(car.baseLength).trim() : '';
  const safeRoofHeight = car?.roofHeight ? String(car.roofHeight).trim() : '';
  const safeLocation = car?.city || car?.location || 'Bakı';
  const safeCondition = car?.condition ? String(car.condition).trim() : '';
  const safeHp = car?.hp ? `${car.hp} a.g.` : '';
  const safeSeatCount = car?.seatCount ? String(car.seatCount).trim() : '';

  // Subtitle format without horsepower
  const engineSubtitle = safeEngine ? (safeEngine.toLowerCase().includes('l') ? safeEngine : `${safeEngine} L`) : '';
  const vehicleMainTitle = [
    safeTitle,
    engineSubtitle,
    safeYear ? `${safeYear} il` : ''
  ].filter(Boolean).join(', ');

  const carDirectLink = useMemo(() => {
    if (typeof window === 'undefined' || !car?.id) {
      return `https://kosalarauto.az/?car=${car?.id || ''}`;
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('car', car.id);
      return url.toString();
    } catch {
      return `${window.location.origin}/?car=${encodeURIComponent(car.id)}`;
    }
  }, [car?.id]);

  const shareUrl = carDirectLink;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${vehicleMainTitle} - Kosalar Auto`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      // Fallback
    }
  };

  const whatsappMsg = useMemo(() => {
    const vehicleTitle = safeYear ? `${safeTitle}, ${safeYear} il` : safeTitle;
    return buildWhatsappInquiry(vehicleTitle, safePrice, carDirectLink);
  }, [safeTitle, safeYear, safePrice, carDirectLink]);

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`;

  // Safe Features Parser (Only returns active/true features)
  const activeFeaturesList = useMemo(() => {
    return parseAndFilterFeatures(car?.features);
  }, [car?.features]);

  // Turbo.az Style: Similar Cars (Bənzər elanlar) Algorithm
  const similarCars = useMemo(() => {
    if (!allCars || allCars.length === 0 || !car) return [];
    
    // Filter out current car and sold cars
    const activeInventory = allCars.filter(c => c.id !== car.id && c.status !== 'sold');
    if (activeInventory.length === 0) return [];

    const currentBrand = (car.brand || car.make || '').toLowerCase();
    const currentModel = (car.model || '').toLowerCase();
    const currentBody = (car.bodyType || '').toLowerCase();
    const currentFuel = (car.fuelType || '').toLowerCase();
    const currentPrice = car.price || 0;

    const scored = activeInventory.map(item => {
      let score = 0;
      const itemBrand = (item.brand || item.make || '').toLowerCase();
      const itemModel = (item.model || '').toLowerCase();
      const itemBody = (item.bodyType || '').toLowerCase();
      const itemFuel = (item.fuelType || '').toLowerCase();
      const itemPrice = item.price || 0;

      // 1. Same Brand (+50 pts)
      if (currentBrand && itemBrand && (currentBrand === itemBrand || currentBrand.includes(itemBrand) || itemBrand.includes(currentBrand))) {
        score += 50;
      }
      // 2. Same Model (+40 pts)
      if (currentModel && itemModel && (currentModel === itemModel || currentModel.includes(itemModel) || itemModel.includes(currentModel))) {
        score += 40;
      }
      // 3. Same Body Type (+25 pts)
      if (currentBody && itemBody && currentBody === itemBody) {
        score += 25;
      }
      // 4. Same Fuel Type (+15 pts)
      if (currentFuel && itemFuel && currentFuel === itemFuel) {
        score += 15;
      }
      // 5. Close Price Range (+20 pts for <= 20% diff, +10 for <= 40%)
      if (currentPrice > 0 && itemPrice > 0) {
        const diffRatio = Math.abs(currentPrice - itemPrice) / currentPrice;
        if (diffRatio <= 0.2) score += 20;
        else if (diffRatio <= 0.4) score += 10;
      }
      // 6. Base Length match (+10 pts)
      if (car.baseLength && item.baseLength && car.baseLength === item.baseLength) {
        score += 10;
      }

      return { car: item, score };
    });

    // Sort by relevance score descending. For equal scores, use stable secondary order (newest listing first)
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const yearDiff = (b.car.year || 0) - (a.car.year || 0);
      if (yearDiff !== 0) return yearDiff;
      return String(b.car.id).localeCompare(String(a.car.id));
    });

    return scored.map(s => s.car);
  }, [allCars, car]);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full bg-white flex flex-col overflow-hidden overscroll-contain"
      custom={direction}
      variants={isMobile ? mobileCardSwitchVariants : desktopCardSwitchVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Top Sticky Header with Desktop Close Button */}
      <div className="relative w-full shrink-0 [&>div:first-child]:md:pr-16">
        <DetailMobileHeader
          onClose={onBack || onClose}
          onShare={handleShare}
          copied={copied}
          isFavorite={isFavorite}
          onToggleFavorite={() => {
            if (car?.id && onToggleFavorite) {
              onToggleFavorite(car.id);
            }
          }}
        />

        {/* Desktop Close (X) Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClose();
          }}
          className="hidden md:flex absolute top-3.5 right-4 z-40 w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer"
          title="Bağla (Esc)"
          aria-label="Bağla"
        >
          <X className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* Modal Scrollable Content */}
      <div ref={scrollContainerRef} className="overflow-y-auto flex-1 min-h-0 bg-white block w-full overscroll-contain">
        {/* RESPONSIVE HERO SECTION */}
        <div className="flex flex-col md:flex-row md:items-start w-full bg-white border-b border-slate-200">
          {/* Sol Sütun (Şəkil Sahəsi və altında Xüsusiyyətlər Cədvəli - Desktopda 58%-60% enində) */}
          <div className="w-full md:w-[58%] lg:w-[60%] shrink-0 flex flex-col bg-white">
            {/* Şəkil Sahəsi - sabit 4:3 nisbətində, tam qara arxafon */}
            <div className="w-full bg-black flex items-center justify-center overflow-hidden relative aspect-[4/3]">
              <TurboImageSlider
                key={`modal-slider-${car?.id}`}
                images={imagesList}
                activeImageIndex={previewImageIndex !== null ? previewImageIndex : activeImageIndex}
                onIndexChange={(idx) => {
                  setPreviewImageIndex(null);
                  setActiveImageIndex(idx);
                  onParentActiveImageChange(idx);
                }}
                safeTitle={safeTitle}
                onImageClick={(clickedIndex) => {
                  setPreviewImageIndex(null);
                  const currentDisplayed = previewImageIndex !== null ? previewImageIndex : activeImageIndex;
                  const idx = typeof clickedIndex === 'number' ? clickedIndex : currentDisplayed;
                  setActiveImageIndex(idx);
                  onParentActiveImageChange(idx);
                  openLightbox('detail', idx);
                }}
                onOpenPhotoGrid={openPhotoGrid}
                disabledKeyNav={isLightboxOpen || isPhotoGridOpen}
                className="w-full h-full aspect-[4/3] flex items-center justify-center bg-black"
              />
            </div>

            {/* Desktop Thumbnail Strip (Turbo.az stili şəklin altında, yalnız Desktop) */}
            <div className="hidden md:block">
              <DetailThumbnailStrip
                images={imagesList}
                activeImageIndex={activeImageIndex}
                onSelectImage={(idx) => {
                  setPreviewImageIndex(null);
                  setActiveImageIndex(idx);
                  onParentActiveImageChange(idx);
                }}
                onOpenLightboxAt={(idx) => {
                  setPreviewImageIndex(null);
                  setActiveImageIndex(idx);
                  onParentActiveImageChange(idx);
                  openLightbox('detail', idx);
                }}
                onHoverPreview={(idx) => {
                  setPreviewImageIndex(idx);
                }}
                safeTitle={safeTitle}
              />
            </div>

            {/* Xüsusiyyətlər Cədvəli (Yalnız Desktopda şəklin altında - Turbo.az 2 sütunlu stili) */}
            <div className="hidden md:block p-6 lg:p-7 border-t border-slate-100 bg-white">
              <DetailSpecTable
                safeLocation={safeLocation}
                safeMake={safeMake}
                safeModel={safeModel}
                safeYear={safeYear}
                safeBodyType={safeBodyType}
                safeSeatCount={safeSeatCount}
                safeColor={safeColor}
                safeEngine={safeEngine}
                safeHp={safeHp}
                safeFuelType={safeFuelType}
                safeMileage={safeMileage}
                safeTransmission={safeTransmission}
                safeWheelDrive={safeWheelDrive}
                safeBaseLength={safeBaseLength}
                safeCondition={safeCondition}
              />
            </div>
          </div>

          {/* Sağ Sütun (Qısa və Yapışqan Qiymət/Əlaqə Kartı - YALNIZ Desktopda 40% enində) */}
          <DetailDesktopSidebar
            safePrice={safePrice}
            vehicleMainTitle={vehicleMainTitle}
            safeMileage={safeMileage}
            whatsappUrl={whatsappUrl}
            statusBadges={car?.statusBadges ?? car?.badges}
          />
        </div>

        {/* Məzmun Gövdəsi: Turbo.az strukturu */}
        {(() => {
          const hasSimilarCars = Boolean(similarCars && similarCars.length > 0);
          return (
            <>
              <div className={`p-4 sm:p-5 md:p-6 ${hasSimilarCars ? 'pb-6 md:pb-8' : 'pb-24 md:pb-8'} space-y-4 sm:space-y-5 max-w-5xl mx-auto block w-full`}>
                {/* 1. BAŞLIQ VƏ QİYMƏT (YALNIZ MOBİLDƏ GÖSTƏRİLİR) */}
                <DetailMobileTitleBlock
                  safePrice={safePrice}
                  vehicleMainTitle={vehicleMainTitle}
                  safeMileage={safeMileage}
                  statusBadges={car?.statusBadges ?? car?.badges}
                />

                {/* 2. XÜSUSİYYƏTLƏR CƏDVƏLİ (YALNIZ MOBİLDƏ GÖSTƏRİLİR - TURBO.AZ STİLİ) */}
                <DetailMobileSpecs
                  safeLocation={safeLocation}
                  safeMake={safeMake}
                  safeModel={safeModel}
                  safeYear={safeYear}
                  safeBodyType={safeBodyType}
                  safeSeatCount={safeSeatCount}
                  safeColor={safeColor}
                  safeEngine={safeEngine}
                  safeHp={safeHp}
                  safeFuelType={safeFuelType}
                  safeMileage={safeMileage}
                  safeTransmission={safeTransmission}
                  safeWheelDrive={safeWheelDrive}
                  safeBaseLength={safeBaseLength}
                  safeCondition={safeCondition}
                />

                {/* 3. QEYD VƏ TƏSVİR + 4. TƏCHİZAT + AVTOSALON MƏLUMATI */}
                <DetailFeaturesAndShowroom
                  description={car?.description}
                  activeFeaturesList={activeFeaturesList}
                />
              </div>

              {/* 5. BƏNZƏR ELANLAR (TURBO.AZ STİLİ TAM ENLİ AÇIQ BOZ ZOLAQLI BÖLMƏ) */}
              {hasSimilarCars && (
                <section className="w-full bg-slate-50 border-t border-slate-200">
                  <div className="max-w-5xl mx-auto p-4 sm:p-5 md:p-6 pb-24 md:pb-8">
                    <DetailSimilarCars
                      similarCars={similarCars}
                      favorites={favorites}
                      onToggleFavorite={onToggleFavorite}
                      onSelectSimilarCar={onSelectSimilarCar}
                      currentCarId={car?.id}
                    />
                  </div>
                </section>
              )}
            </>
          );
        })()}
      </div>

      {/* Floating Bottom Action Bar (Zəng et + WhatsApp) - Yalnız Mobil Rejimdə */}
      <DetailMobileBottomBar whatsappUrl={whatsappUrl} />
    </motion.div>
  );
};

// ----------------------------------------------------------------------
// PERSISTENT OUTER SHELL (Backdrop, Open/Close, Scroll Lock, Esc & Popstate)
// ----------------------------------------------------------------------
const TransitDetailModalContent: React.FC<TransitDetailModalContentProps> = ({
  car,
  onClose,
  onBack,
  direction = 'forward',
  isFavorite = false,
  onToggleFavorite,
  allCars = [],
  onSelectCar,
  favorites = [],
  detailX
}) => {
  const isMobile = useIsMobile();
  const [isPresent, safeToRemove] = usePresence();
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMobile) {
      if (!isPresent) safeToRemove?.();
      return;
    }
    if (isPresent) {
      let controls: { stop: () => void } | null = null;
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => {
          controls = animate(detailX, 0, DETAIL_OPEN_TRANSITION);
        });
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
        controls?.stop();
      };
    }
    const controls = animate(detailX, window.innerWidth, DETAIL_CLOSE_TRANSITION);
    controls.then(() => safeToRemove?.());
    return () => controls.stop();
  }, [isPresent, isMobile, detailX, safeToRemove]);

  // Smooth mobile transitions: GPU layer only while moving, subscribe directly without React re-render
  useEffect(() => {
    if (!isMobile) return;
    const apply = () => {
      const el = shellRef.current;
      if (!el) return;
      if (el.style.willChange !== 'transform') el.style.willChange = 'transform';
    };
    apply();
    return detailX.on('change', apply);
  }, [detailX, isMobile]);

  useEffect(() => {
    if (!isMobile || !isPresent) return;
    if (detailX.get() !== 0) {
      const controls = animate(detailX, 0, DETAIL_OPEN_TRANSITION);
      return () => controls.stop();
    }
  }, [car.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bulletproof Body Scroll Lock when modal is open (exact single instance on outer shell)
  useBodyScrollLock(true);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Overlay (grid/lightbox) states
  const [isPhotoGridOpen, setIsPhotoGridOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxSource, setLightboxSource] = useState<'detail' | 'grid'>('detail');
  const photoGridScrollPositionRef = useRef<number>(0);

  // Mobile swipe right to close the detail panel
  useSwipeToClose(shellRef, {
    enabled: isMobile && isPresent && !isLightboxOpen && !isPhotoGridOpen,
    detailX,
    onClose: onBack || onClose,
    resetKey: car.id
  });

  // Reset active image & overlay states when car changes
  useEffect(() => {
    setActiveImageIndex(0);
    setIsPhotoGridOpen(false);
    setIsLightboxOpen(false);
    setLightboxSource('detail');
    photoGridScrollPositionRef.current = 0;
  }, [car?.id]);

  // Safe Image Array Extraction for overlays
  const imagesList = useMemo(() => {
    if (!car) return [];
    const list: string[] = [];
    
    // Add primaryImage first if valid
    if (car?.primaryImage && typeof car.primaryImage === 'string' && car.primaryImage.trim().length > 0) {
      list.push(car.primaryImage.trim());
    }

    // Add secondary images safely
    if (car?.images && Array.isArray(car.images)) {
      for (const img of car.images) {
        if (typeof img === 'string' && img.trim().length > 0 && !list.includes(img.trim())) {
          list.push(img.trim());
        }
      }
    }

    return list.length > 0 ? list : [DEFAULT_VEHICLE_PLACEHOLDER];
  }, [car]);

  // URL və tarixçə ilə sinxronizasiya (həm açılışda, həm də popstate zamanı)
  const syncOverlaysFromUrl = useCallback(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const overlayParam = params.get('overlay');
      const photoParam = params.get('photo');
      const state = window.history.state || {};

      if (photoParam !== null || state.overlay === 'lightbox') {
        if (photoParam !== null) {
          const photoIdx = parseInt(photoParam, 10);
          if (!isNaN(photoIdx) && photoIdx >= 0) {
            setActiveImageIndex(photoIdx);
          }
        }
        setIsLightboxOpen(true);
        setIsPhotoGridOpen(false);
        if (overlayParam === 'grid' || state.from === 'grid') {
          setLightboxSource('grid');
        } else {
          setLightboxSource('detail');
        }
      } else if (overlayParam === 'grid' || state.overlay === 'grid') {
        setIsPhotoGridOpen(true);
        setIsLightboxOpen(false);
      } else {
        setIsLightboxOpen(false);
        setIsPhotoGridOpen(false);
        photoGridScrollPositionRef.current = 0;
      }
    } catch (e) {
      setIsLightboxOpen(false);
      setIsPhotoGridOpen(false);
      photoGridScrollPositionRef.current = 0;
    }
  }, []);

  const isHistoryNavigatingRef = useRef<boolean>(false);

  useEffect(() => {
    syncOverlaysFromUrl();
    const handleOverlayPopState = () => {
      isHistoryNavigatingRef.current = false;
      syncOverlaysFromUrl();
    };
    window.addEventListener('popstate', handleOverlayPopState);
    return () => window.removeEventListener('popstate', handleOverlayPopState);
  }, [syncOverlaysFromUrl]);

  // Overlay (grid/lightbox) açılışlarını və bağlanışlarını dəqiq idarə edir
  const openPhotoGrid = useCallback(() => {
    isHistoryNavigatingRef.current = false;
    prefetchImages(imagesList);
    photoGridScrollPositionRef.current = 0;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('overlay', 'grid');
      url.searchParams.delete('photo');
      window.history.pushState({ carModal: true, overlay: 'grid' }, '', url.toString());
    } catch (e) {}
    setIsPhotoGridOpen(true);
    setIsLightboxOpen(false);
  }, [imagesList]);

  const closePhotoGrid = useCallback(() => {
    photoGridScrollPositionRef.current = 0;
    if (isHistoryNavigatingRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('overlay') === 'grid' || window.history.state?.overlay === 'grid') {
        isHistoryNavigatingRef.current = true;
        window.history.back();
        setTimeout(() => {
          isHistoryNavigatingRef.current = false;
        }, 150);
        return;
      }
    } catch (e) {}
    setIsPhotoGridOpen(false);
  }, []);

  const openLightbox = useCallback((source: 'detail' | 'grid' = 'detail', index?: number) => {
    isHistoryNavigatingRef.current = false;
    const targetIdx = typeof index === 'number' ? index : activeImageIndex;
    setLightboxSource(source);
    try {
      const url = new URL(window.location.href);
      if (source === 'grid') {
        url.searchParams.set('overlay', 'grid');
      } else {
        url.searchParams.delete('overlay');
      }
      url.searchParams.set('photo', String(targetIdx));
      window.history.pushState({ carModal: true, overlay: 'lightbox', from: source, photo: targetIdx }, '', url.toString());
    } catch (e) {}
    setIsLightboxOpen(true);
    setIsPhotoGridOpen(false);
  }, [activeImageIndex]);

  const closeLightbox = useCallback(() => {
    if (isHistoryNavigatingRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('photo') || window.history.state?.overlay === 'lightbox') {
        isHistoryNavigatingRef.current = true;
        window.history.back();
        setTimeout(() => {
          isHistoryNavigatingRef.current = false;
        }, 150);
        return;
      }
    } catch (e) {}
    setIsLightboxOpen(false);
  }, []);

  // Lightbox-da şəkil dəyişdikdə URL-dəki 'photo' parametrini replaceState ilə yenilə
  const handleLightboxIndexChange = useCallback((newIndex: number) => {
    setActiveImageIndex(newIndex);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('photo', String(newIndex));
      window.history.replaceState({ carModal: true, overlay: 'lightbox', from: lightboxSource, photo: newIndex }, '', url.toString());
    } catch (e) {}
  }, [lightboxSource]);

  // Grid-dən şəkil seçiləndə: grid qeydi tarixçədə qalır, üstünə lightbox əlavə olunur
  const handleSelectPhotoFromGrid = useCallback((index: number) => {
    setActiveImageIndex(index);
    openLightbox('grid', index);
  }, [openLightbox]);

  // Keyboard navigation (Escape to close lightbox, photo grid or modal)
  useEffect(() => {
    if (!car) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Prevent key-repeat if user holds down Escape
        if (e.repeat) return;

        // If a history pop is already in-flight, ignore until popstate resolves to avoid double-popping
        if (isHistoryNavigatingRef.current) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (isLightboxOpen) {
          closeLightbox();
        } else if (isPhotoGridOpen) {
          closePhotoGrid();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [car?.id, isLightboxOpen, isPhotoGridOpen, closeLightbox, closePhotoGrid, onClose]);

  // Safe fallback values for overlays
  const safeTitle = car?.title || 'Ford Transit';
  const safeYear = car?.year ? String(car.year) : '';
  const safePrice = formatNumberSafe(car?.price, '0');
  const safeMileage = formatNumberSafe(car?.mileage, '0');
  const safeEngine = car?.engine ? String(car.engine).trim() : '';

  // Subtitle format without horsepower
  const engineSubtitle = safeEngine ? (safeEngine.toLowerCase().includes('l') ? safeEngine : `${safeEngine} L`) : '';
  const vehicleMainTitle = [
    safeTitle,
    engineSubtitle,
    safeYear ? `${safeYear} il` : ''
  ].filter(Boolean).join(', ');

  // Turbo.az Lightbox details format: e.g. "Mercedes Sprinter, 2.2L, 2012 il, 215 000 km"
  const cleanEngineText = useMemo(() => {
    if (!safeEngine) return '';
    const eng = safeEngine.trim();
    if (eng.toLowerCase().includes('l')) return eng;
    return `${eng}L`;
  }, [safeEngine]);

  const lightboxCarDetails = useMemo(() => {
    const parts = [
      safeTitle,
      cleanEngineText,
      safeYear ? `${safeYear} il` : '',
      safeMileage && safeMileage !== '0' ? `${safeMileage} km` : ''
    ].filter(Boolean);
    return parts.join(', ');
  }, [safeTitle, cleanEngineText, safeYear, safeMileage]);

  // Turbo.az Photo Grid header title format with mileage: e.g. "Mercedes Sprinter, 2.4 L, 2012 il, 215 000 km"
  const photoGridHeaderTitle = useMemo(() => {
    let formattedEngine = '';
    if (safeEngine) {
      const match = safeEngine.trim().match(/^([0-9.]+)\s*l?$/i);
      if (match) {
        formattedEngine = `${match[1]} L`;
      } else {
        formattedEngine = safeEngine.trim();
      }
    }

    const rawMileage = car?.mileage;
    let formattedMileage = '';
    if (rawMileage !== undefined && rawMileage !== null && String(rawMileage).trim() !== '') {
      const num = Number(rawMileage);
      if (!isNaN(num) && num > 0) {
        formattedMileage = `${Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`;
      }
    }

    const parts = [
      safeTitle,
      formattedEngine,
      safeYear ? `${safeYear} il` : '',
      formattedMileage
    ].filter(Boolean);

    return parts.join(', ');
  }, [safeTitle, safeEngine, safeYear, car?.mileage]);

  const carDirectLink = useMemo(() => {
    if (typeof window === 'undefined' || !car?.id) {
      return `https://kosalarauto.az/?car=${car?.id || ''}`;
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('car', car.id);
      return url.toString();
    } catch {
      return `${window.location.origin}/?car=${encodeURIComponent(car.id)}`;
    }
  }, [car?.id]);

  const whatsappMsg = useMemo(() => {
    const vehicleTitle = safeYear ? `${safeTitle}, ${safeYear} il` : safeTitle;
    return buildWhatsappInquiry(vehicleTitle, safePrice, carDirectLink);
  }, [safeTitle, safeYear, safePrice, carDirectLink]);

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`;

  const handleSelectSimilarCar = useCallback((simCar: TransitCar) => {
    setActiveImageIndex(0);
    setIsPhotoGridOpen(false);
    setIsLightboxOpen(false);
    setLightboxSource('detail');
    photoGridScrollPositionRef.current = 0;

    if (onSelectCar) {
      onSelectCar(simCar);
    }
  }, [onSelectCar]);

  return (
    <motion.div 
      ref={shellRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-transparent md:bg-black/85 md:backdrop-blur-xs overflow-hidden overscroll-contain touch-pan-y ${
        !isPresent && isMobile ? 'pointer-events-none' : ''
      }`}
      variants={isMobile ? undefined : desktopSlideVariants}
      initial={isMobile ? false : "initial"}
      animate={isMobile ? undefined : "animate"}
      exit={isMobile ? undefined : "exit"}
      style={isMobile ? { x: detailX } : undefined}
      onClick={isPhotoGridOpen || isLightboxOpen ? undefined : onClose}
    >
      {/* Modal Container: Fixed bounds for desktop & mobile, acts as relative anchor for absolute cards */}
      <div 
        className={`relative max-w-2xl md:max-w-5xl lg:max-w-6xl w-full h-[100dvh] md:h-[90vh] max-h-[100dvh] md:max-h-[90vh] bg-white rounded-none md:rounded-2xl shadow-2xl border-0 md:border border-slate-200 overflow-hidden my-0 md:my-auto ${
          isPhotoGridOpen || isLightboxOpen ? 'pointer-events-none select-none invisible md:visible' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence initial={false} custom={direction}>
          <TransitDetailCard
            key={car.id}
            car={car}
            isMobile={isMobile}
            onClose={onClose}
            onBack={onBack}
            direction={direction}
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
            allCars={allCars}
            onSelectSimilarCar={handleSelectSimilarCar}
            favorites={favorites}
            isPhotoGridOpen={isPhotoGridOpen}
            isLightboxOpen={isLightboxOpen}
            openPhotoGrid={openPhotoGrid}
            openLightbox={openLightbox}
            parentActiveImageIndex={activeImageIndex}
            onParentActiveImageChange={setActiveImageIndex}
          />
        </AnimatePresence>
      </div>

      {/* Mobile-only "Bütün şəkillər" Grid Gallery (Turbo.az Style) */}
      <DetailPhotoGrid
        isOpen={isPhotoGridOpen}
        onClose={closePhotoGrid}
        imagesList={imagesList}
        title={vehicleMainTitle || safeTitle}
        headerTitle={photoGridHeaderTitle}
        mileage={car?.mileage}
        isFavorite={isFavorite}
        onToggleFavorite={() => {
          if (car?.id && onToggleFavorite) {
            onToggleFavorite(car.id);
          }
        }}
        onSelectPhoto={handleSelectPhotoFromGrid}
        disabledEscape={isLightboxOpen}
        initialScrollTop={photoGridScrollPositionRef.current}
        onScrollPositionChange={(top) => {
          photoGridScrollPositionRef.current = top;
        }}
      />

      {/* Fullscreen Photo Lightbox (Turbo.az Style - Desktop & Mobile) */}
      <DetailLightbox
        isOpen={isLightboxOpen}
        onClose={closeLightbox}
        imagesList={imagesList}
        activeImageIndex={activeImageIndex}
        setActiveImageIndex={handleLightboxIndexChange}
        safeTitle={safeTitle}
        safePrice={safePrice}
        lightboxCarDetails={lightboxCarDetails}
        whatsappUrl={whatsappUrl}
        isFavorite={isFavorite}
        isFromGrid={lightboxSource === 'grid'}
        onToggleFavorite={() => {
          if (car?.id && onToggleFavorite) {
            onToggleFavorite(car.id);
          }
        }}
      />
    </motion.div>
  );
};

// EXPORTED COMPONENT WITH ERROR BOUNDARY WRAPPER & ANIMATE PRESENCE
export const TransitDetailModal: React.FC<TransitDetailModalProps> = ({
  car,
  onClose,
  onBack,
  direction = 'forward',
  isFavorite = false,
  onToggleFavorite,
  allCars = [],
  onSelectCar,
  favorites = [],
  detailX
}) => {
  return (
    <DetailModalErrorBoundary onClose={onClose} carTitle={car?.title}>
      <AnimatePresence>
        {car && (
          <TransitDetailModalContent 
            key="transit-detail-modal-root"
            car={car} 
            onClose={onClose} 
            onBack={onBack}
            direction={direction}
            isFavorite={isFavorite} 
            onToggleFavorite={onToggleFavorite}
            allCars={allCars}
            onSelectCar={onSelectCar}
            favorites={favorites}
            detailX={detailX}
          />
        )}
      </AnimatePresence>
    </DetailModalErrorBoundary>
  );
};

export default TransitDetailModal;
