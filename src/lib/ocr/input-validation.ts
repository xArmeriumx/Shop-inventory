import { detectMimeTypeFromBuffer } from '@/lib/upload/magic-bytes';

export const MAX_OCR_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_OCR_TEXT_CHARS = 20000;
export const ALLOWED_OCR_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export type OcrImageValidationResult =
  | { ok: true; mime: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string; sizeBytes: number }
  | { ok: false; error: string };

/**
 * Validate base64 image data for OCR endpoints.
 * @param base64Data Base64 string (can include data URI prefix)
 * @returns Result object containing status, parsed mime, and pure base64
 */
export function validateOcrImageBase64(base64Data: string): OcrImageValidationResult {
  if (!base64Data || typeof base64Data !== 'string') {
    return { ok: false, error: 'กรุณาอัพโหลดรูปภาพ' };
  }

  // Strip prefix if present
  const base64Content = base64Data.includes('base64,') 
    ? base64Data.split('base64,')[1] 
    : base64Data;

  // Approximate size in bytes: (length * 3/4) - padding
  const sizeBytes = Math.floor((base64Content.length * 3) / 4);
  if (sizeBytes > MAX_OCR_IMAGE_BYTES) {
    return { ok: false, error: `ขนาดรูปภาพเกิน 5MB (ขนาดประเมิน: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB)` };
  }

  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const mime = detectMimeTypeFromBuffer(new Uint8Array(buffer));
    
    if (!mime || !ALLOWED_OCR_MIME.includes(mime)) {
      return { ok: false, error: 'รูปแบบรูปภาพไม่ถูกต้อง รองรับเฉพาะ JPEG, PNG, WEBP เท่านั้น' };
    }
    
    return { ok: true, mime: mime as 'image/jpeg' | 'image/png' | 'image/webp', base64: base64Content, sizeBytes };
  } catch (error) {
    return { ok: false, error: 'ข้อมูลรูปภาพไม่ถูกต้อง' };
  }
}

/**
 * Validate text input for OCR extract endpoints.
 */
export function validateOcrText(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return 'ไม่มีข้อมูลข้อความ';
  }

  if (text.length > MAX_OCR_TEXT_CHARS) {
    return `ข้อความยาวเกินไป (สูงสุด ${MAX_OCR_TEXT_CHARS} ตัวอักษร)`;
  }

  return null;
}
