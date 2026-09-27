import React, { useState } from 'react';
import { Phone, MessageCircle, MapPin, Clock, Truck, ShieldCheck, Copy, Check, ExternalLink, Navigation } from 'lucide-react';
import { PHONE_NUMBER, WHATSAPP_NUMBER, SHOWROOM_ADDRESS, WORKING_HOURS, SHOWROOM_MAP_URL } from '../data/transits';
import fordLogo from '../pics/ford logo.png';
import { trackWhatsAppClick } from '../services/analyticsService';

export const ContactFooter: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(SHOWROOM_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer id="elaqe" className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800 relative scroll-mt-20 sm:scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Brand Info */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center text-white border border-blue-400/40 shadow-lg shadow-blue-900/40">
                <img 
                  src={fordLogo}
                  alt="Kosalar Auto" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="font-black text-xl text-white tracking-tight">Kosalar Auto</span>
                <p className="text-[11px] text-slate-400 font-medium">Ford Transit satış mərkəzi</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              20+ illik iş təcrübəsi ilə Ford Transit avtomobillərinin satışı üzrə ixtisaslaşmışıq. Bizimlə hər zaman dürüst xidmət, şəffaf yürüş və sağlam texniki vəziyyət əldə edirsiniz.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick()}
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"
                title="WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href={SHOWROOM_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                title="Google Maps konumu"
              >
                <MapPin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Contact Details Column */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-sm font-extrabold text-white border-b border-slate-800 pb-2">
              Əlaqə və ünvan
            </h3>

            <div className="space-y-3 text-xs">
              
              <div className="flex items-start gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
                <Phone className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block font-medium">Əlaqə nömrəmiz (zəng):</span>
                  <a
                    href={`tel:${PHONE_NUMBER.replace(/\s+/g, '')}`}
                    className="text-white font-bold hover:text-blue-400 text-sm transition-colors"
                  >
                    {PHONE_NUMBER}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-slate-400 block font-medium">Salonumuzun ünvanı:</span>
                  <span className="text-white font-medium">{SHOWROOM_ADDRESS}</span>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={copyAddress}
                      className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-bold bg-blue-950/60 px-2 py-1 rounded border border-blue-800/50"
                    >
                      {copied ? <Check className="w-3 h-3 text-blue-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Kopyalandı!' : 'Ünvanı kopyala'}</span>
                    </button>

                    <a
                      href={SHOWROOM_MAP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-bold bg-blue-950/60 px-2 py-1 rounded border border-blue-800/50"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Xəritədə bax</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
                <Clock className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block font-medium">İş saatlarımız:</span>
                  <span className="text-slate-200 font-semibold">{WORKING_HOURS}</span>
                </div>
              </div>

            </div>
          </div>

          {/* Google Maps Embed & Location Column */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Google Maps konumu</span>
              </h3>
              <a
                href={SHOWROOM_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
              >
                <span>Böyüt</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Interactive Google Map Box */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 aspect-[16/10] sm:aspect-[16/9] shadow-lg group">
              <iframe
                title="Kosalar Auto Google Maps Konumu" //40.382921, 49.977866
                src="https://maps.google.com/maps?q=40.382921,49.977866&hl=az&z=15&output=embed"
                className="w-full h-full border-0 grayscale-[20%] contrast-[110%] group-hover:grayscale-0 transition-all duration-300"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              
              {/* Overlay Location Button */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5">
                <a
                  href={SHOWROOM_MAP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-slate-950/95 hover:bg-blue-600 text-white font-bold text-xs py-2 px-3 rounded-xl border border-slate-700/80 hover:border-blue-500 transition-colors flex items-center justify-center gap-2 shadow-xl"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  <span>Salonun konumunu aç (Google Maps)</span>
                </a>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              📍 Bakı, Yeni Günəşli qəsəbəsi, Fatimeyi-Zəhra məscidinin yanı
            </p>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Kosalar Auto. Bütün hüquqlar qorunur.</p>
          <p className="text-[11px]">Kosalar Auto - Keyfiyyətli və zəmanətli Ford Transit satışı</p>
        </div>

      </div>
    </footer>
  );
};
