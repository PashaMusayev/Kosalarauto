import React, { useState, useEffect, useRef } from 'react';
import { Phone, MessageCircle, Menu, X, Shield, Heart, Truck, Clock, MapPin } from 'lucide-react';
import { PHONE_NUMBER, WHATSAPP_NUMBER, WHATSAPP_DIRECT_LINK } from '../data/transits';
import fordLogo from '../pics/ford logo.png';
import whatsappLogo from '../pics/whatsapp logo.png';
import { trackWhatsAppClick } from '../services/analyticsService';

interface HeaderProps {
  favoritesCount: number;
  onOpenFavorites: () => void;
  onNavigate: (sectionOrPath: string) => void;
  currentPath?: string;
}

export const Header: React.FC<HeaderProps> = ({
  favoritesCount,
  onOpenFavorites,
  onNavigate,
  currentPath = '/'
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const isScrolledRef = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const nextScrolled = window.scrollY > 20;
        if (isScrolledRef.current !== nextScrolled) {
          isScrolledRef.current = nextScrolled;
          setIsScrolled(nextScrolled);
        }
      });
    };

    // Initial check
    const initialScrolled = window.scrollY > 20;
    if (isScrolledRef.current !== initialScrolled) {
      isScrolledRef.current = initialScrolled;
      setIsScrolled(initialScrolled);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const handleNav = (target: string) => {
    // Immediately close mobile menu so layout collapses synchronously before navigation/scroll
    setMobileMenuOpen(false);

    if (target === '/haqqimizda' || target === 'haqqimizda') {
      onNavigate('/haqqimizda');
    } else if (target === '/elaqe' || target === 'elaqe') {
      onNavigate('/elaqe');
    } else if (target === '/' || target === 'hero' || target === 'home') {
      onNavigate('/');
    } else if (target === 'movcud-avtomobiller') {
      onNavigate('movcud-avtomobiller');
    } else {
      onNavigate(target);
    }
  };

  return (
    <header id="main-header" className={`sticky top-0 z-40 transition-[background-color,box-shadow] duration-300 py-3.5 bg-white text-slate-900 ${
      isScrolled 
        ? 'shadow-sm' 
        : ''
    }`}>
      {/* Top micro bar for quick trust info */}
      <div className="hidden lg:block bg-slate-50/80 text-slate-600 text-xs py-1.5 mb-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-[#1D4ED8]" />
              İş saatları: B.e - B. 09:00 - 19:00
            </span>
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#1D4ED8]" />
              Bakı, Yeni Günəşli qəsəbəsi, Fatimeyi-Zəhra məscidin yanı
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <button 
          onClick={() => handleNav('/')} 
          className="flex items-center gap-3 group text-left cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#0F172A] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform border border-slate-200">
            <img 
              src={fordLogo} 
              alt="Kosalar Auto Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Truck className="w-6 h-6 text-[#1D4ED8] hidden group-has-[img:not([style*='display: none'])]:hidden" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xl tracking-tight text-[#0F172A] group-hover:text-[#1D4ED8] transition-colors">
                Kosalar Auto
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold">Ford Transit mərkəzi</p>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => handleNav('/')} 
            className={`text-sm font-bold transition-colors cursor-pointer ${
              currentPath === '/' || currentPath === '' || currentPath === '/index.html'
                ? 'text-[#1D4ED8]'
                : 'text-[#0F172A] hover:text-[#1D4ED8]'
            }`}
          >
            Ana səhifə
          </button>
          <button 
            onClick={() => handleNav('movcud-avtomobiller')} 
            className="text-sm font-bold text-[#0F172A] hover:text-[#1D4ED8] transition-colors cursor-pointer"
          >
            Avtomobillər
          </button>
          <button 
            onClick={() => handleNav('/haqqimizda')} 
            className={`text-sm font-bold transition-colors cursor-pointer ${
              currentPath === '/haqqimizda' || currentPath === '/haqqimizda/'
                ? 'text-[#1D4ED8]'
                : 'text-[#0F172A] hover:text-[#1D4ED8]'
            }`}
          >
            Haqqımızda
          </button>
          <button 
            onClick={() => handleNav('/elaqe')} 
            className={`text-sm font-bold transition-colors cursor-pointer ${
              currentPath === '/elaqe' || currentPath === '/elaqe/'
                ? 'text-[#1D4ED8]'
                : 'text-[#0F172A] hover:text-[#1D4ED8]'
            }`}
          >
            Əlaqə
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Favorites Button */}
          <button 
            onClick={onOpenFavorites}
            className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 shadow-xs"
            title="Seçilmişlər"
          >
            <Heart className="w-5 h-5 text-rose-600" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center animate-bounce shadow-md">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Quick Phone Call Button (Icon only, on the left) */}
          <a
            href={`tel:${PHONE_NUMBER.replace(/\s+/g, '')}`}
            className="w-10 h-10 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white flex items-center justify-center shadow-sm transition-all hover:scale-105"
            title={`Zəng et: ${PHONE_NUMBER}`}
            aria-label={`Zəng et: ${PHONE_NUMBER}`}
          >
            <Phone className="w-4 h-4 text-white" />
          </a>

          {/* WhatsApp Direct Chat (On the right) */}
          <a
            href={WHATSAPP_DIRECT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick()}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-sm transition-all hover:scale-105"
            title="WhatsApp"
          >
            <img 
              src={whatsappLogo} 
              alt="WhatsApp" 
              className="w-4 h-4 object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="inline whitespace-nowrap">WhatsApp</span>
          </a>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 sm:hidden">
          <button 
            onClick={onOpenFavorites}
            className="relative p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200"
          >
            <Heart className="w-5 h-5 text-rose-600" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                {favoritesCount}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200"
            aria-label="Menyu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl rounded-b-2xl border-b border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-2">
            <button 
              onClick={() => handleNav('/')} 
              className={`text-left px-3 py-2 rounded-lg font-bold text-sm transition-colors cursor-pointer ${
                currentPath === '/' || currentPath === '' || currentPath === '/index.html'
                  ? 'bg-blue-50 text-[#1D4ED8]'
                  : 'text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              Ana səhifə
            </button>
            <button 
              onClick={() => handleNav('movcud-avtomobiller')} 
              className="text-left px-3 py-2 rounded-lg text-[#0F172A] hover:bg-slate-100 font-bold text-sm cursor-pointer"
            >
              Avtomobillər (kataloq)
            </button>
            <button 
              onClick={() => handleNav('/haqqimizda')} 
              className={`text-left px-3 py-2 rounded-lg font-bold text-sm transition-colors cursor-pointer ${
                currentPath === '/haqqimizda' || currentPath === '/haqqimizda/'
                  ? 'bg-blue-50 text-[#1D4ED8]'
                  : 'text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              Haqqımızda
            </button>
            <button 
              onClick={() => handleNav('/elaqe')} 
              className={`text-left px-3 py-2 rounded-lg font-bold text-sm transition-colors cursor-pointer ${
                currentPath === '/elaqe' || currentPath === '/elaqe/'
                  ? 'bg-blue-50 text-[#1D4ED8]'
                  : 'text-[#0F172A] hover:bg-slate-100'
              }`}
            >
              Əlaqə
            </button>
          </nav>

          <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2.5">
            <a
              href={`tel:${PHONE_NUMBER.replace(/\s+/g, '')}`}
              className="h-11 flex items-center justify-center gap-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-sm shadow-sm transition-all"
              title={`Zəng et: ${PHONE_NUMBER}`}
              aria-label={`Zəng et: ${PHONE_NUMBER}`}
            >
              <Phone className="w-4 h-4 text-white" />
              <span>Zəng et</span>
            </a>
            <a
              href={WHATSAPP_DIRECT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackWhatsAppClick()}
              className="h-11 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl text-sm shadow-sm transition-all"
            >
              <img 
                src={whatsappLogo} 
                alt="WhatsApp" 
                className="w-4 h-4 object-contain"
                referrerPolicy="no-referrer"
              />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
