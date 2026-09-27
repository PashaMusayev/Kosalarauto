import React, { useState, useEffect, useCallback } from 'react';
import { FormImageItem } from './adminTypes';
import { 
  isSupabaseStorageUrl, 
  downloadExternalImageAsBlob, 
  uploadImageToSupabaseStorage,
  uploadThumbnailForImage 
} from '../../services/imageStorageService';
import { compressImage, createThumbnail } from '../../utils/imageCompressor';
import { detectImageFormatFromBuffer } from '../../utils/imageFormatDetector';

export const MSG_UNREADABLE_FILE = "Bu şəkil telefonda oxuna bilmədi. Şəkli qalereyadan (məs. Google Photos) əvvəlcə cihaza endirin və yenidən seçin.";
export const MSG_HEIC_FAILED = "HEIC formatı çevrilə bilmədi. Şəkli JPEG kimi saxlayın və ya kamera ayarlarında 'Ən uyğun (JPEG)' formatı seçin.";
export const MSG_HEIC_NOT_SUPPORTED = MSG_HEIC_FAILED;
export const MSG_CORRUPTED_FILE = "Bu şəkil formatı deşifrə edilə bilmədi və ya fayl zədələnib.";

/**
 * Maximum allowed file size for direct/original upload fallback (15MB).
 * Must strictly match the server's upload endpoint payload limit in server.ts (POST /api/upload-image).
 */
export const MAX_ORIGINAL_FALLBACK_BYTES = 15 * 1024 * 1024; // 15MB

/**
 * Formats technical diagnostic string (max ~80 chars):
 * Error name, truncated message, and detected format from magic-byte detector.
 * E.g. "NotReadableError · format: jpeg" or "EncodingError: ... · format: heic"
 */
export function formatErrorDetail(err: unknown, format: string): string {
  const errObj = err as Record<string, any>;
  const errName = errObj?.name || (err instanceof Error ? err.name : 'Error');
  const rawMsg = String(errObj?.message || (typeof err === 'string' ? err : ''));

  let msgPart = '';
  if (rawMsg && rawMsg !== errName && rawMsg !== 'Empty or unreadable file') {
    const cleanMsg = rawMsg.replace(/\s+/g, ' ').trim();
    if (cleanMsg.length > 40) {
      msgPart = `: ${cleanMsg.slice(0, 37)}...`;
    } else {
      msgPart = `: ${cleanMsg}`;
    }
  }

  const detail = `${errName}${msgPart} · format: ${format}`;
  return detail.length > 80 ? detail.slice(0, 77) + '...' : detail;
}

export function isHeicFile(file: File | { name?: string; type?: string }): boolean {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    type === 'image/heic' ||
    type === 'image/heif' ||
    type.includes('heic') ||
    type.includes('heif')
  );
}

