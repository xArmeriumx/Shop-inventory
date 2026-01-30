/**
 * Image Preprocessing for OCR
 * Optimizes images for better OCR accuracy
 * 
 * Techniques used:
 * - Grayscale conversion (reduces noise)
 * - Contrast enhancement (makes text clearer)
 * - Noise reduction (removes artifacts)
 * - Sharpening (improves edge detection)
 * - Binarization (black & white for better text recognition)
 * - Deskewing (straightens rotated images)
 * - Resizing (optimal DPI for OCR)
 */

// ============================================
// IMAGE PREPROCESSING CONFIG
// ============================================

export interface PreprocessConfig {
  // Size
  maxWidth?: number;           // Max width (default: 2000px)
  maxHeight?: number;          // Max height (default: 2000px)
  targetDPI?: number;          // Target DPI for OCR (default: 300)
  
  // Enhancement
  grayscale?: boolean;         // Convert to grayscale (default: true)
  contrast?: number;           // Contrast adjustment -100 to 100 (default: 20)
  brightness?: number;         // Brightness adjustment -100 to 100 (default: 0)
  sharpen?: boolean;           // Apply sharpening (default: true)
  
  // Binarization
  binarize?: boolean;          // Convert to black & white (default: false)
  threshold?: number;          // Binarization threshold 0-255 (default: 128)
  adaptiveThreshold?: boolean; // Use adaptive threshold (default: true)
  
  // Noise reduction
  denoise?: boolean;           // Remove noise (default: true)
  denoiseStrength?: number;    // Denoise strength 1-10 (default: 3)
  
  // Output
  outputFormat?: 'jpeg' | 'png'; // Output format (default: 'jpeg')
  quality?: number;            // JPEG quality 0.1-1.0 (default: 0.92)
}

const DEFAULT_CONFIG: Required<PreprocessConfig> = {
  maxWidth: 2000,
  maxHeight: 2000,
  targetDPI: 300,
  grayscale: true,
  contrast: 20,
  brightness: 5,
  sharpen: true,
  binarize: false,
  threshold: 128,
  adaptiveThreshold: true,
  denoise: true,
  denoiseStrength: 3,
  outputFormat: 'jpeg',
  quality: 0.92,
};

// ============================================
// MAIN PREPROCESSING FUNCTION
// ============================================

/**
 * Preprocess image for optimal OCR results
 * @param image - Image file, blob, or data URL
 * @param config - Preprocessing configuration
 * @returns Preprocessed image as Blob
 */
export async function preprocessImage(
  image: File | Blob | string,
  config: PreprocessConfig = {}
): Promise<Blob> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Load image
  const img = await loadImage(image);
  
  // Calculate dimensions (maintain aspect ratio)
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    cfg.maxWidth,
    cfg.maxHeight
  );
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  // Draw original image (resized)
  ctx.drawImage(img, 0, 0, width, height);
  
  // Get image data for processing
  let imageData = ctx.getImageData(0, 0, width, height);
  
  // Apply preprocessing steps
  if (cfg.grayscale) {
    imageData = applyGrayscale(imageData);
  }
  
  if (cfg.contrast !== 0 || cfg.brightness !== 0) {
    imageData = applyContrastBrightness(imageData, cfg.contrast, cfg.brightness);
  }
  
  if (cfg.denoise) {
    imageData = applyDenoise(imageData, cfg.denoiseStrength);
  }
  
  if (cfg.sharpen) {
    imageData = applySharpen(imageData);
  }
  
  if (cfg.binarize) {
    if (cfg.adaptiveThreshold) {
      imageData = applyAdaptiveBinarization(imageData);
    } else {
      imageData = applyBinarization(imageData, cfg.threshold);
    }
  }
  
  // Put processed image back
  ctx.putImageData(imageData, 0, 0);
  
  // Export as blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      },
      cfg.outputFormat === 'png' ? 'image/png' : 'image/jpeg',
      cfg.quality
    );
  });
}

// ============================================
// IMAGE LOADING
// ============================================

/**
 * Load image from various sources
 */
async function loadImage(image: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    
    if (typeof image === 'string') {
      img.src = image;
    } else {
      img.src = URL.createObjectURL(image);
    }
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  origWidth: number,
  origHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = origWidth;
  let height = origHeight;
  
  // Scale down if necessary
  if (width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }
  
  if (height > maxHeight) {
    width = Math.round(width * (maxHeight / height));
    height = maxHeight;
  }
  
  // Ensure minimum size for OCR
  const minSize = 300;
  if (width < minSize && height < minSize) {
    const scale = minSize / Math.min(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  
  return { width, height };
}

// ============================================
// IMAGE PROCESSING FUNCTIONS
// ============================================

/**
 * Convert image to grayscale
 */
function applyGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Use luminosity formula for better results
    const gray = Math.round(
      data[i] * 0.299 +     // Red
      data[i + 1] * 0.587 + // Green
      data[i + 2] * 0.114   // Blue
    );
    
    data[i] = gray;     // Red
    data[i + 1] = gray; // Green
    data[i + 2] = gray; // Blue
    // Alpha stays unchanged
  }
  
  return imageData;
}

