import React, { useState, useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { TransitCar } from '../types';
import { prefetchImages } from '../utils/imagePreloader';
import { getValidImageUrl, getThumbnailUrl, handleThumbnailLoadError } from '../utils/imageFallback';
import { prefetchDetailModal } from '../utils/detailModalPreloader';

interface TransitCardProps {
  car: TransitCar;
  onViewDetails?: (car: TransitCar) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (carId: string) => void;
  priority?: boolean;
  // Optional admin-only extensions
  variant?: 'public' | 'admin';
  onCardClick?: (car: TransitCar) => void;
  hideFavorite?: boolean;
  adminOverlay?: React.ReactNode;
  children?: React.ReactNode;
}

export const TransitCard = React.memo<TransitCardProps>(function TransitCard({
  car,
  onViewDetails,
  isFavorite = false,
  onToggleFavorite,
  priority = false,
  variant = 'public',
  onCardClick,
  hideFavorite = false,
  adminOverlay,
  children
}) {
  // Safe property extraction
  const safeTitle = car?.title || `${car?.brand || 'Ford'} ${car?.model || 'Transit'}`;
  const safeYear = car?.year || '';
  const safePrice = car?.price || 0;
  const safeMileage = car?.mileage || 0;
  const safeEngine = (car?.engine || '2.2').split(' ')[0];
  const safeLocation = car?.city || car?.location || 'Bakı';
  const safeBaseLength = car?.baseLength || '';

  const fullPrimaryUrl = getValidImageUrl(car?.primaryImage || (car?.images && car.images[0]));
  const thumbImageUrl = getThumbnailUrl(fullPrimaryUrl);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, [thumbImageUrl]);

  // Arxa fonda elanın digər şəkillərini qabaqcadan kesə yüklə (hover / touch anında)
  const handlePrefetch = () => {
    prefetchDetailModal();
    if (car) {
      const candidates = [car.primaryImage, ...(car.images || [])].filter(Boolean);
      if (candidates.length > 0) {
        prefetchImages(candidates.slice(0, 4));
      }
    }
  };

  return (
    <div 
      className="bg-white rounded-lg sm:rounded-xl border border-slate-200/50 shadow-sm transition-[transform,box-shadow] duration-200 [@media(hover:hover)]:hover:shadow-md [@media(hover:hover)]:hover:-translate-y-0.5 flex flex-col overflow-hidden group cursor-pointer"
      onClick={() => {
        if (onCardClick) {
          onCardClick(car);
        } else if (onViewDetails) {
          onViewDetails(car);
        }
      }}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      {/* Top Image Section (Turbo.az Style 4:3 Aspect, Static Primary Image) */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden flex items-center justify-center select-none">
        {/* Shimmer loading state if image not loaded yet */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-100 overflow-hidden pointer-events-none z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-slate-200/80 to-slate-100 animate-shimmer" />
          </div>
        )}

        <img
          ref={imgRef}
          src={thumbImageUrl}
          alt={safeTitle}
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            handleThumbnailLoadError(e.currentTarget, fullPrimaryUrl);
            setImageLoaded(true);
          }}
          className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300 relative z-[1] select-none ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />

        {/* Admin Sold Overlay (PART 2) */}
        {variant === 'admin' && car?.status === 'sold' && (
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px] flex items-center justify-center z-15 pointer-events-none">
            <div className="bg-red-600/95 text-white font-black text-xs sm:text-sm tracking-widest px-3.5 py-1 rounded-md shadow-xl border border-red-400/80 uppercase rotate-[-6deg] select-none">
              SATILDI
            </div>
          </div>
        )}

        {/* Favorite Button (Heart) - only when not in admin and not hidden */}
        {variant !== 'admin' && !hideFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (car?.id && onToggleFavorite) onToggleFavorite(car.id);
            }}
            className={`absolute top-1.5 right-1.5 p-1.5 rounded-full transition-transform hover:scale-110 active:scale-95 z-20 cursor-pointer ${
              isFavorite 
                ? 'bg-red-600 text-white shadow-sm' 
                : 'bg-black/35 text-white hover:text-red-400 hover:bg-black/60'
            }`}
            title={isFavorite ? 'Seçilmişlərdən çıxar' : 'Seçilmişlərə əlavə et'}
            aria-label="Seçilmişlərə əlavə et"
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Admin Overlay slot (e.g. Kebab Menu Trigger) */}
        {adminOverlay && (
          <div className="absolute top-1.5 right-1.5 z-25" onClick={(e) => e.stopPropagation()}>
            {adminOverlay}
          </div>
        )}

        {/* Compact Base Length Pill */}
        {safeBaseLength && safeBaseLength !== 'Hamısı' && (
          <div className="absolute bottom-1.5 left-1.5 bg-slate-900/85 text-slate-100 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700/60 pointer-events-none z-20">
            {safeBaseLength}
          </div>
        )}
      </div>

      {/* Turbo.az Style Compact Card Body */}
      <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between space-y-1">
        
        <div className="space-y-0.5 min-w-0">
          {/* Price - Bold & Clear (Turbo.az style: e.g. 25 500 AZN) */}
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] sm:text-base font-bold text-slate-900 tracking-tight">
              {safePrice.toLocaleString()} <span className="text-xs sm:text-[13px] font-bold text-slate-800">AZN</span>
            </span>
          </div>

          {/* Car Title / Model - Turbo.az style */}
          <h3 
            className="font-normal text-xs sm:text-[13px] text-slate-800 group-hover:text-blue-600 transition-colors truncate leading-tight"
            title={safeTitle}
          >
            {safeTitle}
          </h3>

          {/* Specifications Row (Year, Engine, Mileage) - Pure black color */}
          <p className="text-[11px] sm:text-xs text-black font-normal truncate leading-tight">
            {safeYear ? `${safeYear}, ` : ''}{safeEngine ? `${safeEngine} L, ` : ''}{safeMileage.toLocaleString()} km
          </p>
        </div>

        {/* Bottom City / Date */}
        <div className="pt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
          <span className="truncate text-slate-400 font-normal">
            {safeLocation}
          </span>
        </div>

        {/* Optional children slot (e.g. Admin listing quality warnings pill) */}
        {children && (
          <div className="pt-1.5 border-t border-slate-100/90 mt-1" onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
        )}

      </div>
    </div>
  );
});
