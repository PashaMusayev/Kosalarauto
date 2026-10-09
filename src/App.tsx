import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { FilterBar } from './components/FilterBar';
import { TransitCard } from './components/TransitCard';
import { TransitCardSkeleton } from './components/TransitCardSkeleton';
import { Pagination } from './components/Pagination';
import { AboutUs } from './components/AboutUs';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { ContactFooter } from './components/ContactFooter';
import { Footer } from './components/Footer';
import { AdminErrorBoundary } from './components/AdminErrorBoundary';
import { NotFound } from './components/NotFound';
import { INITIAL_TRANSITS, WHATSAPP_NUMBER, WHATSAPP_DIRECT_LINK } from './data/transits';
import { TransitCar, FilterState } from './types';
import { MessageCircle, Truck, Sparkles, FilterX } from 'lucide-react';
import whatsappLogo from './pics/whatsapp logo.png';
import salonFoto from './assets/images/Salonfoto.jpg';
import { fetchAllCarsFromApi } from './services/carService';
import { trackWhatsAppClick } from './services/analyticsService';
import { filterAndSortTransits, parseMultiFilter } from './utils/filterUtils';
import { prefetchDetailModal } from './utils/detailModalPreloader';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useIsMobile } from './hooks/useIsMobile';
import { 
  DETAIL_OPEN_TRANSITION, 
  DETAIL_CLOSE_TRANSITION 
} from './utils/detailTransition';

const AdminModal = React.lazy(() => import('./components/AdminModal'));

const DetailModalFallback = () => (
  <div 
    className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-0 md:p-6 bg-transparent md:bg-black/85 md:backdrop-blur-xs overflow-hidden"
    aria-busy="true"
    aria-label="Avtomobil məlumatları yüklənir"
  >
    <div className="relative max-w-2xl md:max-w-5xl lg:max-w-6xl w-full h-[100dvh] md:h-[90vh] bg-white rounded-none md:rounded-2xl shadow-2xl border-0 md:border border-slate-200 overflow-hidden flex flex-col animate-pulse">
      <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-slate-50/80">
        <div className="h-4 w-32 bg-slate-200 rounded" />
        <div className="h-8 w-8 bg-slate-200 rounded-full" />
      </div>
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-3/5 bg-slate-100 aspect-[4/3] md:aspect-auto flex items-center justify-center">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="w-full md:w-2/5 p-4 sm:p-6 space-y-4">
          <div className="h-6 w-3/4 bg-slate-200 rounded" />
          <div className="h-8 w-1/2 bg-slate-200 rounded" />
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DEFAULT_FILTERS: FilterState = {
  brand: 'all',
  minYear: 'all',
  maxYear: 'all',
  year: 'all',
  bodyType: 'all',
  baseLength: 'all',
  fuelType: 'all',
  transmission: 'all',
  minPrice: 0,
  maxPrice: 0,
  minMileage: 0,
  maxMileage: 0,
  searchQuery: '',
  sortBy: 'featured'
};

const CARS_PER_PAGE = 12;
const CATALOG_STORAGE_KEY = 'kosalar_catalog_cars_v1';

function getInitialTransits(): { cars: TransitCar[]; hasCachedData: boolean } {
  // 1. First priority: Server-injected window.__INITIAL_CARS__
  if (typeof window !== 'undefined' && Array.isArray(window.__INITIAL_CARS__) && window.__INITIAL_CARS__.length > 0) {
    return { cars: window.__INITIAL_CARS__, hasCachedData: true };
  }

  // 2. Second priority: localStorage cache of the last successful list
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(CATALOG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { cars: parsed, hasCachedData: true };
        }
      }
    } catch (e) {
      console.warn('Could not read cached cars from localStorage:', e);
    }
  }

  // 3. Otherwise empty
  return { cars: [], hasCachedData: false };
}

function saveTransitsToLocalCache(cars: TransitCar[]) {
  if (typeof window !== 'undefined' && Array.isArray(cars) && cars.length > 0) {
    try {
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(cars));
    } catch (e) {
      console.warn('Could not save cars to localStorage cache:', e);
    }
  }
}

