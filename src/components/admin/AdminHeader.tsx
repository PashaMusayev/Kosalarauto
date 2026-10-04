import React from 'react';
import { 
  ShieldCheck, 
  Settings, 
  Database, 
  RefreshCw, 
  X,
  Images,
  FolderSync
} from 'lucide-react';
import { ConnectionStatusState } from './adminTypes';
import { STORAGE_BUCKET_NAME } from '../../services/supabaseClientInit';

interface AdminHeaderProps {
  isAuthenticated: boolean;
  connStatus: ConnectionStatusState;
  isTestingConn: boolean;
  showSettingsDropdown: boolean;
  setShowSettingsDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenSettingsModal: () => void;
  onOpenRlsModal: () => void;
  onOpenThumbnailModal?: () => void;
  onOpenStorageManagerModal?: () => void;
  onRunConnectionTest: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  isAuthenticated,
  connStatus,
  isTestingConn,
  showSettingsDropdown,
  setShowSettingsDropdown,
  onOpenSettingsModal,
  onOpenRlsModal,
  onOpenThumbnailModal,
  onOpenStorageManagerModal,
  onRunConnectionTest,
  onLogout,
  onClose
}) => {
  const handleLogoutClick = () => {
    if (window.confirm("Sessiyadan çıxmaq istədiyinizə əminsiniz?")) {
      onLogout();
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 shrink-0 z-10 shadow-lg">
      {!isAuthenticated ? (
        /* Unauthenticated (Login) Header: No Supabase data or settings */
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black text-white tracking-tight">KOSALAR AUTO</span>
              <span className="text-xs text-slate-400 block sm:inline-block sm:ml-2.5 font-medium">İdarəetmə paneli girişi</span>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700 text-xs font-bold"
            title="Sayta qayıt"
          >
            <X className="w-4 h-4" />
            <span>Sayta qayıt</span>
          </button>
        </div>
      ) : (
        <>
          {/* Mobile view (2 rows) */}
          <div className="px-3 sm:px-6 py-2.5 flex flex-col gap-2.5 sm:hidden">
            {/* 1-ci sətir: Kosalar Auto logosu və sağda Çıxış / Sayta qayıt düyməsi */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className="text-sm font-black text-white tracking-tight">KOSALAR AUTO</span>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={handleLogoutClick}
                  className="text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/20 px-2.5 py-1.5 rounded-lg transition-colors"
                  title="Admin sessiyasından çıxış"
                >
                  Çıxış
                </button>
                <button 
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all active:scale-95"
                  title="Paneli bağla və sayta qayıt"
                >
                  <X className="w-4 h-4" />
                  <span>Bağla</span>
                </button>
              </div>
            </div>

            {/* 2-ci sətir: Admin idarəetmə yazısı və düymələr */}
            <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800/70">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-xs font-black text-blue-400 tracking-tight truncate">
                  Admin idarəetmə
                </h2>
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  connStatus.dbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}></span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onOpenSettingsModal}
                  className="text-[11px] font-bold bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 px-2 py-1 rounded-lg border border-blue-700/50 flex items-center gap-1 transition-colors"
                  title="Supabase URL və Anon Key ayarları"
                >
                  <Database className="w-3 h-3 text-blue-400" />
                  <span>Ayarlar</span>
                </button>
                <button
                  type="button"
                  onClick={onRunConnectionTest}
                  disabled={isTestingConn}
                  className="text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
                  title="Supabase əlaqəsini yoxla"
                >
                  <RefreshCw className={`w-3 h-3 ${isTestingConn ? 'animate-spin text-blue-400' : ''}`} />
                  <span>Yoxla</span>
                </button>
              </div>
            </div>
          </div>

          {/* Desktop & Tablet view */}
          <div className="hidden sm:flex sm:items-center sm:justify-between px-4 sm:px-6 lg:px-8 py-3.5 gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base md:text-lg font-black text-white tracking-tight">KOSALAR AUTO — İdarəetmə paneli</h2>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                    connStatus.dbConnected && connStatus.storageConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : connStatus.tested
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      connStatus.dbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                    }`}></span>
                    <span>Supabase: {connStatus.dbConnected ? 'Aktiv' : 'Xəta var'}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate hidden md:block">
                  Bucket: <strong className="text-blue-400">{STORAGE_BUCKET_NAME}</strong> • Baza: <strong className="text-blue-400">cars</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 sm:gap-2.5 shrink-0">
              {/* Tənzimləmələr Dropdown Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSettingsDropdown(prev => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 transition-all font-bold shadow-sm"
                  title="Sistem və Supabase tənzimləmələri"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Tənzimləmələr</span>
                </button>

                {showSettingsDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowSettingsDropdown(false)} 
                    />
                    <div className="absolute right-0 mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        Sistem & Supabase
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          onOpenSettingsModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Database className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-bold">Supabase ayarları</div>
                          <div className="text-[10px] text-slate-400">URL və Anon Key dəyiş</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          onOpenRlsModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="font-bold">RLS təhlükəsizlik</div>
                          <div className="text-[10px] text-slate-400">Baza təhlükəsizlik SQL-i</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          onOpenThumbnailModal?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Images className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <div className="font-bold">Miniatürlər (Thumbnails)</div>
                          <div className="text-[10px] text-slate-400">Kiçik şəkilləri hazırla / yenilə</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          onOpenStorageManagerModal?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <FolderSync className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-bold">Storage Qovluqları & Təmizləmə</div>
                          <div className="text-[10px] text-slate-400">cars/&#123;carId&#125;/ köçürməsi və artıq fayllar</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          onRunConnectionTest();
                        }}
                        disabled={isTestingConn}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-slate-800 transition-colors border-t border-slate-800"
                      >
                        <RefreshCw className={`w-4 h-4 text-emerald-400 shrink-0 ${isTestingConn ? 'animate-spin' : ''}`} />
                        <div>
                          <div className="font-bold">Bağlantını yoxla</div>
                          <div className="text-[10px] text-slate-400">Baza və Storage testi</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button 
                type="button"
                onClick={handleLogoutClick}
                className="text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/20 px-3 py-2 rounded-xl transition-colors mr-1"
                title="Admin sessiyasından çıxış"
              >
                Çıxış
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow-blue-500/20 transition-all text-xs font-bold active:scale-95"
                title="Paneli bağla və sayta qayıt"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Bağla</span>
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
};
