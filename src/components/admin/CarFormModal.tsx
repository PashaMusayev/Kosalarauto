import React from 'react';
import { 
  Edit3, 
  X, 
  AlertTriangle, 
  Truck, 
  CheckSquare, 
  Image as ImageIcon, 
  ArrowRight, 
  ArrowLeft, 
  Star, 
  Check, 
  RefreshCw, 
  Save,
  ShieldCheck
} from 'lucide-react';
import { 
  FormImageItem, 
  SaveProgressState, 
  DEFAULT_STANDARD_FEATURES,
  BRAND_MODELS,
  STANDARD_COLORS,
  STANDARD_ENGINE_OPTIONS,
  STANDARD_WHEEL_DRIVE_OPTIONS
} from './adminTypes';
import { ImageUploader } from './ImageUploader';
import { STORAGE_BUCKET_NAME } from '../../services/supabaseClientInit';
import { CanonicalBadge, CANONICAL_STATUS_BADGES } from '../../data/badges';

interface CarFormModalProps {
  isOpen: boolean;
  editingCarId: string | null;
  saveError: string | null;
  isSaving: boolean;
  saveProgress: SaveProgressState;
  activeModalTab: 'basics' | 'features' | 'media';
  setActiveModalTab: (tab: 'basics' | 'features' | 'media') => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;

  // Form states & setters
  brand: string;
  setBrand: (val: string) => void;
  model: string;
  setModel: (val: string) => void;
  setTitle: (val: string) => void;
  year: number | '';
  setYear: (val: number | '') => void;
  price: number | '';
  setPrice: (val: number | '') => void;
  city: string;
  setCity: (val: string) => void;
  mileage: number | '';
  setMileage: (val: number | '') => void;
  condition: string;
  setCondition: (val: string) => void;
  engine: string;
  setEngine: (val: string) => void;
  hp: number | '';
  setHp: (val: number | '') => void;
  fuelType: string;
  setFuelType: (val: string) => void;
  transmission: string;
  setTransmission: (val: string) => void;
  wheelDrive: string;
  setWheelDrive: (val: string) => void;
  bodyType: string;
  setBodyType: (val: string) => void;
  baseLength: string;
  setBaseLength: (val: string) => void;
  roofHeight: string;
  setRoofHeight: (val: string) => void;
  seatCount: string;
  setSeatCount: (val: string) => void;
  color: string;
  setColor: (val: string) => void;
  carStatus: 'active' | 'sold';
  setCarStatus: (val: 'active' | 'sold') => void;
  isFeatured: boolean;
  setIsFeatured: (val: boolean) => void;
  selectedStatusBadges: CanonicalBadge[];
  toggleStatusBadgeInForm: (badge: CanonicalBadge) => void;
  selectedFeatures: string[];
  toggleFeatureInForm: (feat: string) => void;
  selectAllFeatures: () => void;
  clearAllFeatures: () => void;
  customFeatureInput: string;
  setCustomFeatureInput: (val: string) => void;
  addCustomFeature: () => void;
  description: string;
  setDescription: (val: string) => void;