const normalizePath = (p: string) => {
  try {
    let clean = p.toLowerCase().trim();
    if (!clean || clean === '' || clean === '/index.html') return '/';
    if (clean.length > 1 && clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch (e) {
    return '/';
  }
};

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return normalizePath(window.location.pathname);
    }
    return '/';
  });
  const [navigationDirection, setNavigationDirection] = useState<'forward' | 'back'>('forward');

  // Stale-while-revalidate initial state: instant render from server injection or localStorage
  const [initialCatalog] = useState(() => {
    const init = getInitialTransits();
    if (init.hasCachedData) {
      saveTransitsToLocalCache(init.cars);
    }
    return init;
  });

  const [transits, setTransits] = useState<TransitCar[]>(initialCatalog.cars);
  const [isLoading, setIsLoading] = useState<boolean>(!initialCatalog.hasCachedData);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterVersion, setFilterVersion] = useState<number>(0);

  // Soften content change: trigger fade-in when applied filters change
  useEffect(() => {
    setFilterVersion((v) => v + 1);
  }, [filters]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kosalar_favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is string => typeof id === 'string');
        }
      }
    } catch (e) {
      console.warn('Could not load favorites from localStorage:', e);
    }
    return [];
  });
  const isMobile = useIsMobile();
  const [selectedCar, setSelectedCar] = useState<TransitCar | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const carId = params.get('car');
        if (carId) {
          const initialCars = initialCatalog.cars;
          const list = initialCars.length > 0 ? initialCars : INITIAL_TRANSITS;
          const matched = list.find(c => c.id.toLowerCase() === carId.toLowerCase());
          if (matched) return matched;
        }
      } catch (e) {}
    }
    return null;
  });

  // Mobile Parallax: shared detailX drives both the detail panel and catalog ("rope" effect)
  const viewportWidthRef = useRef<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
  const detailX = useMotionValue<number>(
    typeof window !== 'undefined'
      ? selectedCar !== null
        ? 0
        : window.innerWidth
      : 0
  );

  useEffect(() => {
    const handleResize = () => {
      viewportWidthRef.current = window.innerWidth;
      if (!selectedCar) {
        detailX.set(window.innerWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [selectedCar, detailX]);

  const catalogX = useTransform(detailX, (v) => (isMobile ? v - viewportWidthRef.current : 0));
  const pageShellRef = useRef<HTMLDivElement>(null); // attach to #page-shell
  const carDepthRef = useRef<number>(0);

  // Smooth mobile transitions: GPU layer only while moving, subscribe directly without React re-render
  useEffect(() => {
    const apply = (v: number) => {
      const el = pageShellRef.current;
      if (!el) return;
      const wc = isMobile && v < viewportWidthRef.current ? 'transform' : 'auto';
      if (el.style.willChange !== wc) el.style.willChange = wc;
    };
    apply(detailX.get());
    return detailX.on('change', apply);
  }, [detailX, isMobile]);

  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = normalizePath(window.location.pathname);
      return p === '/admin444';
    }
    return false;
  });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [detailModalMounted, setDetailModalMounted] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get('car'));
    }
    return false;
  });

  useEffect(() => {
    if (selectedCar && !detailModalMounted) {
      setDetailModalMounted(true);
    }
  }, [selectedCar, detailModalMounted]);

  const [DetailModalComp, setDetailModalComp] = useState<React.ComponentType<any> | null>(null);
  useEffect(() => {
    let alive = true;
    prefetchDetailModal().then((m) => { if (alive) setDetailModalComp(() => m.default); });
    return () => { alive = false; };
  }, []);

  // References to keep latest path and cars available in event listeners without re-binding
  const currentPathRef = useRef(currentPath);
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  const transitsRef = useRef(transits);
  useEffect(() => {
    transitsRef.current = transits;
  }, [transits]);

  const detailOpenedFromCatalogRef = useRef<boolean>(false);
  const initialCarHandledRef = useRef<boolean>(false);

  // Determine if the current route is 404 (Not Found)
  // Valid routes: '/' (home/catalog), '/admin444', '/haqqimizda', '/elaqe'
  const isHomeRoute = currentPath === '/' || currentPath === '' || currentPath === '/index.html';
  const isAdminRoute = currentPath === '/admin444';
  const isAboutRoute = currentPath === '/haqqimizda';
  const isContactRoute = currentPath === '/elaqe';
  const is404 = !isHomeRoute && !isAdminRoute && !isAboutRoute && !isContactRoute;

  // Sync favorites changes with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('kosalar_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.warn('Could not save favorites to localStorage:', e);
    }
  }, [favorites]);

  // Preload About Us showroom location image immediately on app mount
  useEffect(() => {
    const img = new Image();
    img.src = salonFoto;
  }, []);

  // Set document title and sync state with Supabase / server API
  useEffect(() => {
    if (is404) {
      document.title = "404 - Səhifə tapılmadı | Kosalar Auto";
    } else if (adminOpen || isAdminRoute) {
      document.title = "Admin panel - Kosalar Auto";
    } else if (isAboutRoute) {
      document.title = "Haqqımızda | Kosalar Auto";
    } else if (isContactRoute) {
      document.title = "Əlaqə | Kosalar Auto";
    } else {
      document.title = "Kosalar Auto - Ford Transit satış mərkəzi";
    }

    let isMounted = true;

    const fetchLatestCars = async (isInitial = false) => {
      if (!isMounted) return;
      // Show full loading skeleton only when there is genuinely no cached data from any source
      if (isInitial && transitsRef.current.length === 0) {
        setIsLoading(true);
      }

      try {
        // 1. Primary source: fetch from GET /api/cars (server reads Supabase and maintains authoritative cache)
        try {
          const apiRes = await fetchAllCarsFromApi();
          if (isMounted && apiRes.success && Array.isArray(apiRes.cars) && apiRes.cars.length > 0) {
            setTransits(apiRes.cars);
            saveTransitsToLocalCache(apiRes.cars);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Backend API cars fetch notice:', err);
        }

        // 2. Fallback: try fetching directly from Supabase with short timeout (5s) and at most 1 retry
        try {
          const { fetchCarsFromSupabase } = await import('./services/supabaseFallbackService');
          const sbRes = await fetchCarsFromSupabase(1, 5000);
          if (isMounted && sbRes.success && Array.isArray(sbRes.data) && sbRes.data.length > 0) {
            setTransits(sbRes.data);
            saveTransitsToLocalCache(sbRes.data);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Supabase direct fetch fallback notice:', e);
        }
      } catch (err) {
        console.warn('Cars sync process error:', err);
      } finally {
        if (isMounted) {
          setTransits(prev => {
            if (prev.length > 0) return prev;
            saveTransitsToLocalCache(INITIAL_TRANSITS);
            return INITIAL_TRANSITS;
          });
          setIsLoading(false);
        }
      }
    };

    // Initial background revalidation on mount
    fetchLatestCars(true);

    // BroadcastChannel for instant real-time sync across tabs and windows (only on explicit car updates)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('kosalar_auto_cars_channel');
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'CARS_UPDATED') {
          if (Array.isArray(event.data.cars) && event.data.cars.length > 0) {
            setTransits(event.data.cars);
            saveTransitsToLocalCache(event.data.cars);
          } else {
            fetchLatestCars(false);
          }
        }
      };
    } catch (e) {}

    // Explicit manual updates handler (e.g. admin saves changes) - silent update without reload flicker
    const handleExplicitUpdate = () => {
      fetchLatestCars(false);
    };

    window.addEventListener('carsUpdated', handleExplicitUpdate);

    return () => {
      isMounted = false;
      if (bc) bc.close();
      window.removeEventListener('carsUpdated', handleExplicitUpdate);
    };
  }, [adminOpen, isAdminRoute, isAboutRoute, isContactRoute, is404]);

  // Keep selectedCar in sync if transits update (e.g. photos/price changed in admin)
  useEffect(() => {
    if (selectedCar) {
      const updated = transits.find(c => c.id === selectedCar.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedCar)) {
        setSelectedCar(updated);
      }
    }
  }, [transits]);

  // URL route monitoring, shared car link params & keyboard shortcut
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const carId = params.get('car');
      if (carId && !initialCarHandledRef.current) {
        const list = transits.length > 0 ? transits : INITIAL_TRANSITS;
        const matchedCar = list.find(c => c.id.toLowerCase() === carId.toLowerCase());
        if (matchedCar) {
          initialCarHandledRef.current = true;
          // Direct/shared ?car= link visit: give a synthetic catalog entry underneath
          if (!window.history.state?.carModal) {
            const originalUrl = window.location.href;
            const catalogUrl = new URL(originalUrl);
            catalogUrl.searchParams.delete('car');
            catalogUrl.searchParams.delete('overlay');
            catalogUrl.searchParams.delete('photo');
            window.history.replaceState({}, '', catalogUrl.toString());
            window.history.pushState({ carModal: true, carDepth: 1 }, '', originalUrl);
            carDepthRef.current = 1;
          } else {
            carDepthRef.current = typeof window.history.state?.carDepth === 'number' && window.history.state.carDepth > 0
              ? window.history.state.carDepth
              : 1;
          }
          detailOpenedFromCatalogRef.current = true;
          setSelectedCar(matchedCar);
        }
      }

      const p = normalizePath(window.location.pathname);
      setCurrentPath(p);
      if (p === '/admin444') {
        setAdminOpen(true);
      }
    } catch (e) {}

    const handlePopState = (event: Event) => {
      const st = (event as PopStateEvent).state;
      const newDepth = st && st.carModal ? (typeof st.carDepth === 'number' && st.carDepth > 0 ? st.carDepth : 1) : 0;
      if (newDepth > carDepthRef.current) {
        // Browser FORWARD into a car entry (forward gesture/button) — undo it, never reopen
        window.history.go(carDepthRef.current - newDepth);
        return;
      }
      carDepthRef.current = newDepth;

      const p = normalizePath(window.location.pathname);
      const pathChanged = p !== currentPathRef.current;
      setCurrentPath(p);
      currentPathRef.current = p;
      if (p === '/admin444') {
        setAdminOpen(true);
      } else {
        setAdminOpen(false);
      }

      // Read the car query param from the URL on every popstate event
      try {
        const params = new URLSearchParams(window.location.search);
        const carId = params.get('car');
        if (carId) {
          const list = transitsRef.current.length > 0 ? transitsRef.current : transits;
          const matchedCar = (list.length > 0 ? list : INITIAL_TRANSITS).find(c => c.id.toLowerCase() === carId.toLowerCase());
          setNavigationDirection('back');
          setSelectedCar(matchedCar || null);
        } else {
          setSelectedCar(null);
          detailOpenedFromCatalogRef.current = false;
        }
      } catch (e) {
        setSelectedCar(null);
        detailOpenedFromCatalogRef.current = false;
      }

      if (pathChanged) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    const handleHashChange = () => {
      const p = normalizePath(window.location.pathname);
      setCurrentPath(p);
      if (p === '/admin444') {
        setAdminOpen(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + A (or Shift + Ctrl + A) shortcut to open Admin Panel
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setAdminOpen(prev => {
          const nextState = !prev;
          try {
            if (nextState) {
              window.history.pushState({}, '', '/admin444');
              setCurrentPath('/admin444');
            } else {
              window.history.pushState({}, '', '/');
              setCurrentPath('/');
            }
          } catch (err) {}
          return nextState;
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [transits]);

  const handleOpenAdmin = useCallback(() => {
    setAdminOpen(true);
    setCurrentPath('/admin444');
    try {
      window.history.pushState({}, '', '/admin444');
    } catch (e) {}
  }, []);

  const handleCloseAdmin = useCallback(() => {
    setAdminOpen(false);
    try {
      window.history.pushState({}, '', '/');
    } catch (e) {}
    setCurrentPath('/');
  }, []);

  const handleGoHomeFrom404 = useCallback(() => {
    try {
      window.history.pushState({}, '', '/');
    } catch (e) {}
    setCurrentPath('/');
    setAdminOpen(false);
  }, []);

  const pendingSectionRef = useRef<string | null>(null);

  // Sync modal state with URL - opening from catalog or favorites drawer
  const handleOpenDetail = useCallback((car: TransitCar) => {
    detailOpenedFromCatalogRef.current = true;
    setNavigationDirection('forward');
    setSelectedCar(car);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('car', car.id);
      url.searchParams.delete('overlay');
      url.searchParams.delete('photo');
      window.history.pushState({ carModal: true, carDepth: 1 }, '', url.toString());
      carDepthRef.current = 1;
    } catch (e) {}
  }, []);

  // Switch to a similar car from within the open Detail Modal (PUSHES history state with incremented carDepth)
  const handleSelectSimilarCar = useCallback((car: TransitCar) => {
    detailOpenedFromCatalogRef.current = true;
    setNavigationDirection('forward');
    setSelectedCar(car);
    try {
      const currentDepth = (window.history.state && typeof window.history.state.carDepth === 'number' && window.history.state.carDepth > 0)
        ? window.history.state.carDepth
        : 1;
      const nextDepth = currentDepth + 1;
      const url = new URL(window.location.href);
      url.searchParams.set('car', car.id);
      url.searchParams.delete('overlay');
      url.searchParams.delete('photo');
      window.history.pushState({ carModal: true, carDepth: nextDepth }, '', url.toString());
      carDepthRef.current = nextDepth;
    } catch (e) {}
  }, []);

  // Close actions (desktop X, clicking backdrop, Escape): close detail view entirely and unwind car stack in one action
  const handleCloseDetail = useCallback(() => {
    try {
      const state = window.history.state;
      if (state?.carModal) {
        detailOpenedFromCatalogRef.current = false;
        const depth = (typeof state.carDepth === 'number' && state.carDepth > 0) ? state.carDepth : 1;
        window.history.go(-depth);
      } else {
        // Defensive fallback for fresh tab with no prior carModal history pushed by this site
        detailOpenedFromCatalogRef.current = false;
        setSelectedCar(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('car');
        url.searchParams.delete('overlay');
        url.searchParams.delete('photo');
        window.history.replaceState({}, '', url.toString());
        carDepthRef.current = 0;
      }
    } catch (e) {
      detailOpenedFromCatalogRef.current = false;
      setSelectedCar(null);
      carDepthRef.current = 0;
    }
  }, []);

  // Back actions (mobile header back arrow): go back exactly ONE step in history
  const handleBackDetail = useCallback(() => {
    try {
      const state = window.history.state;
      if (state?.carModal) {
        window.history.back();
      } else {
        // Defensive fallback for fresh tab
        detailOpenedFromCatalogRef.current = false;
        setSelectedCar(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('car');
        url.searchParams.delete('overlay');
        url.searchParams.delete('photo');
        window.history.replaceState({}, '', url.toString());
        carDepthRef.current = 0;
      }
    } catch (e) {
      setSelectedCar(null);
      carDepthRef.current = 0;
    }
  }, []);

  // Filter & Sort Logic (Only active cars displayed on the public visitor catalog)
  const filteredTransits = useMemo(() => {
    return filterAndSortTransits(transits, filters);
  }, [transits, filters]);

  // Reset pagination to page 1 whenever filters or sort criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Pagination calculations for the public catalog grid
  const totalPages = Math.ceil(filteredTransits.length / CARS_PER_PAGE);

  // If current page is beyond totalPages (e.g. after a filter or car deletion), clamp to last valid page
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const safeCurrentPage = totalPages > 0 ? Math.min(Math.max(1, currentPage), totalPages) : 1;

  // Paginated slice of cars to display on the current page
  const paginatedTransits = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * CARS_PER_PAGE;
    return filteredTransits.slice(startIndex, startIndex + CARS_PER_PAGE);
  }, [filteredTransits, safeCurrentPage]);

  // Favorites toggle
  const handleToggleFavorite = useCallback((carId: string) => {
    setFavorites(prev => 
      prev.includes(carId) ? prev.filter(id => id !== carId) : [...prev, carId]
    );
  }, []);

  const favoriteCars = useMemo(() => {
    return transits.filter(c => favorites.includes(c.id) && c.status !== 'sold');
  }, [transits, favorites]);

  // Smooth scroll helper with dynamic header height offset calculation
  const scrollToSection = useCallback((sectionId: string) => {
    // Ensure body scroll lock is unset
    document.body.style.overflow = '';
    
    if (sectionId === 'hero' || sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const elem = document.getElementById(sectionId);
    if (elem) {
      // Dynamically measure the fixed/sticky header height
      const headerElem = document.getElementById('main-header') || document.querySelector('header');
      const measuredHeaderHeight = headerElem ? headerElem.getBoundingClientRect().height : (window.innerWidth < 640 ? 70 : 80);
      // Add extra breathing room (12px on mobile, 16px on desktop) so content does not touch header border
      const extraOffset = window.innerWidth < 640 ? 12 : 16;
      const totalHeaderOffset = measuredHeaderHeight + extraOffset;

      const elementPosition = elem.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - totalHeaderOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  }, []);

  // Scroll to target section when transitioning back to homepage from another route
  useEffect(() => {
    if (currentPath === '/' && pendingSectionRef.current) {
      const targetSection = pendingSectionRef.current;
      pendingSectionRef.current = null;
      scrollToSection(targetSection);
    }
  }, [currentPath, scrollToSection]);

  // Handle site navigation between routes and catalog sections
  const handleNavigate = useCallback((target: string) => {
    if (target === '/haqqimizda' || target === 'haqqimizda') {
      try {
        window.history.pushState({}, '', '/haqqimizda');
      } catch (e) {}
      setCurrentPath('/haqqimizda');
      setAdminOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === '/elaqe' || target === 'elaqe') {
      try {
        window.history.pushState({}, '', '/elaqe');
      } catch (e) {}
      setCurrentPath('/elaqe');
      setAdminOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === '/' || target === 'hero' || target === 'home') {
      try {
        window.history.pushState({}, '', '/');
      } catch (e) {}
      setCurrentPath('/');
      setAdminOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'movcud-avtomobiller' || target === 'katalog') {
      if (currentPath !== '/') {
        try {
          window.history.pushState({}, '', '/');
        } catch (e) {}
        pendingSectionRef.current = 'movcud-avtomobiller';
        setCurrentPath('/');
        setAdminOpen(false);
      } else {
        scrollToSection('movcud-avtomobiller');
      }
    } else {
      scrollToSection(target);
    }
  }, [currentPath, scrollToSection]);

  // Handle page change and smoothly scroll back to top of catalog listings
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    scrollToSection('movcud-avtomobiller');
  }, [scrollToSection]);

  const handleOpenFavorites = useCallback(() => {
    setFavoritesOpen(true);
  }, []);

  const handleCallHero = useCallback(() => {
    handleNavigate('/elaqe');
  }, [handleNavigate]);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }, []);

  if (is404) {
    return <NotFound onGoHome={handleGoHomeFrom404} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-['-apple-system','BlinkMacSystemFont','Segoe_UI','Roboto','Helvetica_Neue',Arial,sans-serif]">
      
      {/* Catalog Page Shell (Parallax push transition on mobile) */}
      <motion.div
        ref={pageShellRef}
        id="page-shell"
        className="flex-1 flex flex-col min-w-0"
        style={{ x: catalogX }}
        transformTemplate={(_, generated) => {
          if (!generated || generated === 'none') return 'none';
          const cleaned = generated.replace(/translateZ\([^)]*\)/g, '').trim();
          if (
            cleaned === '' ||
            cleaned === 'translateX(0px)' ||
            cleaned === 'translateX(0%)' ||
            cleaned === 'translateX(0)'
          ) {
            return 'none';
          }
          return generated;
        }}
      >
        {/* Header */}
        <Header
        favoritesCount={favoriteCars.length}
        onOpenFavorites={handleOpenFavorites}
        onNavigate={handleNavigate}
        currentPath={currentPath}
      />

      {/* Main Content */}
      <main className="flex-1">
        {isAboutRoute ? (
          /* Haqqımızda (About Us) Standalone Page View */
          <div>
            <div className="bg-white border-b border-slate-200/80 py-3.5">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <button 
                  onClick={() => handleNavigate('/')} 
                  className="hover:text-[#1D4ED8] transition-colors cursor-pointer"
                >
                  Ana səhifə
                </button>
                <span className="text-slate-300">/</span>
                <span className="text-[#0F172A] font-bold">Haqqımızda</span>
              </div>
            </div>
            <AboutUs />
          </div>
        ) : isContactRoute ? (
          /* Əlaqə (Contact) Standalone Page View */
          <div>
            <div className="bg-white border-b border-slate-200/80 py-3.5">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <button 
                  onClick={() => handleNavigate('/')} 
                  className="hover:text-[#1D4ED8] transition-colors cursor-pointer"
                >
                  Ana səhifə
                </button>
                <span className="text-slate-300">/</span>
                <span className="text-[#0F172A] font-bold">Əlaqə</span>
              </div>
            </div>
            <ContactFooter />
          </div>
        ) : (
          /* Homepage: dedicated purely to the car catalog */
          <>
            {/* Hero Section */}
            <Hero
              onCall={handleCallHero}
            />

            {/* Filter & Catalog Section */}
            <section id="katalog" className="py-4 sm:py-6 lg:py-7 bg-[#F8FAFC] scroll-mt-20 sm:scroll-mt-24">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-3 sm:space-y-4">
                
                {/* Search Filter Bar */}
                <FilterBar
                  cars={transits}
                  filters={filters}
                  onFilterChange={setFilters}
                  onResetFilters={handleResetFilters}
                  totalResultsCount={filteredTransits.length}
                  isModalOpen={filterModalOpen}
                  setIsModalOpen={setFilterModalOpen}
                />

                {/* Catalog Grid */}
                <div id="movcud-avtomobiller" className="scroll-mt-20 sm:scroll-mt-24">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 sm:mb-3.5">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                        Elanlar
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-xs font-bold text-[#0F172A] bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/50 shadow-xs">
                        {isLoading ? 'Yüklənir...' : `Ümumi: ${filteredTransits.length} model`}
                      </span>
                      {!isLoading && totalPages > 1 && (
                        <span className="text-xs font-bold text-[#1D4ED8] bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200/60 shadow-xs">
                          Səhifə {safeCurrentPage} / {totalPages}
                        </span>
                      )}
                    </div>
                  </div>

                  <style>{`
                    @keyframes catalogFadeIn {
                      0% { opacity: 0; }
                      100% { opacity: 1; }
                    }
                    .catalog-fade-in {
                      animation: catalogFadeIn 200ms ease-out forwards;
                    }
                    @media (prefers-reduced-motion: reduce) {
                      .catalog-fade-in {
                        animation: none !important;
                        opacity: 1 !important;
                      }
                    }
                  `}</style>

                  {isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5 lg:gap-4">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <TransitCardSkeleton key={index} />
                      ))}
                    </div>
                  ) : (
                    <div key={filterVersion} className="catalog-fade-in">
                      {filteredTransits.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/60 shadow-sm max-w-xl mx-auto my-8 space-y-4">
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center mx-auto">
                            <FilterX className="w-8 h-8" />
                          </div>
                          <h3 className="text-lg font-bold text-[#0F172A]">Axtarışınıza uyğun model tapılmadı</h3>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Axtarış filtrlərini və ya qiymət aralığını dəyişərək yenidən cəhd edin və ya bütün avtomobillərə baxın.
                          </p>
                          <button
                            onClick={handleResetFilters}
                            className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-sm transition-colors cursor-pointer"
                          >
                            Filtri sıfırla
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3.5 lg:gap-4">
                            {paginatedTransits.map((car, idx) => (
                              <TransitCard
                                key={car.id}
                                car={car}
                                onViewDetails={handleOpenDetail}
                                isFavorite={favorites.includes(car.id)}
                                onToggleFavorite={handleToggleFavorite}
                                priority={idx < 4}
                              />
                            ))}
                          </div>

                          {/* Turbo.az Style Pagination Controls */}
                          <Pagination
                            currentPage={safeCurrentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      {!isContactRoute && <Footer onNavigate={handleNavigate} />}
      </motion.div>

      {/* Floating WhatsApp Quick Action Button (Hidden when Car Details Modal, drawers or Filter modal are open) */}
      {!selectedCar && !favoritesOpen && !adminOpen && !filterModalOpen && (
        <div className="fixed bottom-5 right-5 z-[40] flex items-center group animate-in fade-in duration-200">
          {/* Subtle Ping Indicator for Friendly Animation */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white"></span>
          </span>

          {/* Hover Tooltip Label */}
          <div className="pointer-events-none absolute right-full mr-3 whitespace-nowrap bg-slate-900/95 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 flex items-center gap-2 hidden sm:flex">
            <img 
              src={whatsappLogo} 
              alt="WhatsApp Logo" 
              className="w-4 h-4 object-contain"
              referrerPolicy="no-referrer"
            />
            <span>WhatsApp ilə əlaqə</span>
          </div>

          <a
            href={WHATSAPP_DIRECT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick()}
            className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full sm:rounded-2xl shadow-2xl shadow-emerald-950/40 flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 border border-emerald-300/40 group-hover:shadow-emerald-500/30"
            title="WhatsApp ilə əlaqə"
          >
            <img 
              src={whatsappLogo} 
              alt="WhatsApp Logo" 
              className="w-5 h-5 sm:w-5 sm:h-5 object-contain transition-transform group-hover:rotate-12 duration-200"
              referrerPolicy="no-referrer"
            />
            <span className="font-bold text-xs sm:text-sm whitespace-nowrap">Sualınız var?</span>
          </a>
        </div>
      )}

      {/* Detail Modal */}
      {detailModalMounted && (DetailModalComp
        ? (
          <DetailModalComp
            car={selectedCar}
            onClose={handleCloseDetail}
            onBack={handleBackDetail}
            direction={navigationDirection}
            isFavorite={selectedCar ? favorites.includes(selectedCar.id) : false}
            onToggleFavorite={handleToggleFavorite}
            allCars={transits}
            onSelectCar={handleSelectSimilarCar}
            favorites={favorites}
            detailX={detailX}
          />
        )
        : (selectedCar && !isMobile ? <DetailModalFallback /> : null))}

      {/* Favorites Drawer */}
      <FavoritesDrawer
        isOpen={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
        favorites={favoriteCars}
        onRemoveFavorite={handleToggleFavorite}
        onViewDetails={handleOpenDetail}
      />

      {/* Admin Panel Modal protected by Error Boundary and Suspense */}
      {adminOpen && (
        <AdminErrorBoundary onClose={handleCloseAdmin}>
          <React.Suspense
            fallback={
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-200 text-sm font-semibold">Admin panel yüklənir...</span>
                </div>
              </div>
            }
          >
            <AdminModal
              isOpen={adminOpen}
              onClose={handleCloseAdmin}
              cars={transits}
              onCarsUpdated={(updated) => setTransits(updated)}
            />
          </React.Suspense>
        </AdminErrorBoundary>
      )}

    </div>
  );
}
