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

  const isAdmin = variant === 'admin';
  const isSold = car?.status === 'sold';

  return (
    <div 
      className={`rounded-lg sm:rounded-xl border transition-[transform,box-shadow,border-color] duration-200 [@media(hover:hover)]:hover:shadow-md [@media(hover:hover)]:hover:-translate-y-0.5 flex flex-col overflow-hidden group cursor-pointer ${
        isAdmin 
          ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md text-slate-100' 
          : 'bg-white border-slate-200/50 shadow-sm'
      }`}
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
      <div className={`relative aspect-[4/3] overflow-hidden flex items-center justify-center select-none ${
        isAdmin ? 'bg-slate-950' : 'bg-slate-100'
      }`}>
        {/* Shimmer loading state if image not loaded yet */}
        {!imageLoaded && (
          <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 ${
            isAdmin ? 'bg-slate-950' : 'bg-slate-100'
          }`}>
            <div className={`absolute inset-0 animate-shimmer ${
              isAdmin 
                ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950' 
                : 'bg-gradient-to-r from-slate-100 via-slate-200/80 to-slate-100'
            }`} />
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
          } ${
            isAdmin && isSold ? 'filter saturate-[0.45] brightness-[0.8] opacity-85' : ''
          }`}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />

        {/* Admin Sold Yellow Corner Ribbon (PART 4) */}
        {isAdmin && isSold && (
          <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none z-20">
            <div className="absolute top-[18px] -left-[28px] -rotate-45 w-[112px] bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider py-0.5 text-center shadow-md border-y border-amber-300 uppercase select-none">
              SATILDI
            </div>
          </div>
        )}

        {/* Favorite Button (Heart) - only when not in admin and not hidden */}
        {!isAdmin && !hideFavorite && (
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
          {/* Price - Bold & Clear */}
          <div className="flex items-baseline justify-between">
            <span className={`tracking-tight ${
              isAdmin 
                ? 'text-[15px] sm:text-base font-extrabold text-emerald-400' 
                : 'text-[15px] sm:text-base font-bold text-slate-900'
            }`}>
              {safePrice.toLocaleString()} <span className={`font-bold ${
                isAdmin 
                  ? 'text-xs sm:text-[13px] text-emerald-300' 
                  : 'text-xs sm:text-[13px] text-slate-800'
              }`}>AZN</span>
            </span>
          </div>

          {/* Car Title / Model */}
          <h3 
            className={`truncate leading-tight transition-colors ${
              isAdmin 
                ? 'font-bold text-xs sm:text-[13px] text-slate-100 group-hover:text-blue-400' 
                : 'font-normal text-xs sm:text-[13px] text-slate-800 group-hover:text-blue-600'
            }`}
            title={safeTitle}
          >
            {safeTitle}
          </h3>

          {/* Specifications Row (Year, Engine, Mileage) */}
          <p className={`truncate leading-tight font-normal text-[11px] sm:text-xs ${
            isAdmin ? 'text-slate-400' : 'text-black'
          }`}>
            {safeYear ? `${safeYear}, ` : ''}{safeEngine ? `${safeEngine} L, ` : ''}{safeMileage.toLocaleString()} km
          </p>
        </div>

        {/* Bottom City / Date */}
        <div className={`pt-1 flex items-center justify-between text-[10px] sm:text-[11px] ${
          isAdmin ? 'text-slate-500 font-medium' : 'text-slate-400 font-normal'
        }`}>
          <span className="truncate">
            {safeLocation}
          </span>
        </div>

        {/* Optional children slot (e.g. Admin listing quality warnings pill) */}
        {children && (
          <div className={`pt-1.5 mt-1 border-t ${
            isAdmin ? 'border-slate-800/80' : 'border-slate-100/90'
          }`} onClick={(e) => e.stopPropagation()}>
            {children}
          </div>
        )}

      </div>
    </div>
  );
});
