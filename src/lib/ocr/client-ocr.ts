'use client';

/**
 * Client-side OCR using Tesseract.js
 * Runs in browser, not server
 */

import Tesseract from 'tesseract.js';

export interface ClientOCRResult {
  text: string;
  confidence: number;
  processingTime: number;
}

/**
 * Perform OCR on an image file
 * This runs entirely in the browser
 */
export async function recognizeImage(
  image: File | Blob | string,
  languages: string[] = ['tha', 'eng'],
  onProgress?: (progress: number) => void
): Promise<ClientOCRResult> {
  const startTime = Date.now();

  try {
    const result = await Tesseract.recognize(image, languages.join('+'), {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('ไม่สามารถอ่านข้อความจากรูปได้');
  }
}
