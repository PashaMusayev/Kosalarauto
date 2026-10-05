import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { TransitCar } from '../../types';
import { DEFAULT_VEHICLE_PLACEHOLDER, getValidImageUrl, getThumbnailUrl, handleThumbnailLoadError } from '../../utils/imageFallback';

interface DetailSimilarCarsProps {
  similarCars: TransitCar[];
  favorites?: string[];
  onToggleFavorite?: (carId: string) => void;
  onSelectSimilarCar: (car: TransitCar) => void;
  currentCarId?: string;
}

export const DetailSimilarCars: React.FC<DetailSimilarCarsProps> = ({
  similarCars,
  favorites = [],
  onToggleFavorite,
  onSelectSimilarCar,
  currentCarId,
}) => {
  const [visibleCount, setVisibleCount] = useState(12);

  // Reset back to 12 whenever the viewed car changes
  useEffect(() => {
    setVisibleCount(12);
  }, [currentCarId, similarCars]);

  if (!similarCars || similarCars.length === 0) return null;

  const visibleCars = similarCars.slice(0, visibleCount);
  const remainingCount = similarCars.length - visibleCount;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-black tracking-tight">
            Bənzər elanlar
          </h3>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300/60">
            {similarCars.length}
          </span>
        </div>
      </div>

      {/* Responsive Grid: 2 columns on mobile, 3 columns on sm/md */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {visibleCars.map((simCar) => {
          const simTitle = simCar.title || `${simCar.brand || 'Ford'} ${simCar.model || 'Transit'}`;
          const simPrice = (simCar.price || 0).toLocaleString();
          const simYear = simCar.year ? `${simCar.year} il` : '';
          const simEngine = simCar.engine ? (simCar.engine.includes('L') ? simCar.engine : `${simCar.engine.split(' ')[0]} L`) : '';
          const simMileage = simCar.mileage ? `${(simCar.mileage).toLocaleString()} km` : '';
          const simSpecs = [simYear, simEngine, simMileage].filter(Boolean).join(', ');
          const simLocation = simCar.location || simCar.city || 'Bakı';
          const simIsFav = favorites ? favorites.includes(simCar.id) : false;

          const rawImg = simCar.primaryImage || (simCar.images && simCar.images[0]);
          const fullImgUrl = getValidImageUrl(rawImg);
          const thumbImgUrl = getThumbnailUrl(fullImgUrl);

          return (
            <div
              key={simCar.id}
              onClick={() => onSelectSimilarCar(simCar)}
              className="bg-white rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer group select-none"
              title={`${simTitle} - Baxmaq üçün klikləyin`}
            >
              {/* Image box (Turbo.az 4:3 aspect, bg-slate-100, object-cover) */}
              <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden flex items-center justify-center">
                <img
                  src={thumbImgUrl}
                  alt={simTitle}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    handleThumbnailLoadError(e.currentTarget, fullImgUrl, DEFAULT_VEHICLE_PLACEHOLDER);
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Heart Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleFavorite) onToggleFavorite(simCar.id);
                  }}
                  className={`absolute top-2 right-2 p-1.5 rounded-lg transition-transform hover:scale-110 z-10 ${
                    simIsFav 
                      ? 'bg-red-600 text-white shadow-xs' 
                      : 'bg-slate-900/70 text-white hover:text-red-400 hover:bg-slate-900/90'
                  }`}
                  title={simIsFav ? 'Seçilmişlərdən çıxar' : 'Seçilmişlərə əlavə et'}
                  aria-label="Seçilmişlərə əlavə et"
                >
                  <Heart className={`w-3.5 h-3.5 ${simIsFav ? 'fill-current' : ''}`} />
                </button>

                {/* Base length badge */}
                {simCar.baseLength && (
                  <div className="absolute bottom-2 right-2 bg-slate-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-700">
                    {simCar.baseLength}
                  </div>
                )}
              </div>

              {/* Card Content */}
              <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between space-y-1.5">
                <div>
                  {/* Price */}
                  <div className="text-sm sm:text-base font-black text-black leading-tight">
                    {simPrice} <span className="font-black text-black">₼</span>
                  </div>

                  {/* Title */}
                  <div className="font-bold text-xs sm:text-sm text-black group-hover:text-blue-600 transition-colors line-clamp-1 mt-0.5">
                    {simTitle}
                  </div>

                  {/* Specs: Year, Engine, Mileage */}
                  {simSpecs && (
                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {simSpecs}
                    </div>
                  )}
                </div>

                {/* Location & View CTA */}
                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate max-w-[90px] sm:max-w-[110px]">{simLocation}</span>
                  <span className="text-blue-600 font-bold group-hover:underline">Bax &rarr;</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* "Daha çox göstər (N)" Düyməsi (12-dən çox elan olduqda) */}
      {remainingCount > 0 && (
        <div className="mt-5 sm:mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 12)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 active:scale-98 text-slate-800 font-bold text-sm border border-slate-200/80 shadow-xs hover:shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Daha çox göstər ({remainingCount})</span>
          </button>
        </div>
      )}
    </div>
  );
};
