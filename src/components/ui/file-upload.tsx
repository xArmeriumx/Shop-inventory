'use client';

import { useState, useRef } from 'react';
import { X, FileImage, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { uploadToStorage, RECEIPTS_BUCKET } from '@/lib/supabase-browser';

interface FileUploadProps {
  value?: string;
  onChange: (url: string | null) => void;
  folder?: string;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  value,
  onChange,
  folder = 'misc',
  className,
  disabled = false,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }

    try {
      // Direct upload to Supabase (no Vercel limit!)
      const result = await uploadToStorage(file, RECEIPTS_BUCKET, folder);

      if ('error' in result) {
        throw new Error(result.error);
      }

      onChange(result.url);
      setPreview(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัพโหลดไม่สำเร็จ');
      setPreview(null);
      onChange(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Receipt preview"
            className="max-w-[200px] max-h-[150px] object-contain rounded-lg border"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-full h-20 border-dashed"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              กำลังอัปโหลด...
            </>
          ) : (
            <>
              <FileImage className="h-5 w-5 mr-2" />
              แนบหลักฐาน (optional)
            </>
          )}
        </Button>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
