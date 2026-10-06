import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Star, AlertTriangle, AlertCircle } from 'lucide-react';
import { FormImageItem } from './adminTypes';
import { DEFAULT_VEHICLE_PLACEHOLDER } from '../../utils/imageFallback';
import { formatFileSize } from '../../utils/imageCompressor';

interface ImagePreviewModalProps {
  images: FormImageItem[];
  currentIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  images,
  currentIndex,
  onClose,
  onNavigate
}) => {
  const isOpen = currentIndex !== null && currentIndex >= 0 && currentIndex < images.length;
  const currentItem = isOpen && currentIndex !== null ? images[currentIndex] : null;

  const handlePrev = useCallback(() => {
    if (currentIndex === null || images.length === 0) return;
    const prev = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    onNavigate(prev);
  }, [currentIndex, images.length, onNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex === null || images.length === 0) return;
    const next = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    onNavigate(next);
  }, [currentIndex, images.length, onNavigate]);

  // Keyboard navigation: Escape closes preview only (stops propagation so parent AdminModal doesn't close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation();
        e.preventDefault();
        handleNext();
      }
    };

    // Use capture phase so Escape stops propagation before reaching any outer modal listeners
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!isOpen || !currentItem || typeof document === 'undefined') {
    return null;
  }

  const isCover = currentIndex === 0;
  const hasError = Boolean(currentItem.error);
  const hasImageUrl = Boolean(currentItem.url && currentItem.url.trim().length > 0);

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] bg-black/92 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Şəkil önizləməsi"
    >
      {/* Top Header Bar */}
      <div 
        className="w-full px-4 sm:px-6 py-3.5 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          {/* Counter Badge ("5 / 22") */}
          <span className="bg-slate-800/90 text-white font-extrabold text-xs sm:text-sm px-3 py-1 rounded-full border border-slate-700/80 shadow-md">
            {(currentIndex ?? 0) + 1} / {images.length}
          </span>

          {/* Cover Badge */}
          {isCover && (
            <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Əsas Kover (#1)</span>
            </span>
          )}

          {/* File details if available */}
          {currentItem.fileName && (
            <span className="hidden md:inline text-xs text-slate-300 font-medium truncate max-w-xs">
              {currentItem.fileName}
            </span>
          )}

          {currentItem.compressedSize ? (
            <span className="hidden sm:inline text-[11px] text-slate-400 font-semibold bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
              {formatFileSize(currentItem.compressedSize)}
            </span>
          ) : null}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 sm:p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60 shadow-lg active:scale-95"
          title="Bağla (Esc)"
          aria-label="Önizləməni bağla"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Main Image Area with Previous / Next Arrows */}
      <div className="relative flex-1 flex items-center justify-center p-3 sm:p-8 min-h-0 overflow-hidden">
        {/* Previous Arrow Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-2 sm:left-6 z-20 p-2.5 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white/90 hover:text-white transition-all cursor-pointer border border-slate-700/70 shadow-xl active:scale-95 hover:scale-105"
            title="Əvvəlki şəkil (←)"
            aria-label="Əvvəlki şəkil"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {/* Center Content: Image or Error placeholder */}
        <div 
          className="max-w-[92vw] max-h-[82vh] flex items-center justify-center relative"
          onClick={(e) => e.stopPropagation()}
        >
          {hasImageUrl ? (
            <img
              src={currentItem.url}
              alt={currentItem.fileName || `Şəkil #${(currentIndex ?? 0) + 1}`}
              className="max-h-[80vh] max-w-[88vw] object-contain rounded-xl shadow-2xl transition-transform"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.onerror = null;
                img.src = DEFAULT_VEHICLE_PLACEHOLDER;
              }}
            />
          ) : (
            <div className="bg-rose-950/80 border border-rose-800 p-8 rounded-2xl max-w-md text-center flex flex-col items-center justify-center shadow-2xl">
              <AlertTriangle className="w-12 h-12 text-rose-400 mb-3 animate-pulse" />
              <h4 className="text-white font-bold text-sm sm:text-base">
                {currentItem.fileName || `Şəkil #${(currentIndex ?? 0) + 1}`}
              </h4>
              <p className="text-xs text-rose-300 mt-2 leading-relaxed">
                {currentItem.error || "Bu şəkil faylı oxuna bilmədi və ya format dəstəklənmir."}
              </p>
              {currentItem.errorDetail && (
                <span className="text-[11px] font-mono text-rose-400 mt-2 bg-rose-950/90 px-2 py-1 rounded border border-rose-900/60">
                  {currentItem.errorDetail}
                </span>
              )}
            </div>
          )}

          {/* Floating Error Badge if error exists but image has preview */}
          {hasError && hasImageUrl && (
            <div className="absolute top-3 right-3 bg-rose-600/95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 border border-rose-400">
              <AlertCircle className="w-4 h-4" />
              <span>{currentItem.error || 'Xəta'}</span>
            </div>
          )}
        </div>

        {/* Next Arrow Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-2 sm:right-6 z-20 p-2.5 sm:p-3.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white/90 hover:text-white transition-all cursor-pointer border border-slate-700/70 shadow-xl active:scale-95 hover:scale-105"
            title="Növbəti şəkil (→)"
            aria-label="Növbəti şəkil"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}
      </div>

      {/* Bottom Hint Bar */}
      <div 
        className="w-full px-4 py-3 flex items-center justify-center gap-4 text-[11px] text-slate-400 bg-gradient-to-t from-black/80 to-transparent z-10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="hidden sm:inline">Naviqasiya: ← və ya → oxları</span>
        <span>Bağlamaq: Esc və ya kənara klikləyin</span>
      </div>
    </div>,
    document.body
  );
};
