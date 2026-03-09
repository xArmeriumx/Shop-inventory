/**
 * Unified OCR Scan API
 * Single endpoint for all document types (receipt, purchase, invoice)
 * Uses Vision AI (Llama 4) with strategy pattern
 * 
 * POST /api/ocr/scan
 * Body: { imageBase64, mimeType, documentType }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ocrService } from '@/lib/ocr/service';
import { DocumentType } from '@/lib/ocr/strategies';

export const maxDuration = 30; // Allow up to 30 seconds for Vision OCR

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType, documentType = 'receipt' } = body;

    // Validate required fields
    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: 'Missing imageBase64' },
        { status: 400 }
      );
    }

    // Validate document type
    const validDocTypes: DocumentType[] = ['receipt', 'purchase', 'invoice', 'shipment', 'sale'];
    if (!validDocTypes.includes(documentType)) {
      return NextResponse.json(
        { success: false, error: `Invalid documentType. Must be one of: ${validDocTypes.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[OCR API] Scanning ${documentType} document...`);

    // Call OCR service
    const result = await ocrService.scan({
      documentType,
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to extract data from document',
          data: result.data,
        },
        { status: 422 }
      );
    }

    console.log(`[OCR API] Success! Confidence: ${result.confidence}%`);

    return NextResponse.json({
      success: true,
      data: result.data,
      confidence: result.confidence,
      documentType: result.documentType,
      processingTime: result.processingTime,
      model: result.model,
      recovered: result.recovered,
    });

  } catch (error: any) {
    console.error('[OCR API] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'OCR processing failed',
      },
      { status: 500 }
    );
  }
}
