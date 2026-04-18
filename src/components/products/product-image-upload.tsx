'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { X, Loader2, Star, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadToStorage, PRODUCTS_BUCKET } from '@/lib/supabase-browser';

// ==================== Types ====================
interface ProductImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

// ==================== Constants ====================
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

// ==================== Image Compression ====================
async function compressImage(file: File): Promise<File> {
  // Skip compression for small JPEGs
  if (file.size <= 5 * 1024 * 1024 && file.type === 'image/jpeg') {
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
        
        // Resize if needed
        if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(file); // Fallback to original
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              resolve(file); // Fallback to original
            }
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      } catch {
        cleanup();
        resolve(file);
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(file); // Fallback to original
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

  // Direct upload handler - bypasses Vercel limits
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
        setProgress(`กำลังประมวลผล ${i + 1}/${toUpload.length}...`);
        
        // Compress image
        const fileToUpload = await compressImage(originalFile);

        setProgress(`กำลังอัพโหลด ${i + 1}/${toUpload.length}...`);
        
        // Direct upload to Supabase (no Vercel limit!)
        const result = await uploadToStorage(
          fileToUpload,
          PRODUCTS_BUCKET,
          'product-images'
        );

        if ('error' in result) {
          throw new Error(result.error);
        }

        uploaded.push(result.url);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'อัพโหลดไม่สำเร็จ');
        break;
      }
    }

    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
      if (uploaded.length === toUpload.length) {
        setError(null);
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
            
            {index === 0 && (
              <div className="absolute top-1.5 left-1.5 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-current" />
                หลัก
              </div>
            )}

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

      {isUploading && progress && (
        <p className="text-sm text-muted-foreground text-center">{progress}</p>
      )}

      {error && (
        <div className="flex items-center justify-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg p-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {value.length}/{maxImages} รูป • แตะรูปเพื่อจัดการ
      </p>
    </div>
  );
}
