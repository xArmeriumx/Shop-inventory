'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Camera, X, Loader2, Star, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== Types ====================
interface ProductImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

// ==================== Constants ====================
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

// ==================== Image Compression ====================
async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_FILE_SIZE && file.type === 'image/jpeg') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    
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
          reject(new Error('Canvas error'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(img.src);
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
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

  // Upload handler
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const slots = maxImages - value.length;
    const toUpload = files.slice(0, slots);
    
    setError(null);
    setIsUploading(true);
    
    const uploaded: string[] = [];

    for (let i = 0; i < toUpload.length; i++) {
      try {
        setProgress(`กำลังอัพโหลด ${i + 1}/${toUpload.length}...`);
        
        // Compress
        const compressed = await compressImage(toUpload[i]);
        
        // Upload
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('folder', 'product-images');
        formData.append('bucket', 'products');

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'อัพโหลดไม่สำเร็จ');
        }

        const data = await res.json();
        if (data.url) uploaded.push(data.url);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        break;
      }
    }

    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
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

      {/* Image Grid - Simple and Clean */}
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

            {/* Simple Overlay - Tap to see actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
              {/* Set as Primary */}
              {index !== 0 && !disabled && (
                <button
                  type="button"
                  onClick={() => setAsPrimary(index)}
                  className="w-full py-1.5 bg-white text-black text-xs font-medium rounded-lg"
                >
                  ตั้งเป็นหลัก
                </button>
              )}
              
              {/* Delete */}
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

        {/* Add Button - Big and Simple */}
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

      {/* Status */}
      {isUploading && progress && (
        <p className="text-sm text-muted-foreground text-center">{progress}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}

      {/* Helper */}
      <p className="text-xs text-muted-foreground text-center">
        {value.length}/{maxImages} รูป • แตะรูปเพื่อจัดการ
      </p>
    </div>
  );
}
