/**
 * OCR Service Factory
 * Easily switch between OCR providers
 */

import type { IOCRProvider, OCRConfig, OCRProviderType, OCRResult } from './types';
import { TesseractProvider } from './providers/tesseract';

// Default config
const DEFAULT_CONFIG: OCRConfig = {
  provider: 'tesseract',
  languages: ['tha', 'eng'],
  preprocess: true,
};

// Provider registry
const providers: Map<OCRProviderType, IOCRProvider> = new Map();

/**
 * Get OCR provider instance
 */
export function getOCRProvider(
  type: OCRProviderType = 'tesseract',
  languages: string[] = ['tha', 'eng']
): IOCRProvider {
  // Check cache
  const cacheKey = `${type}-${languages.join('-')}`;
  
  if (!providers.has(type)) {
    switch (type) {
      case 'tesseract':
        providers.set(type, new TesseractProvider(languages));
        break;
      case 'google-vision':
        // Future: Google Vision provider
        throw new Error('Google Vision provider not implemented yet');
      case 'azure':
        // Future: Azure provider
        throw new Error('Azure provider not implemented yet');
      default:
        throw new Error(`Unknown OCR provider: ${type}`);
    }
  }

  return providers.get(type)!;
}

/**
 * Quick OCR function using default provider
 */
export async function recognizeText(
  image: File | Blob | string,
  config: Partial<OCRConfig> = {}
): Promise<OCRResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const provider = getOCRProvider(finalConfig.provider, finalConfig.languages);
  
  return provider.recognize(image);
}

// Export types
export * from './types';
export * from './providers/tesseract';
