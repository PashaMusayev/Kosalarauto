import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Heart, Phone, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PHONE_NUMBER } from '../../data/transits';
import { getValidImageUrl, getThumbnailUrl, handleThumbnailLoadError } from '../../utils/imageFallback';
import { TurboImageSlider } from '../TurboImageSlider';

interface DetailLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imagesList: string[];
  activeImageIndex: number;
  setActiveImageIndex: (index: number) => void;
  safeTitle: string;
  safePrice: string;
  lightboxCarDetails: string;
  whatsappUrl: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isFromGrid?: boolean;
}

export const DetailLightbox: React.FC<DetailLightboxProps> = ({
  isOpen,
  onClose,
  imagesList,
  activeImageIndex,
  setActiveImageIndex,
  safeTitle,
  safePrice,
  lightboxCarDetails,
  whatsappUrl,
  isFavorite = false,
  onToggleFavorite,
  isFromGrid = false,
}) => {
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);
  const prevIsOpen = useRef(false);
  const lastScrollTimeRef = useRef(0);

  // Desktop hover preview state (previews thumbnail on mouse hover without permanent change)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const suppressHoverRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Reset preview when lightbox closes
  useEffect(() => {
    if (!isOpen) {
      setPreviewIndex(null);
      suppressHoverRef.current = false;
    }
  }, [isOpen]);

  // Clear hover preview whenever active image index changes (e.g. from slider arrows or keyboard)
  useEffect(() => {
    setPreviewIndex(null);
  }, [activeImageIndex]);

  // Track mouse movement vs keyboard/arrow navigation to prevent stale hover preview
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
      const dy = Math.abs(e.clientY - lastMousePosRef.current.y);
      if (dx > 4 || dy > 4) {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        suppressHoverRef.current = false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        suppressHoverRef.current = true;
        setPreviewIndex(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen]);

  const displayedIndex = previewIndex !== null ? previewIndex : activeImageIndex;

  // Helper to scroll ONLY the thumbnail container horizontally without affecting the page or modal
  const scrollActiveThumbnailIntoView = useCallback((index: number, forceInstant: boolean = false) => {
    const container = thumbnailsContainerRef.current;
    const activeThumb = thumbnailRefs.current[index];
    if (!container || !activeThumb) return;

    const now = Date.now();
    const isRapid = now - lastScrollTimeRef.current < 250;
    lastScrollTimeRef.current = now;

    const containerRect = container.getBoundingClientRect();
    const thumbRect = activeThumb.getBoundingClientRect();

    const relativeThumbLeft = thumbRect.left - containerRect.left + container.scrollLeft;
    const targetScrollLeft = relativeThumbLeft - (container.clientWidth / 2) + (thumbRect.width / 2);
    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    if (maxScrollLeft > 0) {
      const clampedScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
      container.scrollTo({
        left: clampedScrollLeft,
        behavior: (forceInstant || isRapid) ? 'auto' : 'smooth',
      });
    } else {
      container.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, []);

  // When lightbox opens: bring active thumbnail into view instantly
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      scrollActiveThumbnailIntoView(activeImageIndex, true);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, activeImageIndex, scrollActiveThumbnailIntoView]);

  // Center active thumbnail horizontally when activeImageIndex changes
  useEffect(() => {
    if (!isOpen) return;
    scrollActiveThumbnailIntoView(activeImageIndex, false);
  }, [activeImageIndex, isOpen, scrollActiveThumbnailIntoView]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-[70] flex flex-col justify-between bg-black select-none overflow-hidden"
          onClick={onClose}
        >
          {/* 1A. Mobil Üst Naviqasiya (Yalnız Mobil: md:hidden) */}
          <div 
            className="flex md:hidden w-full bg-black px-4 pt-3.5 pb-3 items-center justify-between z-30 shrink-0 select-none border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sol yuxarı künc: Təmiz "✕" (bağla) və ya geri ox işarəsi */}
            <button
              type="button"
              id="btn-lightbox-back"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClose();
              }}
              className="w-10 h-10 flex items-center justify-center text-white hover:opacity-75 active:scale-95 transition-all cursor-pointer"
              title={isFromGrid ? "Geri" : "Bağla (Esc)"}
              aria-label={isFromGrid ? "Geri" : "Bağla"}
            >
              {isFromGrid ? (
                <ArrowLeft className="w-6 h-6 text-white stroke-[2.2]" />
              ) : (
                <X className="w-6 h-6 text-white stroke-[2.2]" />
              )}
            </button>

            {/* Üst mərkəz: Yığcam fraksiya (Məs: 15 / 16) */}
            <div className="text-white text-sm font-semibold tracking-wider select-none">
              <span>{activeImageIndex + 1}</span>
              <span className="text-white/60 mx-1.5 font-normal">/</span>
              <span>{imagesList.length || 1}</span>
            </div>

            {/* Sağ yuxarı künc: Ağ rəngdə "Sevimlilər" (ürək) işarəsi */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleFavorite) onToggleFavorite();
              }}
              className="w-10 h-10 flex items-center justify-center text-white hover:opacity-75 active:scale-95 transition-all cursor-pointer"
              title={isFavorite ? "Seçilmişlərdən çıxart" : "Seçilmişlərə əlavə et"}
              aria-label="Seçilmişlər"
            >
              <Heart 
                className={`w-6 h-6 transition-transform active:scale-125 ${
                  isFavorite ? 'fill-red-500 text-red-500 stroke-red-500' : 'text-white stroke-[2.2]'
                }`} 
              />
            </button>
          </div>

          {/* 1B. Desktop Üst Bar (Yalnız Desktop: hidden md:flex) */}
          <div 
            className="hidden md:flex w-full bg-black px-6 py-3.5 items-center justify-between z-30 shrink-0 select-none border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sol yuxarı künc: Elanın adı və qiyməti */}
            <div className="flex items-center gap-3 text-white min-w-0 pr-4">
              <span className="text-base lg:text-lg font-bold text-white tracking-tight truncate">
                {safeTitle}
              </span>
              <span className="text-white/40 font-light">|</span>
              <span className="text-base lg:text-lg font-black text-white shrink-0">
                {safePrice} AZN
              </span>
            </div>

            {/* Sağ yuxarı künc: Yaşıl WhatsApp düyməsi, "Seçilmişlərdə saxla" (ürək) və "✕" (bağla) */}
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer select-none"
                title="WhatsApp ilə yaz"
              >
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                  alt="WhatsApp"
                  className="w-4 h-4 object-contain brightness-0 invert"
                  referrerPolicy="no-referrer"
                />
                <span>WhatsApp ilə yaz</span>
              </a>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleFavorite) onToggleFavorite();
                }}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer"
                title={isFavorite ? "Seçilmişlərdən çıxart" : "Seçilmişlərdə saxla"}
                aria-label="Seçilmişlər"
              >
                <Heart 
                  className={`w-5 h-5 transition-transform active:scale-125 ${
                    isFavorite ? 'fill-rose-500 text-rose-500 stroke-rose-500' : 'text-white stroke-[2]'
                  }`} 
                />
              </button>

              {isFromGrid && (
                <button
                  type="button"
                  id="btn-lightbox-desktop-back"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold transition-all cursor-pointer select-none"
                  title="Qalereyaya qayıt"
                  aria-label="Qalereyaya qayıt"
                >
                  <ArrowLeft className="w-4 h-4 text-white" />
                  <span>Qalereya</span>
                </button>
              )}

              <button
                type="button"
                id="btn-lightbox-desktop-close"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClose();
                }}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all cursor-pointer"
                title={isFromGrid ? "Qalereyaya qayıt (Esc)" : "Bağla (Esc)"}
                aria-label={isFromGrid ? "Geri" : "Bağla"}
              >
                <X className="w-6 h-6 text-white stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* 2. Mərkəzi Şəkil (Tam təmiz qara arxafon, ətrafında azca marjin/boşluq) */}
          <div 
            className="relative w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-black p-1 sm:p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <TurboImageSlider
              images={imagesList}
              activeImageIndex={displayedIndex}
              onIndexChange={(newIdx) => {
                suppressHoverRef.current = true;
                setPreviewIndex(null);
                setActiveImageIndex(newIdx);
              }}
              safeTitle={safeTitle}
              isLightbox={true}
            />
          </div>

          {/* 3A. Mobil Aşağı Məlumat və Əlaqə Bloku (Yalnız Mobil: md:hidden) */}
          <div 
            className="flex md:hidden w-full bg-black border-t border-white/10 px-4 pt-3 pb-6 items-center justify-between gap-3 z-30 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sol aşağı hissə: Maşın elanı məlumatları ağ rəngdə */}
            <div className="flex-1 min-w-0 pr-1 space-y-0.5">
              {/* İlk sətir: Qiymət (Məs: 30 000 ₼) */}
              <div className="text-base font-bold text-white tracking-tight leading-tight">
                {safePrice} <span className="font-bold text-white">₼</span>
              </div>
              {/* İkinci sətir: Maşın adı və detalları */}
              <div className="text-xs font-normal text-white/90 truncate leading-snug">
                {lightboxCarDetails}
              </div>
            </div>

            {/* Sağ aşağı hissə: Yaşıl dairəvi "Zəng et" düyməsi */}
            <div className="flex items-center shrink-0">
              <a
                href={`tel:${PHONE_NUMBER.replace(/\s+/g, '')}`}
                className="w-12 h-12 rounded-full bg-[#22C55E] hover:bg-[#16A34A] active:scale-95 text-white flex items-center justify-center shadow-lg transition-all cursor-pointer"
                title="Zəng et"
                aria-label="Zəng et"
              >
                <Phone className="w-5 h-5 text-white stroke-[2.2]" />
              </a>
            </div>
          </div>

          {/* 3B. Desktop Aşağı Bar və Mini Şəkillər (Yalnız Desktop: hidden md:flex) */}
          <div 
            className="hidden md:flex w-full bg-black border-t border-white/10 px-6 pt-2.5 pb-4 flex-col items-center justify-center z-30 shrink-0 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tək Yığcam Sayğac (Şəklin tam altında, təkrarsız) */}
            <div className="text-xs text-white/80 font-semibold mb-2.5 tracking-wider select-none">
              <span>{displayedIndex + 1}</span>
              <span className="text-white/40 mx-1.5">/</span>
              <span>{imagesList.length || 1}</span>
            </div>

            {/* Mini Şəkillər (Thumbnails) Sırası */}
            {imagesList.length > 1 && (
              <div 
                ref={thumbnailsContainerRef}
                data-swipe-close-ignore
                onMouseLeave={() => setPreviewIndex(null)}
                className={`w-full max-w-5xl overflow-x-auto no-scrollbar py-1 flex items-center gap-2.5 px-4 ${
                  imagesList.length <= 7 ? 'justify-center' : 'justify-start'
                }`}
              >
                {imagesList.map((img, idx) => {
                  const isSelected = idx === activeImageIndex;
                  const isPreview = previewIndex !== null && idx === previewIndex;
                  const isHighlight = isPreview || (previewIndex === null && isSelected);
                  const fullUrl = getValidImageUrl(img);
                  const thumbUrl = getThumbnailUrl(fullUrl);

                  return (
                    <button
                      key={`thumb-desktop-${idx}`}
                      ref={(el) => { thumbnailRefs.current[idx] = el; }}
                      type="button"
                      onMouseEnter={() => {
                        if (!suppressHoverRef.current) {
                          setPreviewIndex(idx);
                        }
                      }}
                      onMouseLeave={() => setPreviewIndex(null)}
                      onClick={() => {
                        suppressHoverRef.current = false;
                        setPreviewIndex(null);
                        setActiveImageIndex(idx);
                      }}
                      className={`relative rounded-lg overflow-hidden shrink-0 transition-all cursor-pointer h-14 w-20 border-2 ${
                        isHighlight 
                          ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/60 scale-105 opacity-100 shadow-md z-10' 
                          : isSelected
                            ? 'border-white/50 opacity-75'
                            : 'border-white/15 opacity-50 hover:opacity-85 hover:scale-100'
                      }`}
                      title={`${idx + 1}-ci şəkil`}
                    >
                      <img
                        src={thumbUrl}
                        alt={`Önizləmə ${idx + 1}`}
                        className="w-full h-full object-cover pointer-events-none select-none"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => handleThumbnailLoadError(e.currentTarget, fullUrl)}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
