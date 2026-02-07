/**
 * OCR Strategy Interface
 * Each document type has its own strategy with specific prompts
 */

export type DocumentType = 'receipt' | 'purchase' | 'invoice' | 'shipment';

export interface ScanResult {
  success: boolean;
  data: any;
  confidence: number;
  documentType: DocumentType;
  processingTime?: number;
  model?: string;
  recovered?: boolean;
}

export interface OCRStrategy {
  /**
   * Document type this strategy handles
   */
  documentType: DocumentType;
  
  /**
   * Get the prompt for this document type
   */
  getPrompt(): string;
  
  /**
   * Validate extracted data
   */
  validate(data: any): boolean;
  
  /**
   * Get default values for missing fields
   */
  getDefaults(): Partial<any>;
}
