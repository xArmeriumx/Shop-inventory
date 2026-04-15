/**
 * OCR Extract API Route
 * POST /api/ocr/extract - Receive OCR text, extract structured data with AI
 * 
 * Note: OCR is done client-side, server only handles AI extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-guard';
import { extractReceiptData } from '@/lib/ocr/extract-receipt';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request, session) => {
  try {
    const shopId = session?.user?.shopId;
    if (shopId) {
      const rlResult = await checkRateLimit(rateLimiters.ocr, `shop:${shopId}:ocr`);
      if (!rlResult.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'เรียกใช้งาน OCR เกินขีดจำกัด กรุณารอสักครู่ (5 ครั้ง/นาที)',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfterSeconds: Math.ceil((rlResult.reset - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': Math.ceil((rlResult.reset - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': rlResult.limit.toString(),
              'X-RateLimit-Remaining': rlResult.remaining.toString(),
            }
          }
        );
      }
    }

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
});
