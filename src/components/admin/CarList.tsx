import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckSquare, 
  CheckCircle2, 
  RefreshCw, 
  Edit3, 
  Trash2,
  MoreVertical,
  AlertTriangle
} from 'lucide-react';
import { TransitCar } from '../../types';
import { DEFAULT_VEHICLE_PLACEHOLDER, getValidImageUrl, getThumbnailUrl, handleThumbnailLoadError } from '../../utils/imageFallback';
import { TransitCard } from '../TransitCard';
import { getListingQualityIssues } from '../../utils/listingQuality';

interface ActiveWarningPopover {
  carId: string | number;
  openedBy: 'click' | 'hover';
  top?: number;
  bottom?: number;
  left: number;
  issues: string[];
}

interface ListingQualityPillProps {
  car: TransitCar;
  isActive: boolean;
  onPillClick: (e: React.MouseEvent<HTMLButtonElement>, car: TransitCar, issues: string[]) => void;
  onPillMouseEnter: (e: React.MouseEvent<HTMLButtonElement>, car: TransitCar, issues: string[]) => void;
  onPillMouseLeave: (carId: string | number) => void;
}

const ListingQualityPill: React.FC<ListingQualityPillProps> = ({
  car,
  isActive,
  onPillClick,
  onPillMouseEnter,
  onPillMouseLeave
}) => {
  const issues = getListingQualityIssues(car);

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 w-fit select-none">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>Tam</span>
      </div>
    );
  }

  return (
    <div 
      className="relative inline-block select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        data-warning-pill="true"
        type="button"
        onClick={(e) => onPillClick(e, car, issues)}
        onMouseEnter={(e) => onPillMouseEnter(e, car, issues)}
        onMouseLeave={() => onPillMouseLeave(car.id)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all cursor-pointer active:scale-95 ${
          isActive
            ? 'bg-amber-500/30 text-amber-300 border-amber-500/60 shadow-sm'
            : 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
        }`}
        title="Tövsiyələri göstər"
      >
        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
        <span>⚠ {issues.length} tövsiyə</span>
      </button>
    </div>
  );
};

interface ActiveMenuPosition {
  carId: string | number;
  top?: number;
  bottom?: number;
  right: number;
}

interface CarListProps {
  carsList: TransitCar[];
  activeFilterTab: 'all' | 'active' | 'sold';
  adminSearchQuery: string;
  adminViewMode: 'table' | 'cards';
  updatingStatusCarId: string | null;
  deletingCarId: string | null;
  onToggleStatus: (car: TransitCar) => void;
  onEditCar: (car: TransitCar) => void;
  onDeleteCar: (carId: string | number, imageUrls?: string[]) => void;
}

export const CarList: React.FC<CarListProps> = ({
  carsList,
  activeFilterTab,
  adminSearchQuery,
  adminViewMode,
  updatingStatusCarId,
  deletingCarId,
  onToggleStatus,
  onEditCar,
  onDeleteCar
}) => {
  const [activeMenu, setActiveMenu] = useState<ActiveMenuPosition | null>(null);
  const [activeWarningPopover, setActiveWarningPopover] = useState<ActiveWarningPopover | null>(null);
  const hoverCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearHoverTimer = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearHoverTimer();
    };
  }, []);

  // Close warning popover on Escape, window resize, scroll, or outside click
  useEffect(() => {
    if (!activeWarningPopover) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearHoverTimer();
        setActiveWarningPopover(null);
      }
    };

    const handleScrollOrResize = () => {
      clearHoverTimer();
      setActiveWarningPopover(null);
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-warning-popover]') || target.closest('[data-warning-pill]')) {
        return;
      }
      clearHoverTimer();
      setActiveWarningPopover(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [activeWarningPopover]);

  const handlePillClick = (e: React.MouseEvent<HTMLButtonElement>, car: TransitCar, issues: string[]) => {
    e.stopPropagation();
    clearHoverTimer();
    if (activeWarningPopover?.carId === car.id) {
      setActiveWarningPopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 256;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openBelow = spaceAbove < 160 && spaceBelow > spaceAbove;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));

    setActiveWarningPopover({
      carId: car.id,
      openedBy: 'click',
      top: openBelow ? rect.bottom + 6 : undefined,
      bottom: openBelow ? undefined : window.innerHeight - rect.top + 6,
      left,
      issues
    });
  };

  const handlePillMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, car: TransitCar, issues: string[]) => {
    clearHoverTimer();
    if (activeWarningPopover?.carId === car.id && activeWarningPopover.openedBy === 'click') {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 256;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openBelow = spaceAbove < 160 && spaceBelow > spaceAbove;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));

    setActiveWarningPopover({
      carId: car.id,
      openedBy: 'hover',
      top: openBelow ? rect.bottom + 6 : undefined,
      bottom: openBelow ? undefined : window.innerHeight - rect.top + 6,
      left,
      issues
    });
  };

  const handlePillMouseLeave = (carId: string | number) => {
    if (activeWarningPopover?.carId === carId && activeWarningPopover.openedBy === 'hover') {
      clearHoverTimer();
      hoverCloseTimerRef.current = setTimeout(() => {
        setActiveWarningPopover(prev => (prev?.carId === carId && prev.openedBy === 'hover' ? null : prev));
      }, 150);
    }
  };

  const handlePopoverMouseEnter = () => {
    clearHoverTimer();
  };

  const handlePopoverMouseLeave = () => {
    if (activeWarningPopover?.openedBy === 'hover') {
      clearHoverTimer();
      hoverCloseTimerRef.current = setTimeout(() => {
        setActiveWarningPopover(prev => (prev?.openedBy === 'hover' ? null : prev));
      }, 150);
    }
  };

  // Close dropdown on Escape, window resize, or scroll
  useEffect(() => {
    if (!activeMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenu(null);
      }
    };

    const handleScrollOrResize = () => {
      setActiveMenu(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [activeMenu]);

  const handleKebabClick = (e: React.MouseEvent<HTMLButtonElement>, carId: string | number) => {
    e.stopPropagation();
    if (activeMenu?.carId === carId) {
      setActiveMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Dropdown menu is ~80px. If space below is less than 120px and above has more room, open upward
    const openUpward = spaceBelow < 120 && spaceAbove > spaceBelow;

    // Align right edge of menu to right edge of kebab button, clamped within viewport bounds
    const right = Math.max(8, Math.min(window.innerWidth - rect.right, window.innerWidth - 184));

    setActiveMenu({
      carId,
      top: openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
      right,
    });
  };

  const filteredCars = (carsList || []).filter(car => {
    if (!car) return false;
    if (activeFilterTab === 'active' && car.status === 'sold') return false;
    if (activeFilterTab === 'sold' && car.status !== 'sold') return false;
    if (adminSearchQuery.trim()) {
      const q = adminSearchQuery.toLowerCase();
      const matchTitle = (car.title || '').toLowerCase().includes(q);
      const matchEngine = (car.engine || '').toLowerCase().includes(q);
      const matchYear = (car.year || '').toString().includes(q);
      if (!matchTitle && !matchEngine && !matchYear) return false;
    }
    return true;
  });

  return (
    <>
      {/* Cars List: PUBLIC-STYLE RESPONSIVE CARD GRID (2 cols on mobile, 3 on md, 4 on lg) */}
      {adminViewMode === 'cards' && (
        <>
          {filteredCars.length === 0 ? (
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-8 text-center text-slate-400 text-xs">
              Axtarışa uyğun avtomobil tapılmadı.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5 lg:gap-4">
              {filteredCars.map(car => (
                <TransitCard
                  key={`admin-car-${car.id}`}
                  car={car}
                  variant="admin"
                  onCardClick={() => onEditCar(car)}
                  hideFavorite={true}
                  adminOverlay={
                    <button
                      type="button"
                      onClick={(e) => handleKebabClick(e, car.id)}
                      className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                        activeMenu?.carId === car.id
                          ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                          : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700/80 shadow-md active:scale-95'
                      }`}
                      title="Əməliyyatlar (Status, Sil)"
                      aria-label="Əməliyyatlar"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  }
                >
                  <ListingQualityPill 
                    car={car} 
                    isActive={activeWarningPopover?.carId === car.id}
                    onPillClick={handlePillClick}
                    onPillMouseEnter={handlePillMouseEnter}
                    onPillMouseLeave={handlePillMouseLeave}
                  />
                </TransitCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* Cars Table: RESPONSIVE TABLE VIEW WITH HORIZONTAL SCROLL (Default on mobile & desktop) */}
      {adminViewMode === 'table' && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          {/* Mobile Horizontal Scroll Helper Banner */}
          <div className="md:hidden px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <span>👉</span>
              <span>Cədvəli tam görmək üçün sağa sürüşdürün</span>
            </span>
            <span className="text-[10px] bg-blue-500/15 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
              Üfüqi skroll
            </span>
          </div>

          <div className="overflow-x-auto w-full scrollbar-thin scrollbar-thumb-slate-700">
            <table className="w-full text-left text-xs text-slate-300 min-w-[680px]">
              <thead className="bg-slate-900/90 text-[11px] font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Şəkil</th>
                  <th className="py-3 px-4 whitespace-nowrap">Model və il</th>
                  <th className="py-3 px-4 whitespace-nowrap">Baza / dam</th>
                  <th className="py-3 px-4 whitespace-nowrap">Yürüş</th>
                  <th className="py-3 px-4 whitespace-nowrap">Təchizat</th>
                  <th className="py-3 px-4 whitespace-nowrap">Qiymət</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredCars.map(car => {
                  const feats = Array.isArray(car.features) ? car.features : [];
                  const isSold = car.status === 'sold';
                  const isMenuOpen = activeMenu?.carId === car.id;

                  return (
                    <tr key={car.id} className={`hover:bg-slate-900/50 transition-colors ${isSold ? 'opacity-75 bg-slate-950/60' : ''}`}>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0 relative">
                          <img 
                            src={getThumbnailUrl(getValidImageUrl(car.primaryImage))} 
                            alt={car.title} 
                            className="w-full h-full object-cover" 
                            onError={(e) => { 
                              handleThumbnailLoadError(e.currentTarget, getValidImageUrl(car.primaryImage), DEFAULT_VEHICLE_PLACEHOLDER);
                            }}
                          />
                          {isSold && (
                            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
                              <span className="text-[9px] font-black text-amber-400 tracking-tighter">Satıldı</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                          <span>{car.title}</span>
                          {car.isFeatured && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">Vitrin</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{car.year} il • {car.engine}</div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                          {car.baseLength} • {car.roofHeight}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-200 whitespace-nowrap">
                        {Number(car.mileage).toLocaleString()} km
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <button 
                          onClick={() => onEditCar(car)}
                          className="text-left group flex flex-col gap-0.5 p-1 rounded-lg hover:bg-slate-800 transition-all"
                          title="Təchizatı dəyişmək üçün klikləyin"
                        >
                          <div className="flex items-center gap-1 text-xs font-bold text-blue-400 group-hover:text-blue-300">
                            <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                            <span>{feats.length} aktiv təchizat</span>
                          </div>
                          <span className="text-[10px] text-slate-400 line-clamp-1 max-w-[170px]">
                            {feats.slice(0, 3).join(', ')}{feats.length > 3 ? ` (+${feats.length - 3})` : ''}
                          </span>
                        </button>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-emerald-400 whitespace-nowrap">
                        {Number(car.price).toLocaleString()} AZN
                      </td>
                      
                      {/* Status Sütunu (Sadə Badge) */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isSold ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            <span>Satıldı</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Satışda</span>
                          </span>
                        )}
                      </td>

                      {/* Əməliyyatlar Sütunu (Redaktə + Kebab Menyu Trigger) */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Redaktə Düyməsi (Primary always-visible) */}
                          <button 
                            type="button"
                            onClick={() => onEditCar(car)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-bold inline-flex items-center gap-1.5 transition-all active:scale-95"
                            title="Avtomobili redaktə et"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Redaktə</span>
                          </button>

                          {/* Kebab Dropdown Menyu Trigger Düyməsi */}
                          <button
                            type="button"
                            onClick={(e) => handleKebabClick(e, car.id)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isMenuOpen
                                ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700 active:scale-95'
                            }`}
                            title="Digər əməliyyatlar (Status, Sil)"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portal-rendered Kebab Dropdown Menu (Mounted to document.body to avoid table overflow-x/y clipping) */}
      {activeMenu && typeof document !== 'undefined' && (() => {
        const activeCar = carsList.find(c => c.id === activeMenu.carId);
        if (!activeCar) return null;

        const isSold = activeCar.status === 'sold';
        const isUpdating = updatingStatusCarId === activeCar.id;
        const isDeleting = deletingCarId === String(activeCar.id);

        return createPortal(
          <>
            {/* Click-outside backdrop */}
            <div 
              className="fixed inset-0 z-[9998]" 
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenu(null);
              }} 
              onContextMenu={(e) => {
                e.preventDefault();
                setActiveMenu(null);
              }}
            />
            {/* Portal Dropdown Panel */}
            <div 
              style={{
                position: 'fixed',
                right: `${activeMenu.right}px`,
                ...(activeMenu.top !== undefined ? { top: `${activeMenu.top}px` } : {}),
                ...(activeMenu.bottom !== undefined ? { bottom: `${activeMenu.bottom}px` } : {}),
              }}
              className="z-[9999] w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 text-xs divide-y divide-slate-800 animate-in fade-in zoom-in-95 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Satıldı et / Satışa çıxar */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(null);
                  onToggleStatus(activeCar);
                }}
                disabled={isUpdating}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left font-medium transition-colors ${
                  isSold 
                    ? 'text-emerald-300 hover:bg-emerald-950/40 hover:text-white' 
                    : 'text-amber-300 hover:bg-amber-950/40 hover:text-white'
                }`}
              >
                {isUpdating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : isSold ? (
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{isSold ? 'Satışa çıxar' : 'Satıldı et'}</span>
              </button>

              {/* Sil */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(null);
                  onDeleteCar(activeCar.id, activeCar.images);
                }}
                disabled={isDeleting}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 font-medium transition-colors"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-rose-300" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>Sil</span>
              </button>
            </div>
          </>,
          document.body
        );
      })()}

      {/* WARNING POPOVER PORTAL (PART 2) */}
      {activeWarningPopover && createPortal(
        <div
          data-warning-popover="true"
          className="fixed z-[9999] p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-left animate-in fade-in zoom-in-95 duration-150 select-none"
          style={{
            top: activeWarningPopover.top !== undefined ? `${activeWarningPopover.top}px` : undefined,
            bottom: activeWarningPopover.bottom !== undefined ? `${activeWarningPopover.bottom}px` : undefined,
            left: `${activeWarningPopover.left}px`,
            width: '256px',
            maxWidth: 'calc(100vw - 16px)'
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        >
          <div className="font-extrabold text-[11px] text-amber-400 mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Tövsiyələr ({activeWarningPopover.issues.length}):</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {activeWarningPopover.openedBy === 'click' ? 'Bərkidilib' : 'Baxış'}
            </span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-200">
            {activeWarningPopover.issues.map((issue, idx) => (
              <li key={idx} className="flex items-start gap-1.5 leading-snug">
                <span className="text-amber-400 font-bold shrink-0">•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </>
  );
};
