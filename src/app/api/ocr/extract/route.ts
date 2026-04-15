/**
 * OCR Extract API Route
 * POST /api/ocr/extract - Receive OCR text, extract structured data with AI
 * 
 * Note: OCR is done client-side, server only handles AI extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-guard';
import { extractReceiptData } from '@/lib/ocr/extract-receipt';


export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, session) => {
  try {

    // Get OCR text from request
    const body = await request.json();
    const { ocrText, ocrConfidence } = body;
    
    if (!ocrText || typeof ocrText !== 'string') {
      return NextResponse.json({ error: 'No OCR text provided' }, { status: 400 });
    }

    if (ocrText.trim().length < 5) {
      return NextResponse.json({
        success: false,
        error: 'ข้อความที่อ่านได้สั้นเกินไป กรุณาลองถ่ายรูปใหม่ให้ชัดขึ้น',
      }, { status: 400 });
    }

    // Extract structured data using AI
    console.log('[AI] Extracting receipt data...');
    const startAI = Date.now();
    const receiptData = await extractReceiptData(ocrText);
    console.log(`[AI] Completed in ${Date.now() - startAI}ms`);

    // Return result
    return NextResponse.json({
      success: true,
      data: receiptData,
      processingTime: Date.now() - startAI,
    });

  } catch (error: any) {
    console.error('[OCR Extract API Error]', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล',
    }, { status: 500 });
  }
}, { rateLimitPolicy: 'ocr' });