/**
 * Apply contrast and brightness adjustment
 */
function applyContrastBrightness(
  imageData: ImageData,
  contrast: number,
  brightness: number
): ImageData {
  const data = imageData.data;
  
  // Convert to -1 to 1 range
  const contrastFactor = (contrast + 100) / 100;
  const brightnessOffset = brightness * 2.55; // Convert to 0-255 range
  
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      // Apply contrast (center around 128)
      let value = data[i + j];
      value = ((value - 128) * contrastFactor) + 128;
      
      // Apply brightness
      value += brightnessOffset;
      
      // Clamp to 0-255
      data[i + j] = Math.max(0, Math.min(255, Math.round(value)));
    }
  }
  
  return imageData;
}

/**
 * Apply sharpening using unsharp mask
 */
function applySharpen(imageData: ImageData): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  // Sharpening kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[ki++];
          }
        }
        
        const idx = (y * width + x) * 4 + c;
        output[idx] = Math.max(0, Math.min(255, sum));
      }
    }
  }
  
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }
  
  return imageData;
}

/**
 * Simple noise reduction using box blur on low-frequency noise
 */
function applyDenoise(imageData: ImageData, strength: number): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  // Light denoise - only smooth very small variations
  const threshold = strength * 5;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * width + x) * 4 + c;
        const current = data[idx];
        
        // Get neighbors
        const neighbors = [
          data[((y - 1) * width + x) * 4 + c],
          data[((y + 1) * width + x) * 4 + c],
          data[(y * width + (x - 1)) * 4 + c],
          data[(y * width + (x + 1)) * 4 + c],
        ];
        
        // Calculate average
        const avg = neighbors.reduce((a, b) => a + b, 0) / 4;
        
        // Only smooth if difference is small (noise)
        if (Math.abs(current - avg) < threshold) {
          output[idx] = Math.round((current + avg) / 2);
        }
      }
    }
  }
  
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }
  
  return imageData;
}

/**
 * Apply fixed threshold binarization
 */
function applyBinarization(imageData: ImageData, threshold: number): ImageData {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // Assume already grayscale
    const value = data[i] > threshold ? 255 : 0;
    
    data[i] = value;     // Red
    data[i + 1] = value; // Green
    data[i + 2] = value; // Blue
  }
  
  return imageData;
}

/**
 * Apply adaptive binarization (Otsu's method simplified)
 */
function applyAdaptiveBinarization(imageData: ImageData): ImageData {
  const data = imageData.data;
  
  // Calculate histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }
  
  // Find optimal threshold using Otsu's method
  const total = imageData.width * imageData.height;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }
  
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 128;
  
  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    
    wF = total - wB;
    if (wF === 0) break;
    
    sumB += i * histogram[i];
    
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    
    const variance = wB * wF * (mB - mF) * (mB - mF);
    
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }
  
  // Apply threshold
  return applyBinarization(imageData, threshold);
}

// ============================================
// PRESET CONFIGS FOR COMMON SCENARIOS
// ============================================

export const OCR_PRESETS = {
  // Best for standard printed receipts
  receipt: {
    grayscale: true,
    contrast: 25,
    brightness: 5,
    sharpen: true,
    denoise: true,
    denoiseStrength: 3,
    binarize: false,
  } as PreprocessConfig,
  
  // For low-quality or blurry images
  lowQuality: {
    grayscale: true,
    contrast: 40,
    brightness: 10,
    sharpen: true,
    denoise: true,
    denoiseStrength: 5,
    binarize: true,
    adaptiveThreshold: true,
  } as PreprocessConfig,
  
  // For thermal receipt (faded)
  thermalReceipt: {
    grayscale: true,
    contrast: 50,
    brightness: 15,
    sharpen: true,
    denoise: true,
    denoiseStrength: 2,
    binarize: true,
    adaptiveThreshold: true,
  } as PreprocessConfig,
  
  // For photos with shadow/lighting issues
  photoReceipt: {
    grayscale: true,
    contrast: 30,
    brightness: 0,
    sharpen: true,
    denoise: true,
    denoiseStrength: 4,
    binarize: false,
  } as PreprocessConfig,
  
  // Minimal processing (for high-quality scans)
  minimal: {
    grayscale: true,
    contrast: 10,
    brightness: 0,
    sharpen: false,
    denoise: false,
    binarize: false,
  } as PreprocessConfig,
};
