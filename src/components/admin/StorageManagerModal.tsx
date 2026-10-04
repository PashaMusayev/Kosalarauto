import React, { useState, useEffect } from 'react';
import { 
  FolderSync, 
  Trash2, 
  X, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  FolderCheck,
  ShieldCheck,
  Clock,
  HardDrive
} from 'lucide-react';
import { TransitCar } from '../../types';
import { 
  runStorageMigration, 
  runStorageCleanup, 
  StorageMigrationResult, 
  StorageCleanupResult 
} from '../../services/imageStorageService';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cars: TransitCar[];
  onCarsUpdated?: (updatedCars: TransitCar[]) => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({
  isOpen,
  onClose,
  cars,
  onCarsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'migrate' | 'cleanup'>('migrate');

  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationPlan, setMigrationPlan] = useState<StorageMigrationResult | null>(null);
  const [migrationResult, setMigrationResult] = useState<StorageMigrationResult | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number; message: string }>({
    current: 0,
    total: 0,
    message: ''
  });

  // Cleanup State
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupPlan, setCleanupPlan] = useState<StorageCleanupResult | null>(null);
  const [cleanupResult, setCleanupResult] = useState<StorageCleanupResult | null>(null);

  // Compute local quick estimate
  const organizedCarsCount = React.useMemo(() => {
    return cars.filter(c => {
      const imgs = [c.primaryImage, ...(Array.isArray(c.images) ? c.images : [])].filter(Boolean);
      if (imgs.length === 0) return true;
      return imgs.every(u => u.includes(`/cars/${c.id}/`));
    }).length;
  }, [cars]);

  const unorganizedCarsCount = cars.length - organizedCarsCount;

  // Run Migration Dry Run
  const handleCheckMigrationPlan = async () => {
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const res = await runStorageMigration(true);
      setMigrationPlan(res);
      if (!res.success && res.error) {
        alert(`Xəta: ${res.error}`);
      }
    } catch (e: unknown) {
      alert(`Xəta: ${e instanceof Error ? e.message : 'Plan hazırlana bilmədi'}`);
    } finally {
      setIsMigrating(false);
    }
  };

  // Run Real Migration
  const handleStartRealMigration = async () => {
    if (!window.confirm("Bütün avtomobil şəkillərini cars/{carId}/ qovluqlarına köçürmək istədiyinizə əminsiniz?\n\nOrijinal fayllar silinmir və 24 saat qorunur.")) {
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    // If we have a planned cars list, migrate car by car for real-time progress
    const targets = migrationPlan?.plannedCars && migrationPlan.plannedCars.length > 0
      ? migrationPlan.plannedCars
      : cars.filter(c => {
          const imgs = [c.primaryImage, ...(Array.isArray(c.images) ? c.images : [])].filter(Boolean);
          return imgs.some(u => !u.includes(`/cars/${c.id}/`));
        }).map(c => ({ carId: c.id, carTitle: c.title || c.id, files: [], alreadyMigrated: false }));

    const total = targets.length;
    let totalMigrated = 0;
    let totalFilesCopied = 0;
    const allFailures: { carId: string; error: string }[] = [];
    let latestCars: TransitCar[] = cars;

    setMigrationProgress({ current: 0, total, message: 'Köçürmə prosesi başladılır...' });

    for (let i = 0; i < total; i++) {
      const target = targets[i];
      setMigrationProgress({
        current: i + 1,
        total,
        message: `Köçürülür: ${i + 1} / ${total} (${target.carTitle})...`
      });

      try {
        const res = await runStorageMigration(false, target.carId);
        if (res.success) {
          totalMigrated += res.carsMigrated || 0;
          totalFilesCopied += res.filesCopied || 0;
          if (res.failures && res.failures.length > 0) {
            allFailures.push(...res.failures);
          }
          if (res.cars && Array.isArray(res.cars)) {
            latestCars = res.cars as TransitCar[];
          }
        } else {
          allFailures.push({ carId: target.carId, error: res.error || 'Naməlum xəta' });
        }
      } catch (err: unknown) {
        allFailures.push({
          carId: target.carId,
          error: err instanceof Error ? err.message : 'Xəta'
        });
      }
    }

    const finalRes: StorageMigrationResult = {
      success: allFailures.length === 0,
      dryRun: false,
      carsMigrated: totalMigrated,
      filesCopied: totalFilesCopied,
      failures: allFailures,
      totalCarsPlanned: total
    };

    setMigrationResult(finalRes);
    setMigrationPlan(null);
    setIsMigrating(false);

    if (onCarsUpdated && latestCars.length > 0) {
      onCarsUpdated(latestCars);
    }
  };

  // Run Cleanup Dry Run
  const handleCheckCleanupPlan = async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    try {
      const res = await runStorageCleanup(true);
      setCleanupPlan(res);
      if (!res.success && res.error) {
        alert(`Xəta: ${res.error}`);
      }
    } catch (e: unknown) {
      alert(`Xəta: ${e instanceof Error ? e.message : 'Təmizləmə planı hazırlana bilmədi'}`);
    } finally {
      setIsCleaning(false);
    }
  };

  // Run Real Cleanup
  const handleStartRealCleanup = async () => {
    const count = cleanupPlan?.unreferencedCount || 0;
    if (count <= 0) {
      alert("Silinməsi tələb olunan artıq fayl tapılmadı.");
      return;
    }

    if (!window.confirm(`${count} fayl silinəcək, əminsiniz?`)) {
      return;
    }

    setIsCleaning(true);
    try {
      const res = await runStorageCleanup(false);
      setCleanupResult(res);
      setCleanupPlan(null);
      if (res.success) {
        alert(res.message || `${res.deletedCount || 0} ədəd fayl silindi.`);
      } else {
        alert(`Silinmə xətası: ${res.error || 'Xəta baş verdi'}`);
      }
    } catch (e: unknown) {
      alert(`Xəta: ${e instanceof Error ? e.message : 'Fayllar silinə bilmədi'}`);
    } finally {
      setIsCleaning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                Storage Qovluqları & Təmizləmə
              </h2>
              <p className="text-xs text-slate-400">
                Supabase Storage fayllarını hər maşın üçün ayrıca qovluqda təşkil edin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
            title="Bağla"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('migrate')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'migrate'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderCheck className="w-4 h-4" />
            <span>Qovluq Köçürməsi (Migrasiya)</span>
            {unorganizedCarsCount > 0 && (
              <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">
                {unorganizedCarsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cleanup')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'cleanup'
                ? 'border-rose-500 text-rose-400 bg-rose-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Artıq Faylları Təmizləmə</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {activeTab === 'migrate' ? (
            /* TAB 1: MIGRATION */
            <div className="space-y-5">
              {/* Architecture info box */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Qovluq Arxitekturası: cars/&#123;carId&#125;/...</span>
                </div>
                <p>
                  Bütün şəkillər və onların miniatürləri (<code>__thumb.webp</code>) birbaşa aid olduqları avtomobilin qovluğunda yerləşdirilir.
                  Köçürmə <strong>təhlükəsiz rejimdə</strong> (copy-before-delete) işləyir: ilkin fayllar silinmir, 24 saatlıq qorunma müddətinə alınır və saytın işində fasilə yaranmır.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/40">
                    <span className="text-[11px] text-slate-400 block">Ümumi Avtomobil</span>
                    <strong className="text-white text-sm">{cars.length}</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/40">
                    <span className="text-[11px] text-emerald-400 block">Artıq Qovluqda</span>
                    <strong className="text-emerald-300 text-sm">{organizedCarsCount}</strong>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/40 col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-amber-400 block">Köçürülməli</span>
                    <strong className="text-amber-300 text-sm">{unorganizedCarsCount}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCheckMigrationPlan}
                  disabled={isMigrating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-600 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin text-blue-400' : ''}`} />
                  <span>Planı Yoxla (Dry Run)</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartRealMigration}
                  disabled={isMigrating || unorganizedCarsCount === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Köçürməni Başlat</span>
                </button>
              </div>

              {/* Progress Bar during real migration */}
              {isMigrating && migrationProgress.total > 0 && (
                <div className="bg-slate-800/80 border border-blue-500/40 rounded-xl p-4 space-y-2.5 animate-pulse">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-blue-300">{migrationProgress.message}</span>
                    <span className="text-white">
                      {Math.round((migrationProgress.current / migrationProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${(migrationProgress.current / migrationProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Dry Run Plan Result */}
              {migrationPlan && migrationPlan.dryRun && (
                <div className="bg-slate-950/70 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <strong className="text-white text-xs">Yoxlanış Nəticəsi (Dry Run):</strong>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      Köçürüləcək fayl: {migrationPlan.totalFiles || 0} ədəd ({( (migrationPlan.totalSizeBytes || 0) / (1024 * 1024) ).toFixed(2)} MB)
                    </span>
                  </div>

                  {migrationPlan.plannedCars && migrationPlan.plannedCars.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
                      {migrationPlan.plannedCars.map(car => (
                        <div key={car.carId} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="flex items-center justify-between font-bold text-slate-200">
                            <span>{car.carTitle}</span>
                            <span className="text-[10px] text-blue-400">{car.files.length} fayl</span>
                          </div>
                          <div className="mt-1 space-y-1 text-[11px] text-slate-400 font-mono">
                            {car.files.slice(0, 3).map((f, idx) => (
                              <div key={idx} className="truncate">
                                {f.oldPath} &rarr; <span className="text-emerald-400">{f.newPath}</span>
                              </div>
                            ))}
                            {car.files.length > 3 && (
                              <div className="text-[10px] text-slate-500">
                                ... və daha {car.files.length - 3} fayl
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-400">
                      Əla! Bütün avtomobillərin şəkilləri artıq qovluq strukturu üzrə düzgün təşkil olunub.
                    </p>
                  )}
                </div>
              )}

              {/* Real Migration Final Report */}
              {migrationResult && (
                <div className={`p-4 rounded-xl border space-y-2 text-xs ${
                  migrationResult.failures && migrationResult.failures.length > 0
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Köçürmə yekunlaşdı!</span>
                  </div>
                  <p>
                    Uğurla köçürülən avtomobil: <strong>{migrationResult.carsMigrated}</strong> | 
                    Köçürülən fayllar: <strong>{migrationResult.filesCopied}</strong>
                  </p>
                  {migrationResult.failures && migrationResult.failures.length > 0 && (
                    <div className="text-rose-300 mt-2 space-y-1">
                      <strong>Xətalar ({migrationResult.failures.length}):</strong>
                      {migrationResult.failures.map((f, i) => (
                        <div key={i}>• Avtomobil {f.carId}: {f.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: CLEANUP */
            <div className="space-y-5">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>24 Saatlıq Təhlükəsizlik Gözləmə Müddəti</span>
                </div>
                <p>
                  Heç bir elana aid olmayan (orfan) və ya qovluqlara köçürüldükdən sonra qalan köhnə fayllar bu bölmədən təmizlənir.
                  Təhlükəsizlik üçün:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                  <li>Avtomobillərdə aktiv istifadə olunan heç bir şəkil <strong>əsla silinmir</strong>.</li>
                  <li>Son 24 saat ərzində yüklənmiş və ya köçürülmüş fayllar <strong>qorunur</strong> (yüklənməsi davam edən şəkillər və keşdə qalan köhnə linklər üçün).</li>
                  <li>Köçürülən orijinal faylları silmək üçün köçürmədən 24 saat sonra bu təmizləməni işə salın.</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCheckCleanupPlan}
                  disabled={isCleaning}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-600 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin text-rose-400' : ''}`} />
                  <span>Artıq Faylları Yoxla (Dry Run)</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartRealCleanup}
                  disabled={isCleaning || !cleanupPlan || (cleanupPlan.unreferencedCount || 0) === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50 active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Təmizləməni İcra Et ({cleanupPlan?.unreferencedCount || 0} fayl)</span>
                </button>
              </div>

              {/* Cleanup Dry Run Results */}
              {cleanupPlan && cleanupPlan.dryRun && (
                <div className="bg-slate-950/70 border border-slate-700 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <strong className="text-white">Təmizləmə Təhlili (Dry Run):</strong>
                    <span className="text-[11px] text-slate-400">
                      Qorunan fayllar: {cleanupPlan.protectedRecentCount || 0} (son 24 saat)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Silinəcək Artıq Fayllar</span>
                      <strong className="text-rose-400 text-base">{cleanupPlan.unreferencedCount || 0} ədəd</strong>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Boşaldılacaq Həcm</span>
                      <strong className="text-emerald-400 text-base">
                        {((cleanupPlan.totalSizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB
                      </strong>
                    </div>
                  </div>

                  {cleanupPlan.sample && cleanupPlan.sample.length > 0 && (
                    <div className="space-y-1 text-[11px]">
                      <span className="font-bold text-slate-300 block">Nümunə silinəcək fayllar:</span>
                      <div className="max-h-36 overflow-y-auto bg-slate-900/90 p-2 rounded border border-slate-800 font-mono text-[10px] text-slate-400 space-y-0.5">
                        {cleanupPlan.sample.map((s, idx) => (
                          <div key={idx} className="truncate">• {s}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(cleanupPlan.unreferencedCount || 0) === 0 && (
                    <p className="text-emerald-400 text-xs">
                      Hal-hazırda silinəcək heç bir artıq fayl yoxdur. Əgər yenicə köçürmə etmisinizsə, köhnə fayllar 24 saatlıq qorunma müddətindən sonra burada göstəriləcək.
                    </p>
                  )}
                </div>
              )}

              {/* Cleanup Final Result */}
              {cleanupResult && (
                <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl space-y-1 text-xs text-emerald-200">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Təmizləmə uğurla tamamlandı!</span>
                  </div>
                  <p>{cleanupResult.message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" />
            <span>Supabase Storage Anbarı</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition-colors"
          >
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
};
