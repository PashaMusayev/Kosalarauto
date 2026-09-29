import React from 'react';
import { DetailShowroomInfo } from './DetailShowroomInfo';

interface DetailFeaturesAndShowroomProps {
  description?: string;
  activeFeaturesList: string[];
}

export const DetailFeaturesAndShowroom: React.FC<DetailFeaturesAndShowroomProps> = ({
  description,
  activeFeaturesList,
}) => {
  const hasFeatures = Boolean(activeFeaturesList && activeFeaturesList.length > 0);
  const cleanDescription = (description || '').trim();
  const hasDescription = Boolean(cleanDescription);

  return (
    <>
      {/* 3. QEYD VƏ TƏSVİR (Yalnız təsvir daxil edildikdə göstərilir) */}
      {hasDescription && (
        <div
          className={`text-sm text-slate-800 leading-relaxed whitespace-pre-line font-normal ${
            hasFeatures
              ? 'border-b border-slate-200 pb-6'
              : 'border-b border-slate-200 pb-6 md:border-b-0 md:pb-0'
          }`}
        >
          {cleanDescription}
        </div>
      )}

      {/* 4. TƏCHİZAT (TURBO.AZ SƏTİR DÜZÜLÜŞÜ - TƏSVİRDƏN SONRA GƏLİR) */}
      {hasFeatures && (
        <div className="border-b border-slate-200 pb-6 md:border-b-0 md:pb-0">
          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {activeFeaturesList.map((feature, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 text-slate-800 text-xs sm:text-sm font-medium border border-slate-200"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Avtosalon Məlumatı (YALNIZ MOBİLDƏ GÖSTƏRİLİR - Desktopda sağ yapışqan kartın daxilindədir) */}
      <div className="md:hidden">
        <DetailShowroomInfo variant="banner" />
      </div>
    </>
  );
};
