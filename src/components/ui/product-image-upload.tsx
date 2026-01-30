'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { X, Loader2, Star, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== Types ====================
interface ProductImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

// ==================== Constants ====================
// Vercel Free Plan limit: 4.5MB - we target 3MB for safety
const UPLOAD_SIZE_LIMIT = 3 * 1024 * 1024; // 3MB max after compression
const MAX_DIMENSION = 1200; // Smaller for faster upload
const INITIAL_QUALITY = 0.8;
const MIN_QUALITY = 0.4; // Min quality for aggressive compression

// ==================== Aggressive Image Compression ====================
async function compressImage(file: File): Promise<File> {
  // If already under limit and JPEG, return as-is
  if (file.size <= UPLOAD_SIZE_LIMIT && file.type === 'image/jpeg') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    
    const cleanup = () => {
      try { URL.revokeObjectURL(img.src); } catch {}
    };

    img.onload = () => {
      try {
        let { naturalWidth: w, naturalHeight: h } = img;
        
        // Aggressively resize large images
        const maxDim = MAX_DIMENSION;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          // Fallback: return original file
          resolve(file);
          return;
        }

        // White background for transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        // Try progressively lower quality until under limit
        const tryCompress = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              cleanup();
              
              if (!blob) {
                // Fallback: return original file
                resolve(file);
                return;
              }

              // If still too large and can reduce quality more
              if (blob.size > UPLOAD_SIZE_LIMIT && quality > MIN_QUALITY) {
                tryCompress(quality - 0.1);
                return;
              }

              // Still too large after max compression? Resize more
              if (blob.size > UPLOAD_SIZE_LIMIT && w > 800) {
                // Re-draw at smaller size
                const smallerCanvas = document.createElement('canvas');
                const newW = Math.round(w * 0.7);
                const newH = Math.round(h * 0.7);
                smallerCanvas.width = newW;
                smallerCanvas.height = newH;
                const smallCtx = smallerCanvas.getContext('2d');
                if (smallCtx) {
                  smallCtx.fillStyle = '#FFFFFF';
                  smallCtx.fillRect(0, 0, newW, newH);
                  smallCtx.drawImage(canvas, 0, 0, newW, newH);
                  smallerCanvas.toBlob(
                    (smallBlob) => {
                      if (smallBlob && smallBlob.size <= UPLOAD_SIZE_LIMIT) {
                        resolve(new File([smallBlob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                      } else {
                        // Give up and return what we have
                        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                      }
                    },
                    'image/jpeg',
                    MIN_QUALITY
                  );
                  return;
                }
              }

              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            },
            'image/jpeg',
            quality
          );
        };

        tryCompress(INITIAL_QUALITY);
        
      } catch (err) {
        cleanup();
        // On any error, return original file and let server handle it
        resolve(file);
      }
    };

    img.onerror = () => {
      cleanup();
      // Can't load image, return original
      resolve(file);
    };
    
    try {
      img.src = URL.createObjectURL(file);
    } catch {
      resolve(file);
    }
  });
}

// ==================== Main Component ====================
export function ProductImageUpload({
  value = [],
  onChange,
  maxImages = 5,
  disabled = false,
}: ProductImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = value.length < maxImages && !disabled && !isUploading;

  // Upload handler with robust error handling
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const slots = maxImages - value.length;
    const toUpload = files.slice(0, slots);
    
    setError(null);
    setIsUploading(true);
    
    const uploaded: string[] = [];

    for (let i = 0; i < toUpload.length; i++) {
      const originalFile = toUpload[i];
      
      try {
        setProgress(`กำลังบีบอัดรูป ${i + 1}/${toUpload.length}...`);
        
        // Compress image
        let fileToUpload: File;
        try {
          fileToUpload = await compressImage(originalFile);
        } catch {
          // If compression fails completely, skip this file
          setError(`ไม่สามารถประมวลผลรูป "${originalFile.name}" ได้`);
          continue;
        }

        // Check if still too large
        if (fileToUpload.size > UPLOAD_SIZE_LIMIT) {
          setError(`รูป "${originalFile.name}" ใหญ่เกินไป (${(fileToUpload.size / 1024 / 1024).toFixed(1)}MB) กรุณาใช้รูปที่เล็กกว่านี้`);
          continue;
        }

        setProgress(`กำลังอัพโหลดรูป ${i + 1}/${toUpload.length}...`);
        
        // Upload with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
          const formData = new FormData();
          formData.append('file', fileToUpload);
          formData.append('folder', 'product-images');
          formData.append('bucket', 'products');

          const res = await fetch('/api/upload', { 
            method: 'POST', 
            body: formData,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          // Handle specific HTTP errors
          if (res.status === 413) {
            setError('ไฟล์ใหญ่เกินไป กรุณาใช้รูปที่เล็กกว่า 3MB');
            continue;
          }

          if (res.status === 401) {
            setError('กรุณาเข้าสู่ระบบใหม่');
            break;
          }
          
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Error ${res.status}`);
          }

          const data = await res.json();
          if (data.url) {
            uploaded.push(data.url);
          }
          
        } catch (err: any) {
          clearTimeout(timeoutId);
          
          if (err.name === 'AbortError') {
            setError('หมดเวลาเชื่อมต่อ กรุณาลองใหม่');
          } else {
            setError(err.message || 'อัพโหลดไม่สำเร็จ');
          }
          break;
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        break;
      }
    }

    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
      if (uploaded.length === toUpload.length) {
        setError(null); // Clear any previous errors if all succeeded
      }
    }
    
    setIsUploading(false);
    setProgress('');
  }, [value, maxImages, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const setAsPrimary = (index: number) => {
    if (index === 0) return;
    const newImages = [...value];
    const [selected] = newImages.splice(index, 1);
    newImages.unshift(selected);
    onChange(newImages);
  };

  return (
    <div className="space-y-3">
      {/* Hidden Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={!canAddMore}
      />

      {/* Image Grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Uploaded Images */}
        {value.map((url, index) => (
          <div
            key={url}
            className={cn(
              'relative aspect-square rounded-xl overflow-hidden',
              'border-2 group',
              index === 0 ? 'border-primary' : 'border-transparent'
            )}
          >
            <Image
              src={url}
              alt={`รูป ${index + 1}`}
              fill
              className="object-cover"
              sizes="33vw"
            />
            
            {/* Primary Badge */}
            {index === 0 && (
              <div className="absolute top-1.5 left-1.5 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-current" />
                หลัก
              </div>
            )}

            {/* Overlay Controls */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
              {index !== 0 && !disabled && (
                <button
                  type="button"
                  onClick={() => setAsPrimary(index)}
                  className="w-full py-1.5 bg-white text-black text-xs font-medium rounded-lg"
                >
                  ตั้งเป็นหลัก
                </button>
              )}
              
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="w-full py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1"
                >
                  <X className="h-3 w-3" />
                  ลบ
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add Button */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30',
              'flex flex-col items-center justify-center gap-1',
              'text-muted-foreground hover:border-primary hover:text-primary',
              'transition-colors active:scale-95'
            )}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <Plus className="h-8 w-8" />
                <span className="text-xs">เพิ่มรูป</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Progress */}
      {isUploading && progress && (
        <p className="text-sm text-muted-foreground text-center">{progress}</p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center justify-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg p-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Helper */}
      <p className="text-xs text-muted-foreground text-center">
        {value.length}/{maxImages} รูป • รูปจะถูกบีบอัดอัตโนมัติ
      </p>
    </div>
  );
}
