import React from 'react';
import { StatusBadges } from './StatusBadges';

interface DetailMobileTitleBlockProps {
  safePrice: string;
  vehicleMainTitle: string;
  safeMileage: string;
  statusBadges?: string[];
}

export const DetailMobileTitleBlock: React.FC<DetailMobileTitleBlockProps> = ({
  safePrice,
  vehicleMainTitle,
  safeMileage,
  statusBadges,
}) => {
  return (
    <div className="border-b border-slate-200 pb-4 block w-full md:hidden">
      {/* Qiymət */}
      <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
        {safePrice} <span className="text-xl sm:text-2xl font-extrabold text-slate-900">₼</span>
      </div>

      {/* Avtomobilin Tam Adı */}
      <h1 className="text-lg sm:text-xl font-bold text-black mt-2 leading-snug">
        <div className="text-lg sm:text-xl font-bold text-black">
          {vehicleMainTitle}
        </div>
        <div className="text-base sm:text-lg font-bold text-black mt-0.5">
          {safeMileage} km
        </div>
      </h1>

      {/* Status teqləri */}
      <StatusBadges badges={statusBadges} className="mt-2.5 flex flex-wrap items-center gap-2" />
    </div>
  );
};
