/**
 * OCR Service Types
 * Provider Pattern for easy switching between OCR providers
 */

// OCR Provider Interface - implement this for new providers
export interface IOCRProvider {
  name: string;
  recognize(image: File | Blob | string): Promise<OCRResult>;
}

// OCR Result from any provider
export interface OCRResult {
  text: string;
  confidence: number; // 0-100
  lines: OCRLine[];
  words: OCRWord[];
  processingTime: number; // ms
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// Receipt extraction result from AI
export interface ReceiptData {
  // Basic info
  vendor: string | null;
  vendorAddress: string | null;
  vendorPhone: string | null;
  taxId: string | null;
  
  // Transaction info
  date: string | null; // ISO format
  time: string | null;
  receiptNumber: string | null;
  
  // Items (for detailed receipts)
  items: ReceiptItem[];
  
  // Totals
  subtotal: number | null;
  taxAmount: number | null;
  discount: number | null;
  total: number;
  
  // Payment
  paymentMethod: string | null;
  
  // Suggested category for expense
  suggestedCategory: string | null;
  
  // Raw OCR text for reference
  rawText: string;
  
  // Confidence score
  confidence: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// OCR Provider types
export type OCRProviderType = 'tesseract' | 'google-vision' | 'azure';

// OCR Service config
export interface OCRConfig {
  provider: OCRProviderType;
  languages: string[]; // ['tha', 'eng']
  preprocess: boolean; // Image preprocessing
}
