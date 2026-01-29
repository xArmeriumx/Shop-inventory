/**
 * OCR Scan API Route
 * POST /api/ocr/scan - Upload receipt image, get extracted data
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recognizeWithTesseract } from '@/lib/ocr/providers/tesseract';
import { extractReceiptData } from '@/lib/ocr/extract-receipt';

export const maxDuration = 60; // Allow longer processing time
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get form data with image
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: JPEG, PNG, WebP' 
      }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 400 });
    }

    // Convert file to base64 for Tesseract
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;

    // Step 1: OCR - Extract text from image
    console.log('[OCR] Starting text recognition...');
    const startOCR = Date.now();
    const ocrResult = await recognizeWithTesseract(base64, ['tha', 'eng']);
    console.log(`[OCR] Completed in ${Date.now() - startOCR}ms, confidence: ${ocrResult.confidence}%`);

    // Check if OCR got any text
    if (!ocrResult.text || ocrResult.text.trim().length < 10) {
      return NextResponse.json({
        success: false,
        error: 'ไม่สามารถอ่านข้อความจากรูปได้ กรุณาลองถ่ายรูปใหม่ให้ชัดขึ้น',
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
      }, { status: 400 });
    }

    // Step 2: AI - Extract structured data
    console.log('[AI] Extracting receipt data...');
    const startAI = Date.now();
    const receiptData = await extractReceiptData(ocrResult.text);
    console.log(`[AI] Completed in ${Date.now() - startAI}ms`);

    // Return result
    return NextResponse.json({
      success: true,
      data: receiptData,
      ocr: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
      },
      processingTime: {
        ocr: ocrResult.processingTime,
        ai: Date.now() - startAI,
        total: Date.now() - startOCR,
      },
    });

  } catch (error: any) {
    console.error('[OCR API Error]', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล',
    }, { status: 500 });
  }
}
