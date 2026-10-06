import React, { useState, useRef } from 'react';
import { 
  CloudUpload, 
  Link as LinkIcon, 
  RefreshCw, 
  Image as ImageIcon, 
  Star, 
  Zap, 
  Cloud, 
  ArrowLeft, 
  ArrowRight, 
  Trash2,
  AlertTriangle,
  AlertCircle,
  ZoomIn,
  ArrowLeftRight
} from 'lucide-react';
import { FormImageItem } from './adminTypes';
import { DEFAULT_VEHICLE_PLACEHOLDER } from '../../utils/imageFallback';
import { formatFileSize } from '../../utils/imageCompressor';
import { ImagePreviewModal } from './ImagePreviewModal';

interface ImageUploaderProps {
  imagesList: FormImageItem[];
  newImageUrl: string;
  isAddingFromUrl: boolean;
  draggedImgIndex: number | null;
  dragOverImgIndex: number | null;
  setNewImageUrl: (val: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddImageUrl: () => void;
  onMoveImage: (fromIndex: number, toIndex: number) => void;
  onSwapImages: (a: number, b: number) => void;
  onMoveImageLeft: (index: number) => void;
  onMoveImageRight: (index: number) => void;
  onSetAsPrimaryImage: (index: number) => void;
  onRemoveImageAt: (index: number) => void;
  setDraggedImgIndex: (idx: number | null) => void;
  setDragOverImgIndex: (idx: number | null) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  imagesList,
  newImageUrl,
  isAddingFromUrl,
  draggedImgIndex,
  dragOverImgIndex,
  setNewImageUrl,
  onFileUpload,
  onAddImageUrl,
  onMoveImage,
  onSwapImages,
  onMoveImageLeft,
  onMoveImageRight,
  onSetAsPrimaryImage,
  onRemoveImageAt,
  setDraggedImgIndex,
  setDragOverImgIndex
}) => {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  return (
    <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div>
          <h4 className="font-black text-white text-xs tracking-wide flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-blue-400" />
            <span>Avtomobilin şəkilləri ({imagesList.length} şəkil)</span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            <strong className="text-amber-400">#1 nömrəli şəkil</strong> əsas kover şəkli hesab olunur.
          </p>
        </div>
        
        <label className="text-white text-xs font-bold px-3.5 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 active:scale-95">
          <CloudUpload className="w-4 h-4" />
          <span>Şəkilləri yüklə</span>
          <input 
            type="file" 
            multiple 
            accept="image/*" 
            onChange={onFileUpload} 
            className="hidden" 
          />
        </label>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input 
            type="url" 
            value={newImageUrl} 
            onChange={(e) => setNewImageUrl(e.target.value)} 
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddImageUrl(); }}}
            placeholder="Şəkil URL linki daxil edin (https://...)" 
            disabled={isAddingFromUrl}
            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 disabled:opacity-60" 
          />
        </div>
        <button 
          type="button" 
          onClick={onAddImageUrl} 
          disabled={isAddingFromUrl || !newImageUrl.trim()}
          className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isAddingFromUrl ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>Yüklənir...</span>
            </>
          ) : (
            <>
              <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>URL əlavə et</span>
            </>
          )}
        </button>
      </div>

      {imagesList.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
          <span>Hələ heç bir şəkil əlavə edilməyib. 'Kompüterdən şəkil seç' düyməsindən istifadə edin.</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
          {imagesList.map((item, i) => {
            const isPrimary = i === 0;
            const isDragged = draggedImgIndex === i;
            const isDragOver = dragOverImgIndex === i;
            const hasError = Boolean(item.error);

            return (
              <div 
                key={item.id || `${item.url}-${i}`} 
                draggable={!hasError}
                onDragStart={(e) => {
                  if (hasError) return;
                  isDraggingRef.current = true;
                  e.dataTransfer.setData('text/plain', String(i));
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedImgIndex(i);
                }}
                onDragOver={(e) => {
                  if (hasError) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverImgIndex !== i) {
                    setDragOverImgIndex(i);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverImgIndex === i) {
                    setDragOverImgIndex(null);
                  }
                }}
                onDrop={(e) => {
                  if (hasError) return;
                  e.preventDefault();
                  const raw = e.dataTransfer.getData('text/plain');
                  const fromIndex = raw !== '' ? Number(raw) : draggedImgIndex;
                  if (fromIndex !== null && !isNaN(fromIndex) && fromIndex !== i) {
                    onSwapImages(fromIndex, i);
                  }
                  setDraggedImgIndex(null);
                  setDragOverImgIndex(null);
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 100);
                }}
                onDragEnd={() => {
                  setDraggedImgIndex(null);
                  setDragOverImgIndex(null);
                  setTimeout(() => {
                    isDraggingRef.current = false;
                  }, 100);
                }}
                className={`group relative rounded-xl overflow-hidden border bg-slate-900 flex flex-col transition-all select-none ${
                  hasError
                    ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20'
                    : isPrimary 
                      ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10 cursor-move' 
                      : 'border-slate-800 hover:border-slate-700 cursor-move'
                } ${
                  isDragged 
                    ? 'opacity-30 scale-95 border-dashed border-blue-500 ring-2 ring-blue-500/50' 
                    : isDragOver && !hasError && draggedImgIndex !== null && draggedImgIndex !== i
                      ? 'ring-2 ring-blue-500 border-blue-400 scale-[1.03] bg-blue-950/80 shadow-xl shadow-blue-500/40 z-30'
                      : ''
                }`}
                title={hasError ? `${item.error}${item.errorDetail ? `\n${item.errorDetail}` : ''}` : "Böyütmək üçün klikləyin, yerini dəyişmək üçün sürükləyin"}
              >
                {/* Clear visual swap indicator during drag-over */}
                {isDragOver && !hasError && draggedImgIndex !== null && draggedImgIndex !== i && (
                  <div className="absolute inset-0 bg-blue-900/75 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 z-30 pointer-events-none animate-in fade-in duration-100">
                    <div className="bg-blue-600 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-lg border border-blue-300 flex items-center gap-1.5 animate-bounce">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-blue-100" />
                      <span>Yerini dəyiş</span>
                    </div>
                    <span className="text-[10px] text-blue-100 font-bold mt-1 bg-slate-950/85 px-2 py-0.5 rounded shadow-sm">
                      #{draggedImgIndex + 1} ⇄ #{i + 1}
                    </span>
                  </div>
                )}

                {/* Image Thumbnail Container or Error State Container */}
                {hasError ? (
                  <div 
                    onClick={(e) => {
                      if (isDraggingRef.current) return;
                      setPreviewIndex(i);
                    }}
                    className="relative aspect-video w-full bg-rose-950/40 p-2 sm:p-2.5 overflow-hidden flex flex-col items-center justify-center text-center select-none border-b border-rose-900/50 cursor-zoom-in group/img"
                  >
                    <AlertTriangle className="w-5 h-5 text-rose-400 mb-1 shrink-0 animate-pulse" />
                    <span className="text-[11px] font-bold text-rose-200 line-clamp-1 break-all px-1">
                      {item.fileName || item.file?.name || `Şəkil #${i + 1}`}
                    </span>
                    <p className="text-[10px] text-rose-300/90 leading-tight mt-1 line-clamp-2 px-1 font-medium">
                      {item.error}
                    </p>
                    {item.errorDetail && (
                      <span className="text-[10px] font-mono text-rose-400/80 leading-tight mt-1 line-clamp-1 px-1 break-all select-all">
                        {item.errorDetail}
                      </span>
                    )}

                    {/* Sequence Badge */}
                    <span className="absolute top-1.5 left-1.5 bg-rose-950/90 text-rose-200 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border border-rose-800">
                      #{i + 1}
                    </span>

                    {/* Error Badge */}
                    <span className="absolute top-1.5 right-1.5 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5">
                      <AlertCircle className="w-2.5 h-2.5" />
                      <span>Xəta</span>
                    </span>

                    {/* Clear hover cue on desktop: zoom in */}
                    <div className="absolute inset-0 bg-rose-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="bg-rose-950/90 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-800 shadow-sm">
                        <ZoomIn className="w-3 h-3 text-rose-400" />
                        <span>Bax</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={(e) => {
                      if (isDraggingRef.current) return;
                      setPreviewIndex(i);
                    }}
                    className="relative aspect-video w-full bg-slate-100 overflow-hidden flex items-center justify-center cursor-zoom-in group/img"
                  >
                    <img 
                      src={item.url} 
                      alt={`Şəkil #${i + 1}`} 
                      className="w-full h-full object-cover select-none pointer-events-none" 
                      onError={(e) => { 
                        const img = e.target as HTMLImageElement;
                        img.onerror = null;
                        img.src = DEFAULT_VEHICLE_PLACEHOLDER; 
                      }}
                    />
                    
                    {/* Sequence Badge */}
                    <span className="absolute top-1.5 left-1.5 bg-slate-950/85 backdrop-blur-xs text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border border-slate-700/50">
                      #{i + 1}
                    </span>

                    {/* Local Preview / Compression Badge */}
                    {item.isBlob && (
                      <>
                        {item.isCompressing ? (
                          <span className="absolute bottom-1.5 left-1.5 bg-indigo-600/95 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 animate-pulse">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>Sıxılır...</span>
                          </span>
                        ) : item.isFallbackOriginal ? (
                          <span 
                            className="absolute bottom-1.5 left-1.5 bg-amber-950/95 border border-amber-500/60 text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5"
                            title={`Orijinal formatda saxlanıldı (${formatFileSize(item.compressedSize || item.originalSize || 0)})`}
                          >
                            <span>Orijinal • {formatFileSize(item.compressedSize || item.originalSize || 0)}</span>
                          </span>
                        ) : item.compressedSize ? (
                          <span 
                            className="absolute bottom-1.5 left-1.5 bg-emerald-950/95 border border-emerald-500/60 text-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-0.5"
                            title={`Orijinal: ${formatFileSize(item.originalSize || 0)} → Sıxılmış: ${formatFileSize(item.compressedSize)} (-${item.savedPercent || 0}%)`}
                          >
                            <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                            <span>WebP • {formatFileSize(item.compressedSize)}</span>
                          </span>
                        ) : (
                          <span className="absolute bottom-1.5 left-1.5 bg-blue-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                            Lokal önizləmə
                          </span>
                        )}
                      </>
                    )}

                    {!item.isBlob && (
                      <span className="absolute bottom-1.5 left-1.5 bg-slate-950/85 text-blue-300 text-[8px] font-bold px-1.5 py-0.5 rounded border border-blue-900/50 flex items-center gap-1 shadow-sm">
                        <Cloud className="w-2.5 h-2.5 text-blue-400" />
                        <span>Storage</span>
                      </span>
                    )}

                    {/* Primary Crown/Star Badge */}
                    {isPrimary ? (
                      <span className="absolute top-1.5 right-1.5 bg-amber-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        <span>Əsas</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSetAsPrimaryImage(i); }}
                        className="absolute top-1.5 right-1.5 bg-slate-950/90 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 flex items-center gap-1 shadow border border-amber-500/40 active:scale-95"
                        title="Bu şəkli 1-ci sıraya (Əsas Kover) gətir"
                      >
                        <Star className="w-3 h-3" />
                        <span>Əsas et</span>
                      </button>
                    )}

                    {/* Clear hover cue on desktop: ZoomIn / Böyüt icon overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="bg-slate-900/90 text-slate-100 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-slate-700/80 shadow-md">
                        <ZoomIn className="w-3.5 h-3.5 text-blue-400" />
                        <span>Böyüt</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Toolbar Buttons: Left / Right / Delete (Fixed 3-Button Layout) */}
                <div className="p-1.5 sm:p-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onMoveImageLeft(i); }}
                      disabled={i === 0 || hasError}
                      className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-all ${
                        i === 0 || hasError
                          ? 'text-slate-600 bg-slate-950/40 cursor-not-allowed' 
                          : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95'
                      }`}
                      title="Sola çək (←)"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onMoveImageRight(i); }}
                      disabled={i === imagesList.length - 1 || hasError}
                      className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-all ${
                        i === imagesList.length - 1 || hasError
                          ? 'text-slate-600 bg-slate-950/40 cursor-not-allowed' 
                          : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95'
                      }`}
                      title="Sağa çək (→)"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasError || window.confirm(`#${i + 1} nömrəli şəkli silmək istədiyinizə əminsiniz?`)) {
                        onRemoveImageAt(i);
                      }
                    }}
                    className={`p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors ml-auto active:scale-95 shrink-0 ${
                      hasError 
                        ? 'text-white bg-rose-600 hover:bg-rose-500 font-bold text-xs gap-1 px-3 shadow-md shadow-rose-900/40' 
                        : 'text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40'
                    }`}
                    title={hasError ? "Xətalı şəkli sil" : "Şəkli sil"}
                  >
                    <Trash2 className="w-4 h-4" />
                    {hasError && <span>Sil</span>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Click-to-preview full screen overlay */}
      <ImagePreviewModal
        images={imagesList}
        currentIndex={previewIndex}
        onClose={() => setPreviewIndex(null)}
        onNavigate={(idx) => setPreviewIndex(idx)}
      />
    </div>
  );
};