export function useCarImages(showToast: (msg: string) => void) {
  const [imagesList, setImagesList] = useState<FormImageItem[]>([]);
  const [primaryImage, setPrimaryImage] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isAddingFromUrl, setIsAddingFromUrl] = useState(false);
  const [draggedImgIndex, setDraggedImgIndex] = useState<number | null>(null);
  const [dragOverImgIndex, setDragOverImgIndex] = useState<number | null>(null);

  // Revoke any created blob URLs to prevent memory leaks and orphan references
  const cleanupBlobUrls = useCallback((items: FormImageItem[]) => {
    items.forEach(item => {
      if (item.isBlob && item.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.url);
        } catch (e) {}
      }
    });
  }, []);

  const moveImage = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setImagesList(prev => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      setPrimaryImage(updated[0]?.url || '');
      return updated;
    });
  }, []);

  const moveImageLeft = useCallback((index: number) => {
    if (index > 0) moveImage(index, index - 1);
  }, [moveImage]);

  const moveImageRight = useCallback((index: number) => {
    setImagesList(prev => {
      if (index < prev.length - 1) {
        const updated = [...prev];
        const [moved] = updated.splice(index, 1);
        updated.splice(index + 1, 0, moved);
        setPrimaryImage(updated[0]?.url || '');
        return updated;
      }
      return prev;
    });
  }, []);

  const setAsPrimaryImage = useCallback((index: number) => {
    if (index > 0) moveImage(index, 0);
  }, [moveImage]);

  const removeImageAt = useCallback((index: number) => {
    setImagesList(prev => {
      const target = prev[index];
      if (target && target.isBlob && target.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(target.url);
        } catch (e) {}
      }
      const filtered = prev.filter((_, idx) => idx !== index);
      setPrimaryImage(filtered[0]?.url || '');
      return filtered;
    });
  }, []);

  const handleAddImageUrl = useCallback(async () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      alert("Zəhmət olmasa düzgün şəkil linki daxil edin (http:// və ya https:// ilə başlamalıdır)");
      return;
    }

    // Əgər daxil edilən link artıq bizim Supabase Storage-dədirsə
    if (isSupabaseStorageUrl(trimmed)) {
      const newItem: FormImageItem = {
        id: `supa-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        url: trimmed,
        isBlob: false
      };
      setImagesList(prev => {
        const updated = [...prev, newItem];
        if (!primaryImage && updated[0]) setPrimaryImage(updated[0].url);
        return updated;
      });
      setNewImageUrl('');
      showToast("Supabase Storage şəkli əlavə edildi!");
      return;
    }

    // Xarici URL: Arxa fonda fetch edir, Blob kimi endirir, sıxır və birbaşa Supabase Storage 'car-images' / 'CAR-IMAGES' anbarına upload edir
    setIsAddingFromUrl(true);
    showToast("Şəkil linkdən endirilir və Supabase Storage anbarına yüklənir...");

    try {
      // 1. URL-dən şəkli Blob/File formatında endir
      const { blob, mimeType, extension } = await downloadExternalImageAsBlob(trimmed);

      // 2. Unik fayl adı tərtib et: car-[timestamp]-[random].[ext]
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 7);
      const uniqueFileName = `car-${timestamp}-${randomStr}.${extension}`;
      const origFile = new File([blob], uniqueFileName, { type: mimeType });

      // 3. Client-side WebP sıxılmasını təmin et
      let fileToUpload: File = origFile;
      let fileNameToUpload: string = uniqueFileName;
      let compSize = origFile.size;

      try {
        const compRes = await compressImage(origFile, uniqueFileName, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.78
        });
        fileToUpload = compRes.file;
        fileNameToUpload = compRes.file.name;
        compSize = compRes.compressedSize;
      } catch (cErr) {
        console.warn('URL image compression fallback:', cErr);
      }

      // Generate thumbnail from the downloaded ORIGINAL blob (single compression, 800px, quality 0.80)
      let thumbBlob: Blob | undefined;
      try {
        const thumbRes = await createThumbnail(blob, 'thumb.webp', {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.80
        });
        thumbBlob = thumbRes.blob;
      } catch (tErr) {
        console.warn('URL thumbnail generation notice:', tErr);
      }

      // 4. Supabase Storage-ə ('CAR-IMAGES' / 'car-images') birbaşa upload et
      const uploadRes = await uploadImageToSupabaseStorage(fileToUpload, fileNameToUpload);
      if (!uploadRes.success || !uploadRes.publicUrl) {
        throw new Error(uploadRes.error || "Şəkil Supabase Storage anbarına yazıla bilmədi");
      }

      // Generate and upload thumbnail derived from original blob
      uploadThumbnailForImage(
        thumbBlob || fileToUpload, 
        uploadRes.publicUrl,
        { isPreGeneratedThumb: Boolean(thumbBlob) }
      ).catch(thumbErr => {
        console.warn('Background thumbnail creation notice:', thumbErr);
      });

      // 5. Uğurlu upload-dan sonra Supabase Storage-in RƏSMİ PUBLIC URL-ni form siyahısına qeyd et
      const newItem: FormImageItem = {
        id: `supa-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        url: uploadRes.publicUrl,
        isBlob: false,
        compressedSize: compSize,
        isCompressed: true
      };

      setImagesList(prev => {
        const updated = [...prev, newItem];
        if (!primaryImage && updated[0]) setPrimaryImage(updated[0].url);
        return updated;
      });

      setNewImageUrl('');
      showToast("Şəkil uğurla Supabase Storage ('CAR-IMAGES') anbarına yükləndi!");
    } catch (err: unknown) {
      console.error('URL image download/upload error:', err);
      const errMsg = err instanceof Error ? err.message : '';
      const userMessage = errMsg.includes("kompyuterinizdən yükləyin")
        ? errMsg
        : "Bu linkdən şəkli endirmək mümkün olmadı, zəhmət olmasa şəkli kompyuterinizdən yükləyin";
      alert(userMessage);
      showToast(userMessage);
    } finally {
      setIsAddingFromUrl(false);
    }
  }, [newImageUrl, primaryImage, showToast]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);

    // CRITICAL: Read ALL selected files' bytes IMMEDIATELY in parallel BEFORE clearing e.target.value!
    // On mobile (Android Chrome, Samsung Internet), picked files are content-provider handles whose read access
    // can lapse immediately once the input value is cleared. Reading into in-memory ArrayBuffers first guarantees
    // reliable file contents in RAM.
    const readResults = await Promise.allSettled(
      filesArray.map(async (file) => {
        const buffer = await file.arrayBuffer();
        if (!buffer || buffer.byteLength === 0) {
          throw new Error("Empty or unreadable file");
        }
        return {
          buffer,
          size: file.size,
          name: file.name,
          type: file.type
        };
      })
    );

    // ONLY clear the file input after all bytes are safely read into memory:
    e.target.value = '';

    // Create immediate placeholder items for fast UI preview
    const newItems: FormImageItem[] = filesArray.map((file, i) => {
      const readRes = readResults[i];
      const isReadOk = readRes.status === 'fulfilled';
      const buffer = isReadOk ? readRes.value.buffer : null;
      const formatInfo = buffer ? detectImageFormatFromBuffer(buffer) : null;
      const isHeic = formatInfo ? formatInfo.isHeic : isHeicFile(file);

      let blobUrl = '';
      if (isReadOk && buffer && !isHeic) {
        try {
          const blob = new Blob([buffer], { type: formatInfo?.mimeType || file.type || 'image/jpeg' });
          blobUrl = URL.createObjectURL(blob);
        } catch (err) {
          blobUrl = '';
        }
      }

      if (!isReadOk) {
        // True unreadable file error (the ONLY case that triggers the Google Photos / download-to-device message)
        const reason = readRes.status === 'rejected' ? readRes.reason : null;
        const fallbackFormat = file.type ? file.type.replace(/^image\//, '') : (file.name.split('.').pop() || 'unknown').toLowerCase();
        const errorDetail = formatErrorDetail(reason, fallbackFormat);

        return {
          id: `blob-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          url: '',
          fileName: file.name,
          isBlob: true,
          originalSize: file.size,
          isCompressing: false,
          isCompressed: false,
          error: MSG_UNREADABLE_FILE,
          errorType: 'unreadable',
          errorDetail
        };
      }

      return {
        id: `blob-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        url: blobUrl,
        fileName: file.name,
        isBlob: true,
        originalSize: file.size,
        isCompressing: true,
        isCompressed: false
      };
    });

    setImagesList(prev => {
      const updated = [...prev, ...newItems];
      if (!primaryImage) {
        const firstValid = updated.find(it => !it.error && it.url);
        if (firstValid) setPrimaryImage(firstValid.url);
      }
      return updated;
    });

    showToast(`${newItems.length} ədəd şəkil seçildi. Brauzerdə WebP formatına (max 1200px) sıxılır...`);

    let failedCount = 0;
    let successCount = 0;

    // Process and compress each file sequentially from in-memory buffers
    for (let i = 0; i < newItems.length; i++) {
      const currentItem = newItems[i];
      const origFile = filesArray[i];
      const readRes = readResults[i];

      // If file couldn't be read from the start, count as failed and proceed
      if (readRes.status !== 'fulfilled' || currentItem.error) {
        failedCount++;
        continue;
      }

      const buffer = readRes.value.buffer;
      const formatInfo = detectImageFormatFromBuffer(buffer);
      const inMemoryBlob = new Blob([buffer], { type: formatInfo.mimeType || origFile.type || 'image/jpeg' });

      try {
        const compressed = await compressImage(inMemoryBlob, origFile.name, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.78,
          formatInfo
        });

        // Phase 59: Generate thumbnail directly from the ORIGINAL decoded source in-memory blob
        let thumbBlob: Blob | undefined;
        try {
          const thumbRes = await createThumbnail(inMemoryBlob, 'thumb.webp', {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.80,
            formatInfo
          });
          thumbBlob = thumbRes.blob;
        } catch (tErr) {
          console.warn('Pre-generating thumbnail warning:', tErr);
        }

        // Revoke temporary raw blob URL if it was created
        if (currentItem.url && currentItem.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(currentItem.url);
          } catch (err) {}
        }

        successCount++;
        setImagesList(prev => {
          const mapped = prev.map(p => {
            if (p.id === currentItem.id) {
              return {
                ...p,
                url: compressed.previewUrl,
                file: compressed.file, // Holds ONLY the compressed in-memory File
                thumbBlob, // Pre-generated thumbnail Blob from original source
                fileName: compressed.file.name,
                originalSize: origFile.size,
                compressedSize: compressed.compressedSize,
                savedPercent: compressed.savedPercent,
                mimeType: compressed.mimeType,
                isCompressed: true,
                isCompressing: false,
                isFallbackOriginal: false,
                notice: undefined,
                error: undefined,
                errorType: undefined
              };
            }
            return p;
          });

          if (!primaryImage) {
            const firstValid = mapped.find(it => !it.error && it.url);
            if (firstValid) setPrimaryImage(firstValid.url);
          }
          return mapped;
        });
      } catch (cErr: unknown) {
        console.error('Image compress failed for file:', origFile.name, cErr);

        // Revoke temporary raw blob URL if any
        if (currentItem.url && currentItem.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(currentItem.url);
          } catch (err) {}
        }

        // LAYERED FALLBACK:
        // If compression/canvas failed (e.g. canvas memory allocation limit on 108MP camera image or browser canvas bug),
        // but the file bytes are confirmed valid directly uploadable format (JPEG, PNG, WebP, GIF),
        // fall back to uploading the in-memory Blob directly! Never block an admin from uploading a readable photo!
        if (formatInfo.isDirectlyUploadable) {
          // Check size limit for original-bytes fallback (server rejects decoded uploads > 15MB)
          if (inMemoryBlob.size > MAX_ORIGINAL_FALLBACK_BYTES) {
            failedCount++;
            const sizeMb = (inMemoryBlob.size / (1024 * 1024)).toFixed(1);
            const errorMsg = `Şəkil çox böyükdür (${sizeMb} MB). Maksimum 15 MB. Şəkli kiçildin və ya ekran görüntüsü (screenshot) kimi yükləyin.`;
            const errorDetail = `FileSizeError: ${sizeMb}MB > 15MB · format: ${formatInfo.format}`;

            setImagesList(prev => prev.map(p => {
              if (p.id === currentItem.id) {
                return {
                  ...p,
                  url: '',
                  file: undefined,
                  fileName: origFile.name,
                  isCompressing: false,
                  isCompressed: false,
                  error: errorMsg,
                  errorType: 'size',
                  errorDetail
                };
              }
              return p;
            }));
            continue;
          }

          console.warn(`Applying layered fallback for ${origFile.name}: uploading in-memory ${formatInfo.format} directly.`);
          const fallbackFile = new File([inMemoryBlob], origFile.name, {
            type: formatInfo.mimeType,
            lastModified: Date.now()
          });
          const previewUrl = URL.createObjectURL(inMemoryBlob);

          let thumbBlob: Blob | undefined;
          try {
            const thumbRes = await createThumbnail(inMemoryBlob, 'thumb.webp', {
              maxWidth: 800,
              maxHeight: 800,
              quality: 0.80,
              formatInfo
            });
            thumbBlob = thumbRes.blob;
          } catch (tErr) {
            console.warn('Fallback original thumb generation warning:', tErr);
          }

          successCount++;
          setImagesList(prev => {
            const mapped = prev.map(p => {
              if (p.id === currentItem.id) {
                return {
                  ...p,
                  url: previewUrl,
                  file: fallbackFile,
                  thumbBlob,
                  fileName: origFile.name,
                  originalSize: inMemoryBlob.size,
                  compressedSize: inMemoryBlob.size,
                  savedPercent: 0,
                  mimeType: formatInfo.mimeType,
                  isCompressed: true, // Marked as ready so AdminModal save loop proceeds
                  isCompressing: false,
                  isFallbackOriginal: true,
                  notice: "Orijinal formatda saxlanıldı",
                  error: undefined,
                  errorType: undefined,
                  errorDetail: undefined
                };
              }
              return p;
            });

            if (!primaryImage) {
              const firstValid = mapped.find(it => !it.error && it.url);
              if (firstValid) setPrimaryImage(firstValid.url);
            }
            return mapped;
          });
          continue;
        }

        // If it cannot be uploaded directly (e.g. HEIC conversion failed, corrupted format):
        failedCount++;

        let errorMsg = MSG_CORRUPTED_FILE;
        let errorType: 'heic' | 'unreadable' | 'format' | 'general' = 'format';

        if (formatInfo.isHeic || isHeicFile(origFile)) {
          errorMsg = MSG_HEIC_FAILED;
          errorType = 'heic';
        } else if (cErr instanceof Error && cErr.message && !cErr.message.includes('Naməlum')) {
          errorMsg = cErr.message;
          errorType = 'general';
        }

        const errorDetail = formatErrorDetail(cErr, formatInfo.format);

        setImagesList(prev => prev.map(p => {
          if (p.id === currentItem.id) {
            return {
              ...p,
              url: '', // Clear URL so broken image doesn't display
              file: undefined, // Drop file completely so save loop won't upload it
              fileName: origFile.name,
              isCompressing: false,
              isCompressed: false,
              error: errorMsg,
              errorType,
              errorDetail
            };
          }
          return p;
        }));
      }
    }

    // Inform admin via toast about results at selection time
    if (failedCount > 0) {
      if (failedCount === 1) {
        showToast('Diqqət: 1 şəkil emal edilə bilmədi. Zəhmət olmasa xətalı şəkli silin və ya yenidən seçin.');
      } else {
        showToast(`Diqqət: ${failedCount} ədəd şəkil emal edilə bilmədi. Zəhmət olmasa xətalı şəkilləri silin və ya yenidən seçin.`);
      }
    } else if (successCount > 0) {
      showToast(`${successCount} ədəd şəkil uğurla hazırlandı.`);
    }
  }, [primaryImage, showToast]);

  return {
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
  };
}
