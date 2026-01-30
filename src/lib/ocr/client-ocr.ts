'use client';

/**
 * Client-side OCR using Tesseract.js
 * Runs in browser, not server
 * 
 * Enhanced with image preprocessing for better accuracy
 */

import Tesseract from 'tesseract.js';
import { preprocessImage, OCR_PRESETS, type PreprocessConfig } from './image-preprocessing';

export interface ClientOCRResult {
  text: string;
  confidence: number;
  processingTime: number;
  preprocessTime?: number;
  ocrTime?: number;
}

export interface ClientOCROptions {
  languages?: string[];
  preprocess?: boolean;
  preprocessConfig?: PreprocessConfig;
  preset?: keyof typeof OCR_PRESETS;
  onProgress?: (progress: number) => void;
}

/**
 * Perform OCR on an image file
 * This runs entirely in the browser
 * 
 * @param image - Image file, blob, or data URL
 * @param options - OCR options including preprocessing
 */
export async function recognizeImage(
  image: File | Blob | string,
  options: ClientOCROptions | string[] = {}
): Promise<ClientOCRResult> {
  const startTime = Date.now();
  
  // Support legacy API (languages array)
  let opts: ClientOCROptions;
  if (Array.isArray(options)) {
    opts = { languages: options };
  } else {
    opts = options;
  }
  
  const {
    languages = ['tha', 'eng'],
    preprocess = true, // Enable by default
    preprocessConfig,
    preset = 'receipt',
    onProgress,
  } = opts;

  try {
    let processedImage: File | Blob | string = image;
    let preprocessTime = 0;
    
    // Apply preprocessing if enabled
    if (preprocess && typeof window !== 'undefined') {
      const preprocessStart = Date.now();
      
      // Use preset or custom config
      const config = preprocessConfig || OCR_PRESETS[preset] || OCR_PRESETS.receipt;
      
      try {
        processedImage = await preprocessImage(image, config);
        preprocessTime = Date.now() - preprocessStart;
        console.log(`[OCR] Preprocessed in ${preprocessTime}ms`);
      } catch (error) {
        console.warn('[OCR] Preprocessing failed, using original image:', error);
        processedImage = image;
      }
    }
    
    const ocrStart = Date.now();
    
    const result = await Tesseract.recognize(processedImage, languages.join('+'), {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    
    const ocrTime = Date.now() - ocrStart;

    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      processingTime: Date.now() - startTime,
      preprocessTime,
      ocrTime,
    };
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('ไม่สามารถอ่านข้อความจากรูปได้');
  }
}

/**
 * Quick OCR with specific preset
 */
export async function recognizeReceipt(
  image: File | Blob | string,
  onProgress?: (progress: number) => void
): Promise<ClientOCRResult> {
  return recognizeImage(image, {
    languages: ['tha', 'eng'],
    preprocess: true,
    preset: 'receipt',
    onProgress,
  });
}

/**
 * OCR for thermal receipts (faded text)
 */
export async function recognizeThermalReceipt(
  image: File | Blob | string,
  onProgress?: (progress: number) => void
): Promise<ClientOCRResult> {
  return recognizeImage(image, {
    languages: ['tha', 'eng'],
    preprocess: true,
    preset: 'thermalReceipt',
    onProgress,
  });
}

/**
 * OCR for low quality or blurry images
 */
export async function recognizeLowQualityImage(
  image: File | Blob | string,
  onProgress?: (progress: number) => void
): Promise<ClientOCRResult> {
  return recognizeImage(image, {
    languages: ['tha', 'eng'],
    preprocess: true,
    preset: 'lowQuality',
    onProgress,
  });
}
