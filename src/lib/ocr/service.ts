/**
 * OCR Service - Main orchestrator
 * Handles document scanning with strategy pattern and fault tolerance
 */

import { groq } from '@/lib/groq';
import { getStrategy, DocumentType, ScanResult } from './strategies';

// Vision models with fallback
const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',    // Primary: Fast
  'meta-llama/llama-4-maverick-17b-128e-instruct', // Fallback: Smarter
];

/**
 * Check if error is rate limit related
 */
function isRateLimitError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.response?.status;
  return status === 429 || 
         message.includes('rate limit') || 
         message.includes('quota') ||
         message.includes('too many requests');
}

/**
 * Check if error is JSON validation error with recoverable data
 */
function isJsonValidationError(error: any): boolean {
  return error?.error?.error?.code === 'json_validate_failed' &&
         error?.error?.error?.failed_generation;
}

/**
 * Try to fix and parse malformed JSON
 */
function tryFixMalformedJson(jsonStr: string): any | null {
  try {
    return JSON.parse(jsonStr);
  } catch {
    let fixed = jsonStr;
    
    // Fix malformed date
    fixed = fixed.replace(/"date":\s*"(\d{4}-\d{2})-\{?"?(\d{1,2})"?\]?\]?/g, '"date": "$1-$2"');
    
    // Fix trailing commas
    fixed = fixed.replace(/,\s*}/g, '}');
    fixed = fixed.replace(/,\s*]/g, ']');
    
    try {
      return JSON.parse(fixed);
    } catch {
      const jsonMatch = fixed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

export interface ScanOptions {
  /** Document type - determines which strategy/prompt to use */
  documentType: DocumentType;
  /** Image as base64 string */
  imageBase64: string;
  /** MIME type of the image */
  mimeType: string;
}

/**
 * Main OCR Service class
 */
export class OCRService {
  
  /**
   * Scan a document and extract structured data
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    const { documentType, imageBase64, mimeType } = options;
    const startTime = Date.now();
    
    // Get strategy for document type
    const strategy = getStrategy(documentType);
    const prompt = strategy.getPrompt();
    
    // Build image URL
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;
    
    let response;
    let usedModel = VISION_MODELS[0];
    let fallbackUsed = false;
    let recovered = false;

    // Try each model with fallback
    for (let i = 0; i < VISION_MODELS.length; i++) {
      try {
        usedModel = VISION_MODELS[i];
        console.log(`[OCR Service] Trying model: ${usedModel}`);
        
        response = await groq.chat.completions.create({
          model: usedModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        });
        
        break; // Success
        
      } catch (error: any) {
        // Handle rate limit - try next model
        if (isRateLimitError(error) && i < VISION_MODELS.length - 1) {
          console.log(`[OCR Service] Rate limited on ${usedModel}, falling back...`);
          fallbackUsed = true;
          continue;
        }
        
        // Handle JSON validation error - try to recover
        if (isJsonValidationError(error)) {
          const failedGeneration = error?.error?.error?.failed_generation;
          console.log('[OCR Service] Attempting to recover from malformed JSON...');
          
          const recoveredData = tryFixMalformedJson(failedGeneration);
          if (recoveredData) {
            console.log('[OCR Service] Successfully recovered JSON');
            recovered = true;
            
            let confidence = recoveredData.confidence || 70;
            if (confidence > 0 && confidence <= 1) {
              confidence = Math.round(confidence * 100);
            }
            
            return {
              success: true,
              data: {
                ...strategy.getDefaults(),
                ...recoveredData,
              },
              confidence,
              documentType,
              processingTime: Date.now() - startTime,
              model: usedModel,
              recovered: true,
            };
          }
        }
        
        // Re-throw if can't handle
        throw error;
      }
    }

    // Check if we got a response
    if (!response) {
      return {
        success: false,
        data: null,
        confidence: 0,
        documentType,
      };
    }

    // Parse response
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return {
        success: false,
        data: null,
        confidence: 0,
        documentType,
      };
    }

    let extracted;
    try {
      extracted = JSON.parse(content);
    } catch (e) {
      console.error('[OCR Service] JSON parse error:', content);
      return {
        success: false,
        data: null,
        confidence: 0,
        documentType,
      };
    }

    // Normalize confidence
    let confidence = extracted.confidence || 85;
    if (confidence > 0 && confidence <= 1) {
      confidence = Math.round(confidence * 100);
    }

    // Validate data
    const isValid = strategy.validate(extracted);
    
    return {
      success: isValid,
      data: {
        ...strategy.getDefaults(),
        ...extracted,
      },
      confidence,
      documentType,
      processingTime: Date.now() - startTime,
      model: usedModel,
      recovered,
    };
  }
}

// Export singleton instance
export const ocrService = new OCRService();