  // Image handling props
  imagesList: FormImageItem[];
  newImageUrl: string;
  isAddingFromUrl: boolean;
  draggedImgIndex: number | null;
  dragOverImgIndex: number | null;
  setNewImageUrl: (val: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddImageUrl: () => void;
  onMoveImage: (fromIndex: number, toIndex: number) => void;
  onMoveImageLeft: (index: number) => void;
  onMoveImageRight: (index: number) => void;
  onSetAsPrimaryImage: (index: number) => void;
  onRemoveImageAt: (index: number) => void;
  setDraggedImgIndex: (idx: number | null) => void;
  setDragOverImgIndex: (idx: number | null) => void;
}

export const CarFormModal: React.FC<CarFormModalProps> = ({
  isOpen,
  editingCarId,
  saveError,
  isSaving,
  saveProgress,
  activeModalTab,
  setActiveModalTab,
  onClose,
  onSubmit,

  brand,
  setBrand,
  model,
  setModel,
  setTitle,
  year,
  setYear,
  price,
  setPrice,
  city,
  setCity,
  mileage,
  setMileage,
  condition,
  setCondition,
  engine,
  setEngine,
  hp,
  setHp,
  fuelType,
  setFuelType,
  transmission,
  setTransmission,
  wheelDrive,
  setWheelDrive,
  bodyType,
  setBodyType,
  baseLength,
  setBaseLength,
  roofHeight,
  setRoofHeight,
  seatCount,
  setSeatCount,
  color,
  setColor,
  carStatus,
  setCarStatus,
  isFeatured,
  setIsFeatured,
  selectedStatusBadges,
  toggleStatusBadgeInForm,
  selectedFeatures,
  toggleFeatureInForm,
  selectAllFeatures,
  clearAllFeatures,
  customFeatureInput,
  setCustomFeatureInput,
  addCustomFeature,
  description,
  setDescription,

  imagesList,
  newImageUrl,
  isAddingFromUrl,
  draggedImgIndex,
  dragOverImgIndex,
  setNewImageUrl,
  onFileUpload,
  onAddImageUrl,
  onMoveImage,
  onMoveImageLeft,
  onMoveImageRight,
  onSetAsPrimaryImage,
  onRemoveImageAt,
  setDraggedImgIndex,
  setDragOverImgIndex
}) => {
  if (!isOpen) return null;

  const currentBrand = brand.toLowerCase().includes('mercedes') 
    ? 'Mercedes' 
    : (brand.toLowerCase().includes('ford') ? 'Ford' : brand);
  const modelOptions = currentBrand && BRAND_MODELS[currentBrand] ? BRAND_MODELS[currentBrand] : [];

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    if (newBrand !== currentBrand) {
      setModel('');
      setTitle(newBrand.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-1.5 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="bg-slate-950 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-white text-sm sm:text-base truncate">
                {editingCarId ? 'Avtomobili Supabase-də redaktə et' : 'Yeni avtomobili Supabase-ə əlavə et'}
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Şəkillər <strong>{STORAGE_BUCKET_NAME}</strong> bucket-inə, məlumatlar <strong>cars</strong> cədvəlinə yazılacaq
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {saveError && (
          <div className="bg-rose-950 border-b border-rose-800 p-3 sm:p-4 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-white block">Supabase xətası:</strong>
              <p>{saveError}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form noValidate onSubmit={onSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* 3-Tab Selector (Mobile Horizontally Scrollable) */}
          <div className="bg-slate-950 border-b border-slate-800 px-3 sm:px-6 pt-2 pb-0 overflow-x-auto scrollbar-none flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setActiveModalTab('basics')}
              className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-t-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap flex items-center gap-2 border-b-2 shrink-0 ${
                activeModalTab === 'basics'
                  ? 'text-blue-400 border-blue-500 bg-blue-500/10'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/60'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>Əsas və Mühərrik</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModalTab('features')}
              className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-t-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap flex items-center gap-2 border-b-2 shrink-0 ${
                activeModalTab === 'features'
                  ? 'text-blue-400 border-blue-500 bg-blue-500/10'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/60'
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              <span>Təchizat və Status</span>
              {selectedFeatures.length > 0 && (
                <span className="bg-blue-600/30 text-blue-300 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-blue-500/40">
                  {selectedFeatures.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveModalTab('media')}
              className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-t-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap flex items-center gap-2 border-b-2 shrink-0 ${
                activeModalTab === 'media'
                  ? 'text-blue-400 border-blue-500 bg-blue-500/10'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/60'
              }`}
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span>Şəkillər və Qeyd</span>
              {imagesList.length > 0 && (
                <span className="bg-emerald-600/30 text-emerald-300 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/40">
                  {imagesList.length}
                </span>
              )}
            </button>
          </div>

          {/* Form Content: Tab Views (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
            {/* TAB 1: ƏSAS VƏ MÜHƏRRİK */}
            <div className={activeModalTab === 'basics' ? 'space-y-4 sm:space-y-6 block' : 'hidden'}>
              {/* SECTION 1: ƏSAS MƏLUMATLAR & QİYMƏT */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h4 className="text-xs font-black text-blue-400 tracking-wider flex items-center gap-2">
                    <span>1. Əsas məlumatlar və qiymət</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                  {/* Marka (Make) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Marka <span className="text-rose-400">*</span>:
                    </label>
                    <select
                      id="car-form-brand"
                      value={currentBrand}
                      onChange={(e) => handleBrandChange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                      required
                    >
                      <option value="">Seçin...</option>
                      <option value="Ford">Ford</option>
                      <option value="Mercedes">Mercedes</option>
                      {currentBrand && currentBrand !== 'Ford' && currentBrand !== 'Mercedes' && (
                        <option value={currentBrand}>{currentBrand}</option>
                      )}
                    </select>
                  </div>

                  {/* Model */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Model <span className="text-rose-400">*</span>:
                    </label>
                    {currentBrand && modelOptions.length > 0 ? (
                      <select
                        id="car-form-model"
                        value={model}
                        onChange={(e) => {
                          const newModel = e.target.value;
                          setModel(newModel);
                          setTitle(`${currentBrand} ${newModel}`.trim());
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                        required
                      >
                        <option value="">Seçin...</option>
                        {modelOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                        {model && !modelOptions.includes(model) && (
                          <option value={model}>{model}</option>
                        )}
                      </select>
                    ) : !currentBrand ? (
                      <select
                        id="car-form-model"
                        disabled
                        value=""
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-500 font-medium cursor-not-allowed"
                      >
                        <option value="">Əvvəlcə markanı seçin...</option>
                      </select>
                    ) : (
                      <input
                        id="car-form-model"
                        type="text"
                        value={model}
                        onChange={(e) => {
                          const newModel = e.target.value;
                          setModel(newModel);
                          setTitle(`${currentBrand} ${newModel}`.trim());
                        }}
                        placeholder="Modeli daxil edin"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                        required
                      />
                    )}
                  </div>

                  {/* Buraxılış İli */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Buraxılış ili <span className="text-rose-400">*</span>:
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                      required
                    >
                      <option value="">Seçin...</option>
                      {Array.from({ length: 35 }, (_, i) => 2027 - i).map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Qiymət (AZN) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Qiymət (AZN) <span className="text-rose-400">*</span>:
                    </label>
                    <div className="relative">
                      <input
                        id="car-form-price"
                        type="number"
                        min={0}
                        step={100}
                        value={price}
                        onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder=""
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-12 py-2 text-emerald-400 font-extrabold text-sm focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        AZN
                      </span>
                    </div>
                  </div>

                  {/* Şəhər (City) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Şəhər (satış yeri):
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      <option value="Bakı">Bakı</option>
                      <option value="Bakı, Yeni Günəşli">Bakı, Yeni Günəşli (Avtosalon)</option>
                      <option value="Sumqayıt">Sumqayıt</option>
                      <option value="Gəncə">Gəncə</option>
                      <option value="Xırdalan">Xırdalan</option>
                      <option value="Şəki">Şəki</option>
                      <option value="Mingəçevir">Mingəçevir</option>
                      <option value="Lənkəran">Lənkəran</option>
                      <option value="Şirvan">Şirvan</option>
                      <option value="Quba">Quba</option>
                      <option value="Xaçmaz">Xaçmaz</option>
                      <option value="Digər">Digər şəhər</option>
                    </select>
                  </div>

                  {/* Yürüş (km) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Yürüş (km) <span className="text-rose-400">*</span>:
                    </label>
                    <div className="relative">
                      <input
                        id="car-form-mileage"
                        type="number"
                        min={0}
                        value={mileage}
                        onChange={(e) => setMileage(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder=""
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                        km
                      </span>
                    </div>
                  </div>

                  {/* Vəziyyəti (Condition) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Vəziyyəti:
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      <option value="Vuruğu yoxdur, rənglənməyib">Vuruğu yoxdur, rənglənməyib</option>
                      <option value="Əla vəziyyətdə">Əla vəziyyətdə</option>
                      <option value="Gömrük olunub">Gömrük olunub (Yeni gətirilib)</option>
                      <option value="Rənglənib">Rənglənib</option>
                      <option value="Yüngül kosmetik işləri var">Yüngül kosmetik işləri var</option>
                      <option value="Qəzalı və ya təmir tələb edir">Qəzalı və ya təmir tələb edir</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: MÜHƏRRİK & TRANSMİSSİYA PARAMETRLƏRİ */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-black text-amber-400 tracking-wider border-b border-slate-800 pb-2.5">
                  2. Mühərrik, yanacaq və ötürücü
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
                  {/* Mühərrik (Engine) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Mühərrik:
                    </label>
                    <select
                      value={engine}
                      onChange={(e) => setEngine(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      {STANDARD_ENGINE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      {engine && !STANDARD_ENGINE_OPTIONS.includes(engine) && (
                        <option value={engine}>{engine}</option>
                      )}
                    </select>
                  </div>

                  {/* At Gücü (HP) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      At gücü (HP / a.g.):
                    </label>
                    <div className="relative">
                      <input
                        id="car-form-hp"
                        type="number"
                        value={hp}
                        onChange={(e) => setHp(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Məs: 155"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-12 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                        a.g.
                      </span>
                    </div>
                  </div>

                  {/* Yanacaq Növü (Fuel Type) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Yanacaq növü:
                    </label>
                    <select
                      value={fuelType}
                      onChange={(e) => setFuelType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      <option value="Benzin">Benzin</option>
                      <option value="Dizel">Dizel</option>
                    </select>
                  </div>

                  {/* Sürətlər Qutusu (Transmission) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Sürətlər qutusu (Transmission):
                    </label>
                    <select
                      value={transmission}
                      onChange={(e) => setTransmission(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      <option value="Mexanika">Mexanika</option>
                      <option value="Avtomat">Avtomat</option>
                    </select>
                  </div>

                  {/* Ötürücü (Wheel Drive) */}
                  <div className="sm:col-span-1 md:col-span-2">
                    <label className="font-bold text-slate-300 block mb-1">
                      Ötürücü:
                    </label>
                    <select
                      value={wheelDrive}
                      onChange={(e) => setWheelDrive(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      {STANDARD_WHEEL_DRIVE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      {wheelDrive && !STANDARD_WHEEL_DRIVE_OPTIONS.includes(wheelDrive) && (
                        <option value={wheelDrive}>{wheelDrive}</option>
                      )}
                    </select>
                  </div>

                  {/* Yerlərin sayı (Seat Count) */}
                  <div className="sm:col-span-1 md:col-span-2">
                    <label className="font-bold text-slate-300 block mb-1">
                      Yerlərin sayı:
                    </label>
                    <select
                      value={seatCount}
                      onChange={(e) => setSeatCount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                      <option value="7">7</option>
                      <option value="8">8</option>
                      <option value="9+">9+</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: GÖVDƏ, BAZA VƏ RƏNG */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-black text-purple-400 tracking-wider border-b border-slate-800 pb-2.5">
                  3. Ban növü, baza ölçüsü və rəng
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
                  {/* Ban növü (Body Type) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Ban növü:
                    </label>
                    <select
                      value={bodyType}
                      onChange={(e) => setBodyType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      <option value="Yük furqonu">Yük furqonu</option>
                      <option value="Sərnişin">Sərnişin</option>
                      <option value="Mikroavtobus">Mikroavtobus</option>
                      <option value="Bortlu / Tentli">Bortlu / Tentli</option>
                      <option value="Soyuducu (Ref)">Soyuducu (Ref)</option>
                      <option value="Pikap">Pikap</option>
                      <option value="Şassi">Şassi</option>
                      <option value="Digər">Digər</option>
                    </select>
                  </div>

                  {/* Baza Ölçüsü (Wheelbase) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Baza ölçüsü:
                    </label>
                    <select
                      value={baseLength}
                      onChange={(e) => setBaseLength(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      <option value="3.30 m">3.30 m (Uzun baza - L3)</option>
                      <option value="2.8 m">2.8 m (Orta baza - L2)</option>
                      <option value="2.4 m">2.4 m (Qısa baza - L1)</option>
                      <option value="4 m">4.0 m (Ekstra uzun baza - L4)</option>
                    </select>
                  </div>

                  {/* Dam Hündürlüyü (Roof Height) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Dam hündürlüyü:
                    </label>
                    <select
                      value={roofHeight}
                      onChange={(e) => setRoofHeight(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      <option value="Hündür dam">Hündür dam (H3)</option>
                      <option value="Orta dam">Orta dam (H2)</option>
                      <option value="Alçaq dam">Alçaq dam (H1)</option>
                    </select>
                  </div>

                  {/* Rəng (Color) */}
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">
                      Rəng:
                    </label>
                    <select
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">Seçin...</option>
                      {STANDARD_COLORS.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                      {color && !STANDARD_COLORS.includes(color) && (
                        <option value={color}>{color}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tab 1 Navigation Next Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('features')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                >
                  <span>Növbəti: Təchizat və Status</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 2: TƏCHİZAT VƏ STATUS */}
            <div className={activeModalTab === 'features' ? 'space-y-4 sm:space-y-6 block' : 'hidden'}>
              {/* SECTION: STATUS NİŞANLARI (MULTI-SELECT) */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="font-black text-white text-sm tracking-wide">
                        Status nişanları (Qiymətin altında)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Elanın əsas kartında və detal pəncərəsində görünəcək rəsmi nişanları seçin.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                    {selectedStatusBadges.length} seçilib
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {CANONICAL_STATUS_BADGES.map((badge) => {
                    const isChecked = selectedStatusBadges.includes(badge);
                    return (
                      <button
                        key={badge}
                        type="button"
                        onClick={() => toggleStatusBadgeInForm(badge)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                          isChecked
                            ? 'bg-emerald-950/40 text-white font-bold border-emerald-500/60 shadow-xs ring-1 ring-emerald-500/30'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isChecked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 bg-slate-800'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-semibold">{badge}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 4: SATIŞ STATUSU VƏ VİTRİN SEÇİMİ */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-3.5">
                <h4 className="text-xs font-black text-emerald-400 tracking-wider border-b border-slate-800 pb-2.5">
                  4. Satış statusu və vitrin görünüşü
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Satışda (Aktiv) düyməsi */}
                  <button
                    type="button"
                    onClick={() => setCarStatus('active')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                      carStatus === 'active'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        carStatus === 'active' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                      }`}>
                        {carStatus === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-black text-white">🟢 Satışda (aktiv elan)</div>
                      </div>
                    </div>
                  </button>

                  {/* Satıldı (Arxiv) düyməsi */}
                  <button
                    type="button"
                    onClick={() => setCarStatus('sold')}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                      carStatus === 'sold'
                        ? 'bg-amber-950/60 border-amber-500 text-white shadow-md shadow-amber-950/40 ring-1 ring-amber-500/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        carStatus === 'sold' ? 'border-amber-400 bg-amber-500' : 'border-slate-600'
                      }`}>
                        {carStatus === 'sold' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-black text-white">🔴 Satıldı (arxiv)</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Featured Checkbox */}
                <div className="pt-2">
                  <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span>Seçilmiş / vitrin elanı (Featured)</span>
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* SECTION: AVTOMOBİLİN TƏCHİZATI (EQUIPMENT) */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-blue-400" />
                    <div>
                      <h4 className="font-black text-white text-sm tracking-wide">
                        Avtomobilin təchizatı
                      </h4>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      type="button" 
                      onClick={selectAllFeatures}
                      className="text-[11px] font-bold text-blue-400 bg-blue-950/60 hover:bg-blue-900/60 px-2.5 py-1 rounded border border-blue-800/40 transition-colors"
                    >
                      Hamısını seç
                    </button>
                    <button 
                      type="button" 
                      onClick={clearAllFeatures}
                      className="text-[11px] font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-700 transition-colors"
                    >
                      Təmizlə
                    </button>
                    <span className="text-xs font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">
                      {selectedFeatures.length} seçilib
                    </span>
                  </div>
                </div>

                {/* 19 Checkboxes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {DEFAULT_STANDARD_FEATURES.map((feat, idx) => {
                    const isChecked = selectedFeatures.includes(feat);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleFeatureInForm(feat)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                          isChecked
                            ? 'bg-blue-600/20 text-white font-bold border-blue-500/50 shadow-xs'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 bg-slate-800'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs">{feat}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Extra Features List & Input */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Əlavə / xüsusi təchizat əlavə et:
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={customFeatureInput} 
                      onChange={(e) => setCustomFeatureInput(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomFeature(); }}}
                      placeholder=""
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                    <button 
                      type="button"
                      onClick={addCustomFeature}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Əlavə et
                    </button>
                  </div>

                  {selectedFeatures.filter(f => !DEFAULT_STANDARD_FEATURES.includes(f)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedFeatures.filter(f => !DEFAULT_STANDARD_FEATURES.includes(f)).map((cf, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 bg-blue-600/30 text-blue-200 text-xs px-2.5 py-1 rounded-md border border-blue-500/40">
                          <span>{cf}</span>
                          <button 
                            type="button" 
                            onClick={() => toggleFeatureInForm(cf)}
                            className="text-blue-300 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tab 2 Navigation Prev / Next Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('basics')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Əvvəlki: Əsas və Mühərrik</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('media')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                >
                  <span>Növbəti: Şəkillər və Qeyd</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TAB 3: ŞƏKİLLƏR VƏ QEYD */}
            <div className={activeModalTab === 'media' ? 'space-y-4 sm:space-y-6 block' : 'hidden'}>
              {/* Photos Manager - Deferred Upload & Reordering */}
              <ImageUploader 
                imagesList={imagesList}
                newImageUrl={newImageUrl}
                isAddingFromUrl={isAddingFromUrl}
                draggedImgIndex={draggedImgIndex}
                dragOverImgIndex={dragOverImgIndex}
                setNewImageUrl={setNewImageUrl}
                onFileUpload={onFileUpload}
                onAddImageUrl={onAddImageUrl}
                onMoveImage={onMoveImage}
                onMoveImageLeft={onMoveImageLeft}
                onMoveImageRight={onMoveImageRight}
                onSetAsPrimaryImage={onSetAsPrimaryImage}
                onRemoveImageAt={onRemoveImageAt}
                setDraggedImgIndex={setDraggedImgIndex}
                setDragOverImgIndex={setDragOverImgIndex}
              />

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Ətraflı təsvir / qeyd:</label>
                <textarea 
                  rows={3} 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white" 
                  placeholder=""
                />
              </div>

              {/* Tab 3 Navigation Prev Button */}
              <div className="flex items-center justify-start pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('features')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Əvvəlki: Təchizat və Status</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Sticky Footer */}
          <div className="bg-slate-950 px-3.5 sm:px-6 py-3 sm:py-4 border-t border-slate-800 space-y-3 shrink-0">
            {isSaving && (
              <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-3 space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-bold text-blue-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span>{saveProgress.message || 'Supabase-ə yazılır...'}</span>
                  </span>
                  <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                    {saveProgress.percentage}%
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 h-full transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${Math.max(5, saveProgress.percentage)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-slate-400 hidden sm:block">
                {editingCarId ? 'Dəyişiklikləri saxlamaq üçün düyməyə basın' : 'Məlumatları daxil edib yadda saxlayın'}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button 
                  type="button" 
                  onClick={onClose} 
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 disabled:opacity-50 transition-colors active:scale-95"
                >
                  Ləğv et
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-lg flex items-center gap-2 transition-all ${
                    isSaving 
                      ? 'bg-blue-800/80 cursor-wait shadow-none' 
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30 active:scale-95'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>{saveProgress.message || 'Supabase-ə yazılır...'}</span>
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono font-bold">
                        {saveProgress.percentage}%
                      </span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Supabase-də yadda saxla</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
