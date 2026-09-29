import React, { useState, useEffect, useCallback } from 'react';
import { 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { TransitCar } from '../types';
import { DEFAULT_VEHICLE_PLACEHOLDER } from '../utils/imageFallback';
import { useBodyScrollLock } from '../utils/scrollLock';
import { compressImage, createThumbnail } from '../utils/imageCompressor';
import { 
  uploadImageToSupabaseStorage, 
  deleteImagesFromSupabaseStorage,
  isSupabaseStorageUrl, 
  downloadExternalImageAsBlob,
  uploadThumbnailForImage 
} from '../services/imageStorageService';
import { 
  upsertCarToSupabase, 
  deleteCarFromSupabase, 
  updateCarStatusInSupabase 
} from '../services/adminCarService';
import { fetchAnalyticsFromSupabase } from '../services/analyticsService';
import { 
  getActiveSupabaseConfig, 
  fetchServerSupabaseConfig,
  STORAGE_BUCKET_NAME 
} from '../services/supabaseClientInit';
import { getAdminAuthHeaders } from '../services/adminAuthService';

// Modular Admin sub-components & hooks
import { 
  FormImageItem, 
  SaveProgressState, 
  DEFAULT_STANDARD_FEATURES,
  normalizeEngineValue,
  normalizeWheelDriveValue
} from './admin/adminTypes';
import { AdminHeader } from './admin/AdminHeader';
import { AdminLoginForm } from './admin/AdminLoginForm';
import { DashboardKpiCards } from './admin/DashboardKpiCards';
import { CarListToolbar } from './admin/CarListToolbar';
import { CarList } from './admin/CarList';
import { CarFormModal } from './admin/CarFormModal';
import { SupabaseSettingsModal, RlsModal } from './admin/AdminModals';
import { ThumbnailBackfillModal } from './admin/ThumbnailBackfillModal';
import { useAdminAuth } from './admin/useAdminAuth';
import { useCarImages } from './admin/useCarImages';
import { useSupabaseSettings } from './admin/useSupabaseSettings';
import { CanonicalBadge, mapLegacyBadges } from '../data/badges';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  cars: TransitCar[];
  onCarsUpdated: (cars: TransitCar[]) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  cars,
  onCarsUpdated
}) => {
  useBodyScrollLock(isOpen);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Auth Hook
  const { isAuthenticated, setIsAuthenticated, handleLogout } = useAdminAuth(isOpen, showToast);

  const [showThumbnailModal, setShowThumbnailModal] = useState(false);

  // Supabase Settings Hook
  const {
    isTestingConn,
    showSupabaseSettingsModal,
    setShowSupabaseSettingsModal,
    showRlsModal,
    setShowRlsModal,
    copiedRls,
    supabaseUrlInput,
    setSupabaseUrlInput,
    supabaseAnonKeyInput,
    setSupabaseAnonKeyInput,
    showAnonKeyText,
    setShowAnonKeyText,
    isSavingConfig,
    showSettingsDropdown,
    setShowSettingsDropdown,
    connStatus,
    runConnectionTest,
    handleSaveSupabaseConfig,
    handleResetSupabaseConfig,
    handleCopyRls
  } = useSupabaseSettings(showToast);

  // Sync Supabase credentials inputs whenever modal or settings open
  useEffect(() => {
    if (isOpen || showSupabaseSettingsModal) {
      const cfg = getActiveSupabaseConfig();
      if (cfg.url) setSupabaseUrlInput(cfg.url);
      if (cfg.anonKey) setSupabaseAnonKeyInput(cfg.anonKey);
      if (!cfg.url || !cfg.anonKey) {
        fetchServerSupabaseConfig().then(srv => {
          if (srv) {
            if (srv.url) setSupabaseUrlInput(srv.url);
            if (srv.anonKey) setSupabaseAnonKeyInput(srv.anonKey);
          }
        });
      }
    }
  }, [isOpen, showSupabaseSettingsModal, setSupabaseUrlInput, setSupabaseAnonKeyInput]);

  // Initial connection test on open
  useEffect(() => {
    if (isOpen) {
      runConnectionTest();
    }
  }, [isOpen, runConnectionTest]);

  // Cars list state
  const [carsList, setCarsList] = useState<TransitCar[]>(() => Array.isArray(cars) ? cars : []);
  useEffect(() => {
    setCarsList(Array.isArray(cars) ? cars : []);
  }, [cars]);

  // Status toggle & Analytics state
  const [updatingStatusCarId, setUpdatingStatusCarId] = useState<string | null>(null);
  const [whatsappClicks, setWhatsappClicks] = useState<number>(0);
  const [isFetchingClicks, setIsFetchingClicks] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'active' | 'sold'>('all');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminViewMode, setAdminViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'table';
  });
  const [deletingCarId, setDeletingCarId] = useState<string | null>(null);

  // Real-time WhatsApp clicks sync
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ count?: number }>;
      if (customEvent?.detail?.count !== undefined) {
        setWhatsappClicks(customEvent.detail.count);
      } else {
        setWhatsappClicks(prev => prev + 1);
      }
    };
    window.addEventListener('whatsappClickRecorded', handler);
    return () => window.removeEventListener('whatsappClickRecorded', handler);
  }, []);

  const loadAnalytics = useCallback(async () => {
    setIsFetchingClicks(true);
    try {
      const res = await fetchAnalyticsFromSupabase();
      if (typeof res?.whatsappClicks === 'number') {
        setWhatsappClicks(res.whatsappClicks);
      }
    } catch (e) {
      console.warn('Analytics fetch error:', e);
    } finally {
      setIsFetchingClicks(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen, loadAnalytics]);

  // Toggle car status (active / sold)
  const handleToggleStatus = async (car: TransitCar) => {
    const nextStatus: 'active' | 'sold' = car.status === 'sold' ? 'active' : 'sold';
    setUpdatingStatusCarId(car.id);
    try {
      const res = await updateCarStatusInSupabase(car.id, nextStatus);
      if (!res.success) {
        const errorMsg = res.error || 'Status yenilənmədi';
        showToast(`Xəta: ${errorMsg}`);
        alert(`Status Xətası:\n\n${errorMsg}`);
        return;
      }

      const updated = res.cars && Array.isArray(res.cars)
        ? res.cars
        : carsList.map(c => c.id === car.id ? { ...c, status: nextStatus } : c);
      setCarsList(updated);
      onCarsUpdated(updated);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosalar-cars-updated', { detail: { cars: updated } }));
      }

      showToast(
        nextStatus === 'sold'
          ? `"${car.title}" SATILDI kimi qeyd edildi (Əsas saytdan gizlədildi).`
          : `"${car.title}" SATIŞDA kimi aktiv edildi (Əsas saytda göstərilir).`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status yenilənmədi';
      alert(`Xəta: ${msg}`);
    } finally {
      setUpdatingStatusCarId(null);
    }
  };

  // Car Edit / Add Form State
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState<SaveProgressState>({
    step: 'idle',
    current: 0,
    total: 0,
    percentage: 0,
    message: ''
  });
  const [activeModalTab, setActiveModalTab] = useState<'basics' | 'features' | 'media'>('basics');

  // Form fields
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [year, setYear] = useState<number | ''>('');
  const [mileage, setMileage] = useState<number | ''>('');
  const [bodyType, setBodyType] = useState<string>('');
  const [color, setColor] = useState('');
  const [engine, setEngine] = useState('');
  const [hp, setHp] = useState<number | ''>('');
  const [fuelType, setFuelType] = useState('');
  const [transmission, setTransmission] = useState('');
  const [wheelDrive, setWheelDrive] = useState<string>('');
  const [baseLength, setBaseLength] = useState<string>('');
  const [roofHeight, setRoofHeight] = useState<string>('');
  const [seatCount, setSeatCount] = useState<string>('');
  const [condition, setCondition] = useState('');
  const [description, setDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [carStatus, setCarStatus] = useState<'active' | 'sold'>('active');
  const [selectedStatusBadges, setSelectedStatusBadges] = useState<CanonicalBadge[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [customFeatureInput, setCustomFeatureInput] = useState('');

  // Images Hook
  const {
    imagesList,
    setImagesList,
    primaryImage,
    setPrimaryImage,
    newImageUrl,
    setNewImageUrl,
    isAddingFromUrl,
    draggedImgIndex,
    setDraggedImgIndex,
    dragOverImgIndex,
    setDragOverImgIndex,
    cleanupBlobUrls,
    moveImage,
    moveImageLeft,
    moveImageRight,
    setAsPrimaryImage,
    removeImageAt,
    handleAddImageUrl,
    handleFileUpload
  } = useCarImages(showToast);

  const toggleStatusBadgeInForm = (badge: CanonicalBadge) => {
    setSelectedStatusBadges(prev => 
      prev.includes(badge) ? prev.filter(b => b !== badge) : [...prev, badge]
    );
  };

  const toggleFeatureInForm = (feat: string) => {
    setSelectedFeatures(prev => 
      prev.includes(feat) ? prev.filter(f => f !== feat) : [...prev, feat]
    );
  };

  const selectAllFeatures = () => {
    setSelectedFeatures([...DEFAULT_STANDARD_FEATURES]);
  };

  const clearAllFeatures = () => {
    setSelectedFeatures([]);
  };

  const addCustomFeature = () => {
    const trimmed = customFeatureInput.trim();
    if (trimmed && !selectedFeatures.includes(trimmed)) {
      setSelectedFeatures(prev => [...prev, trimmed]);
      setCustomFeatureInput('');
    }
  };

  const openAddCar = () => {
    cleanupBlobUrls(imagesList);
    setEditingCarId(null);
    setSaveError(null);
    setTitle('');
    setBrand('');
    setModel('');
    setCity('');
    setPrice('');
    setYear('');
    setMileage('');
    setBodyType('');
    setColor('');
    setEngine('');
    setHp('');
    setFuelType('');
    setTransmission('');
    setWheelDrive('');
    setBaseLength('');
    setRoofHeight('');
    setSeatCount('');
    setCondition('');
    setDescription('');
    setIsFeatured(false);
    setCarStatus('active');
    setSelectedStatusBadges([]);
    setSelectedFeatures([]);
    setImagesList([]);
    setPrimaryImage('');
    setNewImageUrl('');
    setActiveModalTab('basics');
    setIsEditingModalOpen(true);
  };

  const openEditCar = (car: TransitCar) => {
    cleanupBlobUrls(imagesList);
    setEditingCarId(car.id);
    setSaveError(null);
    setTitle(car.title || '');
    const rawB = (car.brand || car.make || '').trim();
    const finalBrand = rawB.toLowerCase().includes('mercedes') || (car.title && car.title.toLowerCase().includes('mercedes')) 
      ? 'Mercedes' 
      : (rawB.toLowerCase().includes('ford') || (car.title && car.title.toLowerCase().includes('transit')) ? 'Ford' : rawB);
    setBrand(finalBrand);
    setModel(car.model || '');
    setCity(car.city || car.location || '');
    setPrice(typeof car.price === 'number' ? car.price : (car.price ? Number(car.price) : ''));
    setYear(typeof car.year === 'number' ? car.year : (car.year ? Number(car.year) : ''));
    setMileage(typeof car.mileage === 'number' ? car.mileage : (car.mileage ? Number(car.mileage) : ''));
    setBodyType(car.bodyType || '');
    setColor(car.color || '');
    setEngine(normalizeEngineValue(car.engine || ''));
    const rawCarHp = typeof car.hp === 'number' 
      ? car.hp 
      : (car.hp !== undefined && car.hp !== null && String(car.hp).trim() !== '' 
          ? Number(car.hp) 
          : (typeof car.specs?.hp === 'number' 
              ? (car.specs.hp as number) 
              : (typeof car.specs?.horsePower === 'number' ? (car.specs.horsePower as number) : undefined)));
    setHp(rawCarHp !== undefined && !isNaN(rawCarHp) && rawCarHp > 0 ? rawCarHp : '');
    setFuelType(car.fuelType || '');
    setTransmission(car.transmission || '');
    setWheelDrive(normalizeWheelDriveValue(car.wheelDrive || ''));
    setBaseLength(car.baseLength || '');
    setRoofHeight(car.roofHeight || '');
    setSeatCount(car.seatCount || '');
    setCondition(car.condition || '');
    setDescription(car.description || '');
    setIsFeatured(!!car.isFeatured);
    setCarStatus(car.status === 'sold' ? 'sold' : 'active');
    setSelectedStatusBadges(mapLegacyBadges(car.statusBadges ?? car.badges));
    setSelectedFeatures(Array.isArray(car.features) ? [...car.features] : []);
    
    const imgs = Array.isArray(car.images) && car.images.length > 0 ? [...car.images] : (car.primaryImage ? [car.primaryImage] : []);
    const formatted: FormImageItem[] = imgs.filter(Boolean).map((u, i) => ({
      id: `existing-${i}-${Date.now()}`,
      url: u,
      isBlob: false
    }));
    
    setImagesList(formatted);
    setPrimaryImage(formatted[0]?.url || '');
    setNewImageUrl('');
    setActiveModalTab('basics');
    setIsEditingModalOpen(true);
  };

  const handleCloseEditingModal = () => {
    cleanupBlobUrls(imagesList);
    setIsEditingModalOpen(false);
  };

  // Save Car
  const handleSaveCar = async (e: React.FormEvent) => {
    e.preventDefault();

    // Helper to switch to the tab containing the invalid field, focus it, and alert message
    const failValidation = (tab: 'basics' | 'features' | 'media', elementId: string, message: string) => {
      setActiveModalTab(tab);
      setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          el.focus();
        }
      }, 50);
      alert(message);
    };

    // 1. Marka check
    if (!brand.trim()) {
      failValidation('basics', 'car-form-brand', 'Zəhmət olmasa avtomobilin markasını seçin.');
      return;
    }

    // 2. Model check
    if (!model.trim()) {
      failValidation('basics', 'car-form-model', 'Zəhmət olmasa avtomobilin modelini daxil edin.');
      return;
    }

    // 3. Qiymət check (must be a positive number > 0)
    if (price === '' || price === null || price === undefined || isNaN(Number(price)) || Number(price) <= 0) {
      failValidation('basics', 'car-form-price', 'Zəhmət olmasa düzgün qiymət daxil edin (qiymət 0-dan böyük olmalıdır).');
      return;
    }

    // 4. Yürüş check (must be >= 0; 0 is valid for a new vehicle)
    if (mileage === '' || mileage === null || mileage === undefined || isNaN(Number(mileage)) || Number(mileage) < 0) {
      failValidation('basics', 'car-form-mileage', 'Zəhmət olmasa düzgün yürüş daxil edin (yürüş mənfi ola bilməz).');
      return;
    }

    // 5. At gücü (HP) check (optional: blank allowed, but if entered must be > 0 and <= 2000)
    if (hp !== '' && hp !== null && hp !== undefined) {
      const numHp = Number(hp);
      if (isNaN(numHp) || numHp <= 0) {
        failValidation('basics', 'car-form-hp', 'At gücü müsbət ədəd olmalıdır (məsələn: 155).');
        return;
      }
      if (numHp > 2000) {
        failValidation('basics', 'car-form-hp', 'At gücü 2000 a.g.-dən çox ola bilməz.');
        return;
      }
    }

    const carTitle = `${brand} ${model}`.trim() || title.trim() || `${brand || 'Avtomobil'}`;

    // Phase 56: Stop BEFORE any upload if there are failed/unreadable images
    const failedItems = imagesList.filter(item => Boolean(item.error));
    if (failedItems.length > 0) {
      const failedNames = failedItems.map((item) => {
        const name = item.fileName || item.file?.name || `Şəkil #${imagesList.indexOf(item) + 1}`;
        return `${name} (${item.error})`;
      }).join('\n• ');
      const errMsg = `Yadda saxlamazdan əvvəl xətalı şəkilləri silin və ya yenidən seçin:\n• ${failedNames}`;
      setIsSaving(false);
      setSaveError(errMsg);
      alert(errMsg);
      return;
    }

    // Check if any images are still in the process of compressing
    const compressingItems = imagesList.filter(item => item.isCompressing);
    if (compressingItems.length > 0) {
      alert('Şəkillər hələ sıxılma mərhələsindədir, zəhmət olmasa bir neçə saniyə gözləyin.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const pendingBlobItems = imagesList.filter(item => (item.isBlob && item.file && item.isCompressed) || item.url.startsWith('data:'));
    const totalPending = pendingBlobItems.length;

    setSaveProgress({
      step: totalPending > 0 ? 'uploading' : 'saving_db',
      current: 0,
      total: totalPending,
      percentage: totalPending > 0 ? 10 : 50,
      message: totalPending > 0 ? 'Şəkillər yüklənməyə hazırlanır...' : 'Məlumatlar yadda saxlanılır...'
    });

    try {
      // 1. Process deferred upload of pending images to Supabase Storage
      const finalImageUrls: string[] = [];
      let processedIdx = 0;

      for (let i = 0; i < imagesList.length; i++) {
        const item = imagesList[i];
        if (item.isBlob && item.file) {
          // Phase 56: Strictly upload only successfully compressed items (never upload raw uncompressed originals)
          if (!item.isCompressed) {
            throw new Error(`Şəkil sıxılmayıb və ya xətalıdır (${item.fileName || item.file.name}). Zəhmət olmasa xətalı şəkli silin və ya yenidən seçin.`);
          }

          processedIdx++;
          const fileToUpload = item.file;
          const fileNameToUpload = item.fileName || item.file.name;

          // Upload compressed WebP to Supabase Storage
          const uploadPercent = 40 + Math.round((processedIdx / Math.max(1, totalPending)) * 50);
          setSaveProgress({
            step: 'uploading',
            current: processedIdx,
            total: totalPending,
            percentage: Math.min(92, uploadPercent),
            message: `Supabase-ə yüklənir (${processedIdx}/${totalPending}): ${fileNameToUpload}...`
          });

          const uploadRes = await uploadImageToSupabaseStorage(fileToUpload, fileNameToUpload);
          if (!uploadRes.success || !uploadRes.publicUrl) {
            throw new Error(`Şəkil Supabase Storage-ə yüklənə bilmədi (${fileNameToUpload}): ${uploadRes.error || 'Xəta'}`);
          }
          finalImageUrls.push(uploadRes.publicUrl);
          // Upload pre-made thumbnail (single compression!) if available, or fall back to full image
          uploadThumbnailForImage(
            item.thumbBlob || fileToUpload, 
            uploadRes.publicUrl,
            { isPreGeneratedThumb: Boolean(item.thumbBlob) }
          ).catch(tErr => console.warn('Thumb upload notice:', tErr));

          // Revoke temporary blob URL
          try {
            URL.revokeObjectURL(item.url);
          } catch (e) {}
        } else if (item.url.startsWith('data:')) {
          processedIdx++;
          setSaveProgress({
            step: 'uploading',
            current: processedIdx,
            total: totalPending,
            percentage: 40 + Math.round((processedIdx / totalPending) * 50),
            message: `Data şəkil Supabase-ə yüklənir (${processedIdx}/${totalPending})...`
          });
          const upRes = await uploadImageToSupabaseStorage(item.url, `car-${Date.now()}-${Math.random().toString(36).substr(2, 6)}.webp`);
          if (upRes.success && upRes.publicUrl) {
            finalImageUrls.push(upRes.publicUrl);
            uploadThumbnailForImage(item.url, upRes.publicUrl).catch(tErr => console.warn('Thumb upload notice:', tErr));
          } else {
            throw new Error(`Şəkil Supabase Storage-ə yüklənə bilmədi: ${upRes.error || 'Xəta'}`);
          }
        } else if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
          if (isSupabaseStorageUrl(item.url)) {
            finalImageUrls.push(item.url);
          } else {
            processedIdx++;
            setSaveProgress({
              step: 'uploading',
              current: processedIdx,
              total: totalPending || 1,
              percentage: 70,
              message: `Xarici şəkil Supabase Storage ('CAR-IMAGES') anbarına yüklənir...`
            });
            try {
              const { blob, mimeType, extension } = await downloadExternalImageAsBlob(item.url);
              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substring(2, 7);
              const uniqueFileName = `car-${timestamp}-${randomStr}.${extension}`;
              const origFile = new File([blob], uniqueFileName, { type: mimeType });

              let fileToUpload: File = origFile;
              let nameToUpload: string = uniqueFileName;
              try {
                const compRes = await compressImage(origFile, uniqueFileName, { maxWidth: 1200, maxHeight: 1200, quality: 0.78 });
                fileToUpload = compRes.file;
                nameToUpload = compRes.file.name;
              } catch (cErr) {
                console.warn('Image compression fallback notice:', cErr);
              }

              // Derive thumbnail from the downloaded original blob!
              let thumbBlob: Blob | undefined;
              try {
                const thumbRes = await createThumbnail(blob, 'thumb.webp', {
                  maxWidth: 800,
                  maxHeight: 800,
                  quality: 0.80
                });
                thumbBlob = thumbRes.blob;
              } catch (tErr) {
                console.warn('URL thumbnail creation notice:', tErr);
              }

              const upRes = await uploadImageToSupabaseStorage(fileToUpload, nameToUpload);
              if (upRes.success && upRes.publicUrl) {
                finalImageUrls.push(upRes.publicUrl);
                uploadThumbnailForImage(
                  thumbBlob || fileToUpload, 
                  upRes.publicUrl,
                  { isPreGeneratedThumb: Boolean(thumbBlob) }
                ).catch(tErr => console.warn('Thumb upload notice:', tErr));
              } else {
                throw new Error(upRes.error || 'Yüklənmə xətası');
              }
            } catch (err: unknown) {
              console.error('External URL upload during save error:', err);
              throw new Error("Bu linkdən şəkli endirmək mümkün olmadı, zəhmət olmasa şəkli kompyuterinizdən yükləyin");
            }
          }
        } else {
          finalImageUrls.push(item.url);
        }
      }

      setSaveProgress({
        step: 'saving_db',
        current: totalPending,
        total: totalPending,
        percentage: 95,
        message: 'Məlumatlar Supabase bazasına yazılır...'
      });

      // First image in array is ALWAYS the primary cover image
      const currentPrimary = finalImageUrls.length > 0 ? finalImageUrls[0] : DEFAULT_VEHICLE_PLACEHOLDER;

      // If editing existing car, purge any removed Supabase Storage images
      if (editingCarId) {
        const originalCar = carsList.find(c => c.id === editingCarId);
        if (originalCar) {
          const origImgs = [originalCar.primaryImage, ...(Array.isArray(originalCar.images) ? originalCar.images : [])].filter(Boolean);
          const removedStorageImgs = origImgs.filter(oldUrl => !finalImageUrls.includes(oldUrl));
          if (removedStorageImgs.length > 0) {
            deleteImagesFromSupabaseStorage(removedStorageImgs).catch(err => console.warn('Purge removed images warning:', err));
          }
        }
      }

      // Construct car object
      const safeTitle = title.trim() || [brand, model].filter(Boolean).join(' ') || 'Avtomobil';
      const existingCar = editingCarId ? carsList.find(c => c.id === editingCarId) : null;
      const safeVin = existingCar?.vinCode || '';

      const parsedHp = hp !== '' && hp !== null && hp !== undefined && !isNaN(Number(hp)) && Number(hp) > 0
        ? Math.min(2000, Math.round(Number(hp)))
        : undefined;

      const carToSave: TransitCar = {
        id: editingCarId || `car-${Date.now()}`,
        title: safeTitle,
        brand: brand.trim(),
        make: brand.trim(),
        model: model.trim(),
        city: city.trim(),
        location: city.trim(),
        price: Number(price) || 0,
        year: Number(year) || (new Date().getFullYear()),
        mileage: Number(mileage) || 0,
        bodyType,
        color: color.trim(),
        engine: engine.trim(),
        hp: parsedHp,
        fuelType: fuelType.trim(),
        transmission: transmission.trim(),
        wheelDrive: wheelDrive.trim(),
        baseLength,
        roofHeight,
        ...(seatCount.trim() ? { seatCount: seatCount.trim() } : {}),
        condition: condition.trim(),
        vinCode: safeVin,
        primaryImage: currentPrimary,
        images: finalImageUrls.length > 0 ? finalImageUrls : (currentPrimary ? [currentPrimary] : []),
        description: description.trim(),
        features: selectedFeatures,
        statusBadges: selectedStatusBadges,
        badges: selectedStatusBadges,
        isFeatured,
        status: carStatus,
        specs: {
          brand: brand.trim(),
          make: brand.trim(),
          model: model.trim(),
          city: city.trim(),
          location: city.trim(),
          condition: condition.trim(),
          baseLength,
          roofHeight,
          ...(seatCount.trim() ? { seatCount: seatCount.trim() } : {}),
          transmission: transmission.trim(),
          wheelDrive: wheelDrive.trim(),
          engine: engine.trim(),
          hp: parsedHp,
          horsePower: parsedHp,
          color: color.trim(),
          fuelType: fuelType.trim(),
          bodyType,
          year: Number(year) || (new Date().getFullYear()),
          mileage: Number(mileage) || 0,
          price: Number(price) || 0,
          vinCode: safeVin
        }
      };

      // 2. Direct Supabase DB Upsert
      const dbResult = await upsertCarToSupabase(carToSave);
      if (!dbResult.success) {
        throw new Error(dbResult.error || 'Məlumat Supabase bazasına yazıla bilmədi');
      }

      setSaveProgress({
        step: 'done',
        current: totalPending,
        total: totalPending,
        percentage: 100,
        message: 'Uğurla tamamlandı!'
      });

      // Update state using authoritative list if returned, or atomic local update
      let updated: TransitCar[];
      if (dbResult.cars && Array.isArray(dbResult.cars)) {
        updated = dbResult.cars;
      } else if (editingCarId) {
        updated = carsList.map(c => c.id === editingCarId ? carToSave : c);
      } else {
        updated = [carToSave, ...carsList];
      }
      setCarsList(updated);
      onCarsUpdated(updated);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosalar-cars-updated', { detail: { cars: updated } }));
      }

      showToast(totalPending > 0 
        ? `${totalPending} ədəd sıxılmış WebP şəkil və elan məlumatları uğurla Supabase-ə yazıldı!`
        : 'Məlumatlar uğurla Supabase bazasına yazıldı!'
      );
      setIsEditingModalOpen(false);
    } catch (err: unknown) {
      console.error('Save failed:', err);
      const msg = err instanceof Error ? err.message : 'Bilinməyən xəta baş verdi';
      setSaveError(msg);
      showToast(`Xəta: ${msg}`);
      alert(`KRİTİK SUPABASE XƏTASI:\n\n${msg}\n\nMəlumat bazaya yazılmadı. Zəhmət olmasa xətanı yoxlayın.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Car
  const handleDeleteCar = async (carId: string | number, imageUrls?: string[]) => {
    if (!window.confirm("Bu elanı və şəkillərini silməyə əminsiniz?")) return;

    setDeletingCarId(String(carId));
    try {
      const res = await deleteCarFromSupabase(String(carId), imageUrls);
      if (!res.success) {
        throw new Error(res.error || 'Avtomobil silinmədi');
      }

      const updated = res.cars && Array.isArray(res.cars)
        ? res.cars
        : carsList.filter(c => String(c.id) !== String(carId));
      setCarsList(updated);
      onCarsUpdated(updated);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kosalar-cars-updated', { detail: { cars: updated } }));
      }

      alert("Elan və şəkillər bazadan tam silindi!");
    } catch (err: unknown) {
      console.error("Silmə xətası:", err);
      const msg = err instanceof Error ? err.message : 'Bilinməyən xəta';
      showToast(`Xəta: ${msg}`);
      alert("Xəta baş verdi: " + msg);
    } finally {
      setDeletingCarId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-200 overflow-hidden animate-in fade-in duration-200">
      {/* Header Bar */}
      <AdminHeader
        isAuthenticated={isAuthenticated}
        connStatus={connStatus}
        isTestingConn={isTestingConn}
        showSettingsDropdown={showSettingsDropdown}
        setShowSettingsDropdown={setShowSettingsDropdown}
        onOpenSettingsModal={() => setShowSupabaseSettingsModal(true)}
        onOpenRlsModal={() => setShowRlsModal(true)}
        onOpenThumbnailModal={() => setShowThumbnailModal(true)}
        onRunConnectionTest={runConnectionTest}
        onLogout={handleLogout}
        onClose={onClose}
      />

      {/* Supabase Diagnostic Warning Banner if Connection Failed */}
      {isAuthenticated && connStatus.tested && (!connStatus.dbConnected || !connStatus.storageConnected) && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 text-xs text-rose-200 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-white block">Supabase əlaqə xətası:</strong>
              {connStatus.dbError && <div>• Cədvəl ('cars'): {connStatus.dbError}</div>}
              {connStatus.storageError && <div>• Anbar ('{STORAGE_BUCKET_NAME}'): {connStatus.storageError}</div>}
              <div className="mt-1 text-[11px] text-rose-300">
                İpucu: Supabase Dashboard &gt; Project Settings &gt; API bölməsindən <strong>Anon JWT Key</strong> (başlanğıcı <code>eyJ...</code>) olduğundan əmin olun.
              </div>
            </div>
          </div>
          <button 
            onClick={runConnectionTest}
            className="bg-rose-800 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shrink-0"
          >
            Yoxla
          </button>
        </div>
      )}

      {/* Content Body Container */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {!isAuthenticated ? (
          <AdminLoginForm 
            onLoginSuccess={() => setIsAuthenticated(true)}
            showToast={showToast}
          />
        ) : (
          <>
            {/* KPI Cards */}
            <DashboardKpiCards 
              carsList={carsList}
              whatsappClicks={whatsappClicks}
              isFetchingClicks={isFetchingClicks}
              onRefreshAnalytics={loadAnalytics}
            />

            {/* Toolbar: Filters, search, add button, table/cards switch */}
            <CarListToolbar 
              carsCount={carsList.length}
              activeCount={carsList.filter(c => c.status !== 'sold').length}
              soldCount={carsList.filter(c => c.status === 'sold').length}
              activeFilterTab={activeFilterTab}
              setActiveFilterTab={setActiveFilterTab}
              adminViewMode={adminViewMode}
              setAdminViewMode={setAdminViewMode}
              adminSearchQuery={adminSearchQuery}
              setAdminSearchQuery={setAdminSearchQuery}
              onOpenAddCar={openAddCar}
            />

            {/* Cars List (Table or Card View) */}
            <CarList 
              carsList={carsList}
              activeFilterTab={activeFilterTab}
              adminSearchQuery={adminSearchQuery}
              adminViewMode={adminViewMode}
              updatingStatusCarId={updatingStatusCarId}
              deletingCarId={deletingCarId}
              onToggleStatus={handleToggleStatus}
              onEditCar={openEditCar}
              onDeleteCar={handleDeleteCar}
            />
          </>
        )}
      </main>

      {/* Modal: Add/Edit Car */}
      {isEditingModalOpen && (
        <CarFormModal 
          isOpen={isEditingModalOpen}
          editingCarId={editingCarId}
          saveError={saveError}
          isSaving={isSaving}
          saveProgress={saveProgress}
          activeModalTab={activeModalTab}
          setActiveModalTab={setActiveModalTab}
          onClose={handleCloseEditingModal}
          onSubmit={handleSaveCar}
          brand={brand}
          setBrand={setBrand}
          model={model}
          setModel={setModel}
          setTitle={setTitle}
          year={year}
          setYear={setYear}
          price={price}
          setPrice={setPrice}
          city={city}
          setCity={setCity}
          mileage={mileage}
          setMileage={setMileage}
          condition={condition}
          setCondition={setCondition}
          engine={engine}
          setEngine={setEngine}
          hp={hp}
          setHp={setHp}
          fuelType={fuelType}
          setFuelType={setFuelType}
          transmission={transmission}
          setTransmission={setTransmission}
          wheelDrive={wheelDrive}
          setWheelDrive={setWheelDrive}
          bodyType={bodyType}
          setBodyType={setBodyType}
          baseLength={baseLength}
          setBaseLength={setBaseLength}
          roofHeight={roofHeight}
          setRoofHeight={setRoofHeight}
          seatCount={seatCount}
          setSeatCount={setSeatCount}
          color={color}
          setColor={setColor}
          carStatus={carStatus}
          setCarStatus={setCarStatus}
          isFeatured={isFeatured}
          setIsFeatured={setIsFeatured}
          selectedStatusBadges={selectedStatusBadges}
          toggleStatusBadgeInForm={toggleStatusBadgeInForm}
          selectedFeatures={selectedFeatures}
          toggleFeatureInForm={toggleFeatureInForm}
          selectAllFeatures={selectAllFeatures}
          clearAllFeatures={clearAllFeatures}
          customFeatureInput={customFeatureInput}
          setCustomFeatureInput={setCustomFeatureInput}
          addCustomFeature={addCustomFeature}
          description={description}
          setDescription={setDescription}
          imagesList={imagesList}
          newImageUrl={newImageUrl}
          isAddingFromUrl={isAddingFromUrl}
          draggedImgIndex={draggedImgIndex}
          dragOverImgIndex={dragOverImgIndex}
          setNewImageUrl={setNewImageUrl}
          onFileUpload={handleFileUpload}
          onAddImageUrl={handleAddImageUrl}
          onMoveImage={moveImage}
          onMoveImageLeft={moveImageLeft}
          onMoveImageRight={moveImageRight}
          onSetAsPrimaryImage={setAsPrimaryImage}
          onRemoveImageAt={removeImageAt}
          setDraggedImgIndex={setDraggedImgIndex}
          setDragOverImgIndex={setDragOverImgIndex}
        />
      )}

      {/* Supabase Settings Modal */}
      {isAuthenticated && showSupabaseSettingsModal && (
        <SupabaseSettingsModal 
          isOpen={showSupabaseSettingsModal}
          onClose={() => setShowSupabaseSettingsModal(false)}
          supabaseUrlInput={supabaseUrlInput}
          setSupabaseUrlInput={setSupabaseUrlInput}
          supabaseAnonKeyInput={supabaseAnonKeyInput}
          setSupabaseAnonKeyInput={setSupabaseAnonKeyInput}
          showAnonKeyText={showAnonKeyText}
          setShowAnonKeyText={setShowAnonKeyText}
          isSavingConfig={isSavingConfig}
          onSaveConfig={handleSaveSupabaseConfig}
          onResetConfig={handleResetSupabaseConfig}
        />
      )}

      {/* Supabase Row Level Security (RLS) SQL Modal */}
      {isAuthenticated && showRlsModal && (
        <RlsModal 
          isOpen={showRlsModal}
          onClose={() => setShowRlsModal(false)}
          copiedRls={copiedRls}
          onCopyRls={handleCopyRls}
        />
      )}

      {/* Thumbnail Backfill Modal */}
      {isAuthenticated && showThumbnailModal && (
        <ThumbnailBackfillModal
          isOpen={showThumbnailModal}
          onClose={() => setShowThumbnailModal(false)}
          cars={cars}
        />
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-70 bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default AdminModal;
