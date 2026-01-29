/**
 * Tesseract.js OCR Provider
 * Free, runs in browser/server
 */

import Tesseract from 'tesseract.js';
import type { IOCRProvider, OCRResult, OCRLine, OCRWord } from '../types';

export class TesseractProvider implements IOCRProvider {
  name = 'tesseract';
  private languages: string[];

  constructor(languages: string[] = ['tha', 'eng']) {
    this.languages = languages;
  }

  /**
   * Recognize text from image
   */
  async recognize(image: File | Blob | string): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // Convert File to appropriate format
      let imageData: string | Blob;
      if (image instanceof File) {
        imageData = image;
      } else if (typeof image === 'string') {
        imageData = image;
      } else {
        imageData = image;
      }

      const result = await Tesseract.recognize(imageData, this.languages.join('+'));
      const data = result.data as any;

      // Map Tesseract result to our format
      const lines: OCRLine[] = (data.lines || []).map((line: any) => ({
        text: String(line.text || '').trim(),
        confidence: Number(line.confidence) || 0,
        bbox: {
          x0: line.bbox?.x0 || 0,
          y0: line.bbox?.y0 || 0,
          x1: line.bbox?.x1 || 0,
          y1: line.bbox?.y1 || 0,
        },
      }));

      const words: OCRWord[] = (data.words || []).map((word: any) => ({
        text: String(word.text || '').trim(),
        confidence: Number(word.confidence) || 0,
        bbox: {
          x0: word.bbox?.x0 || 0,
          y0: word.bbox?.y0 || 0,
          x1: word.bbox?.x1 || 0,
          y1: word.bbox?.y1 || 0,
        },
      }));

      return {
        text: String(data.text || '').trim(),
        confidence: Number(data.confidence) || 0,
        lines,
        words,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Tesseract OCR error:', error);
      throw new Error('OCR processing failed');
    }
  }
}

// Quick recognize function (stateless)
export async function recognizeWithTesseract(
  image: File | Blob | string,
  languages: string[] = ['tha', 'eng']
): Promise<OCRResult> {
  const startTime = Date.now();
  
  const result = await Tesseract.recognize(image, languages.join('+'));
  const data = result.data as any;

  return {
    text: String(data.text || '').trim(),
    confidence: Number(data.confidence) || 0,
    lines: (data.lines || []).map((line: any) => ({
      text: String(line.text || '').trim(),
      confidence: Number(line.confidence) || 0,
      bbox: {
        x0: line.bbox?.x0 || 0,
        y0: line.bbox?.y0 || 0,
        x1: line.bbox?.x1 || 0,
        y1: line.bbox?.y1 || 0,
      },
    })),
    words: (data.words || []).map((word: any) => ({
      text: String(word.text || '').trim(),
      confidence: Number(word.confidence) || 0,
      bbox: {
        x0: word.bbox?.x0 || 0,
        y0: word.bbox?.y0 || 0,
        x1: word.bbox?.x1 || 0,
        y1: word.bbox?.y1 || 0,
      },
    })),
    processingTime: Date.now() - startTime,
  };
}
