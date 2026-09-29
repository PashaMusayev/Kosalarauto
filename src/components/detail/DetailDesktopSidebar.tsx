import React from 'react';
import { Phone } from 'lucide-react';
import { PHONE_NUMBER } from '../../data/transits';
import whatsappLogo from '../../pics/whatsapp logo.png';
import { trackWhatsAppClick } from '../../services/analyticsService';
import { DetailShowroomInfo } from './DetailShowroomInfo';
import { StatusBadges } from './StatusBadges';

export interface DetailDesktopSidebarProps {
  safePrice: string;
  vehicleMainTitle: string;
  safeMileage: string;
  whatsappUrl: string;
  statusBadges?: string[];
}

export const DetailDesktopSidebar: React.FC<DetailDesktopSidebarProps> = ({
  safePrice,
  vehicleMainTitle,
  safeMileage,
  whatsappUrl,
  statusBadges,
}) => {
  return (
    <div className="hidden md:flex md:w-[42%] lg:w-[40%] flex-col p-3.5 lg:p-5 md:sticky md:top-0 md:self-start z-10">
      {/* Turbo.az Stili Ağ Kart */}
      <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-xs p-4 lg:p-5 flex flex-col space-y-3.5">
        {/* 1. Qiymət */}
        <div className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none">
          {safePrice} <span className="text-xl lg:text-2xl font-extrabold text-slate-900">₼</span>
        </div>

        {/* 2. Avtomobilin Adı, Yürüş və Nişanlar */}
        <div>
          <h1 className="text-base lg:text-lg font-bold text-slate-900 leading-snug">
            {vehicleMainTitle}
          </h1>
          {safeMileage && safeMileage !== '0' ? (
            <div className="text-xs lg:text-sm font-semibold text-slate-600 mt-1">
              {safeMileage} km
            </div>
          ) : null}
          <StatusBadges badges={statusBadges} className="mt-2 flex flex-wrap items-center gap-1.5" />
        </div>

        {/* 3. "Zəng et" və "WhatsApp ilə yaz" Düymələri */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <a
            href={`tel:${PHONE_NUMBER.replace(/\s+/g, '')}`}
            className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]"
            title="Zəng et"
          >
            <Phone className="w-4 h-4 text-white" />
            <span>Zəng et: {PHONE_NUMBER}</span>
          </a>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWhatsAppClick()}
            className="w-full py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1da851] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]"
          >
            <img 
              src={whatsappLogo} 
              alt="WhatsApp" 
              className="w-4 h-4 object-contain"
              referrerPolicy="no-referrer"
            />
            <span>WhatsApp ilə yaz</span>
          </a>
        </div>

        {/* 4. Avtosalon Məlumatı (Turbo.az stili satıcı kartı) */}
        <div className="pt-3 border-t border-slate-100">
          <DetailShowroomInfo variant="card" />
        </div>
      </div>
    </div>
  );
};
