/**
 * Image Compression Utility
 * Client-side compression for OCR optimization
 * 
 * Settings optimized for OCR accuracy:
 * - Quality: 85% (maintains text readability)
 * - Max dimension: 1920px (sufficient for receipts)
 * - Format: JPEG (good compression, wide support)
 */

export interface CompressionOptions {
  /** Max width or height in pixels (default: 1920) */
  maxDimension?: number;
  /** JPEG quality 0-1 (default: 0.85) */
  quality?: number;
  /** Output format (default: 'image/jpeg') */
  format?: 'image/jpeg' | 'image/webp';
}

export interface CompressionResult {
  /** Compressed image as base64 */
  base64: string;
  /** MIME type of the compressed image */
  mimeType: string;
  /** Original file size in bytes */
  originalSize: number;
  /** Compressed file size in bytes */
  compressedSize: number;
  /** Compression ratio (e.g., 0.1 = 90% reduction) */
  compressionRatio: number;
  /** Final dimensions */
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxDimension: 1920,
  quality: 0.85,
  format: 'image/jpeg',
};

/**
 * Compress image for OCR processing
 * @param file - Image file to compress
 * @param options - Compression options
 * @returns Compressed image data
 */
export async function compressImageForOCR(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > opts.maxDimension || height > opts.maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * opts.maxDimension);
          width = opts.maxDimension;
        } else {
          width = Math.round((width / height) * opts.maxDimension);
          height = opts.maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with white background (for transparent PNGs)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed format
      const dataUrl = canvas.toDataURL(opts.format, opts.quality);
      const base64 = dataUrl.split(',')[1];
      
      // Calculate compressed size
      const compressedSize = Math.round((base64.length * 3) / 4);
      const compressionRatio = compressedSize / file.size;

      resolve({
        base64,
        mimeType: opts.format,
        originalSize: file.size,
        compressedSize,
        compressionRatio,
        width,
        height,
      });

      // Cleanup
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if compression is needed
 */
export function needsCompression(file: File, maxSizeKB: number = 500): boolean {
  return file.size > maxSizeKB * 1024;
}
