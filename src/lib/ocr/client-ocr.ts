'use client';

/**
 * Client-side OCR using Tesseract.js
 * Optimized for Thai language and receipts
 * 
 * Enhanced features:
 * - Image preprocessing for better accuracy
 * - Thai-optimized settings
 * - Multiple engine modes
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
  // Thai optimization options
  optimizeForThai?: boolean;
  // Tesseract specific options
  tesseractParams?: TesseractParams;
}

// Tesseract parameters for fine-tuning
export interface TesseractParams {
  // Page Segmentation Mode (0-13)
  psm?: number;
  // OCR Engine Mode (0-3)
  oem?: number;
  // Character whitelist (only recognize these characters)
  tessedit_char_whitelist?: string;
  // Character blacklist (never recognize these characters)
  tessedit_char_blacklist?: string;
  // Preserve interword spaces
  preserve_interword_spaces?: string;
}

// Thai-optimized parameters
const THAI_PARAMS: TesseractParams = {
  // PSM 6 = Assume a single uniform block of text
  // Good for receipts which are mostly single column
  psm: 6,
  // OEM 1 = LSTM only (best for Thai)
  oem: 1,
  // Preserve spaces between words
  preserve_interword_spaces: '1',
};

// Receipt-optimized parameters  
const RECEIPT_PARAMS: TesseractParams = {
  psm: 4, // Assume single column of text of variable sizes
  oem: 1,
  preserve_interword_spaces: '1',
  // Common receipt characters
  tessedit_char_whitelist: 
    // Thai characters
    'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ' +
    'ะัาำิีึืุูเแโใไๅๆ็่้๊๋์ํ๎' +
    '๐๑๒๓๔๕๖๗๘๙' +
    // English and numbers
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
    '0123456789' +
    // Common symbols
    '฿$.,:-/()[]{}#@%&*+=<>"\' \n\t',
};

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
    preprocess = true,
    preprocessConfig,
    preset = 'receipt',
    onProgress,
    optimizeForThai = true,
    tesseractParams,
  } = opts;

  try {
    let processedImage: File | Blob | string = image;
    let preprocessTime = 0;
    
    // Apply preprocessing if enabled
    if (preprocess && typeof window !== 'undefined') {
      const preprocessStart = Date.now();
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
    
    // Use advanced worker for better control
    const result = await recognizeWithOptimizedSettings(
      processedImage,
      languages,
      {
        ...( optimizeForThai ? THAI_PARAMS : {}),
        ...(preset === 'receipt' ? RECEIPT_PARAMS : {}),
        ...tesseractParams,
      },
      onProgress
    );
    
    const ocrTime = Date.now() - ocrStart;

    return {
      text: result.text,
      confidence: result.confidence,
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
 * Recognize with optimized Tesseract settings
 */
async function recognizeWithOptimizedSettings(
  image: File | Blob | string,
  languages: string[],
  params: TesseractParams,
  onProgress?: (progress: number) => void
): Promise<{ text: string; confidence: number }> {
  
  // Build parameters object for Tesseract
  const tesseractParams: Record<string, string> = {};
  
  if (params.tessedit_char_whitelist) {
    tesseractParams['tessedit_char_whitelist'] = params.tessedit_char_whitelist;
  }
  if (params.tessedit_char_blacklist) {
    tesseractParams['tessedit_char_blacklist'] = params.tessedit_char_blacklist;
  }
  if (params.preserve_interword_spaces) {
    tesseractParams['preserve_interword_spaces'] = params.preserve_interword_spaces;
  }
  
  // Use recognize with options
  const result = await Tesseract.recognize(image, languages.join('+'), {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  // Post-process text for better Thai results
  let text = result.data.text.trim();
  text = postProcessThaiText(text);

  return {
    text,
    confidence: result.data.confidence,
  };
}

/**
 * Post-process Thai OCR text
 * Fix common OCR errors specific to Thai
 */
function postProcessThaiText(text: string): string {
  let result = text;
  
  // Common Thai OCR errors
  const corrections: [RegExp, string][] = [
    // Number corrections
    [/[oO](?=\d)/g, '0'],      // O before numbers → 0
    [/(?<=\d)[oO]/g, '0'],     // O after numbers → 0
    [/[lI](?=\d)/g, '1'],      // l/I before numbers → 1
    [/(?<=\d)[lI]/g, '1'],     // l/I after numbers → 1
    
    // Thai character corrections
    [/ก1/g, 'กิ'],             // ก1 → กิ (common error)
    [/เเ/g, 'แ'],              // เเ → แ
    
    // Price/currency cleanup
    [/(\d),(\d{3})/g, '$1$2'], // Remove comma in numbers for parsing
    [/[Bb](\d)/g, '฿$1'],      // B123 → ฿123
    
    // Common receipt words
    [/nวม/g, 'รวม'],
    [/บn/g, 'บาท'],
    [/เงlน/g, 'เงิน'],
    [/สlนค้า/g, 'สินค้า'],
    [/nาคา/g, 'ราคา'],
    [/จำนvน/g, 'จำนวน'],
    [/ทoน/g, 'ทอน'],
    [/nับ/g, 'รับ'],
    
    // Remove multiple spaces
    [/\s+/g, ' '],
    
    // Clean up line breaks
    [/\n\s*\n/g, '\n'],
  ];
  
  for (const [pattern, replacement] of corrections) {
    result = result.replace(pattern, replacement);
  }
  
  return result.trim();
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
    optimizeForThai: true,
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
    optimizeForThai: true,
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
    optimizeForThai: true,
    onProgress,
  });
}
