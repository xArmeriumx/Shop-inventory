/**
 * Vision OCR API Route
 * Uses Llama 4 Vision models with automatic fallback
 * 
 * Primary: Scout (fast)
 * Fallback: Maverick (if rate limited)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-guard';
import { groq } from '@/lib/ai/client';
import type { ReceiptData } from '@/lib/ocr/types';
import { validateOcrImageBase64 } from '@/lib/ocr/input-validation';

// Vision models with fallback order
const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',    // Primary: Fast
  'meta-llama/llama-4-maverick-17b-128e-instruct', // Fallback: Smarter
];

// Enhanced prompt with real receipt example for better accuracy
const VISION_RECEIPT_PROMPT = `คุณเป็นผู้เชี่ยวชาญอ่านใบเสร็จไทย วิเคราะห์ภาพและตอบเป็น JSON

═══════════════════════════════
⚠️ กฎสำคัญ
═══════════════════════════════
1. VAT: ราคาสินค้าในไทย = รวม VAT แล้ว, VAT ที่แยกแสดง = แค่แจ้งให้ทราบ ห้ามบวกเพิ่ม!
2. ชื่อสินค้า: ต้องอ่านชื่อภาษาไทยให้ครบ ห้ามเว้นว่าง!
3. วันที่: แปลง พ.ศ.→ค.ศ. (2569→2026)

═══════════════════════════════
📋 ตัวอย่างที่ 1 (ใบเสร็จอังกฤษ)
═══════════════════════════════
ถ้าเห็น:
"POP MART
TAX ID:0105566128393
2026-01-09 19:05:51
1 6976119961843 MOKOKO Sweetheart... 2,190.00
Totals: 4,880.00"

ตอบ:
{"vendor":"POP MART","items":[{"name":"MOKOKO Sweetheart Series","sku":"6976119961843","quantity":1,"unitPrice":2190,"total":2190}],"total":4880}

═══════════════════════════════
📋 ตัวอย่างที่ 2 (ใบเสร็จไทย)
═══════════════════════════════
ถ้าเห็น:
"KT Dream Power For You
บิลเงินสดCASH SALE
16/1/2026
KT-1688-0052
แบตเตอรี่12V12AH/A+ หน่วยละ B400.00 จำนวน 12 จำนวนเงิน B4,800.00
รวมเงิน B4,800.00"

ตอบ:
{"vendor":"KT Dream Power For You","date":"2026-01-16","receiptNumber":"KT-1688-0052","items":[{"name":"แบตเตอรี่12V12AH/A+","sku":"","quantity":12,"unitPrice":400,"total":4800}],"total":4800,"paymentMethod":"CASH","suggestedCategory":"อื่นๆ"}

⚠️ สังเกต: name="แบตเตอรี่12V12AH/A+" ไม่ใช่ name=""

═══════════════════════════════
📤 JSON Schema
═══════════════════════════════
{
  "vendor":"ชื่อร้าน/บริษัท (ห้ามว่าง)",
  "vendorBranch":"สาขา",
  "vendorAddress":"ที่อยู่",
  "taxId":"เลขภาษี 13 หลัก",
  "date":"YYYY-MM-DD",
  "time":"HH:MM",
  "receiptNumber":"เลขที่ใบเสร็จ",
  "invoiceNumber":"เลขใบกำกับภาษี",
  "items":[{"name":"ชื่อสินค้าภาษาไทย/อังกฤษ (ห้ามว่าง!)","sku":"รหัสสินค้า/บาร์โค้ด","quantity":1,"unitPrice":0,"total":0}],
  "subtotal":0,
  "taxAmount":0,
  "discount":0,
  "total":0,
  "paymentMethod":"CASH|CARD|QR|PROMPTPAY|TRANSFER",
  "cashReceived":0,
  "change":0,
  "suggestedCategory":"อาหาร|เดินทาง|สาธารณูปโภค|สำนักงาน|สินค้า|อื่นๆ",
  "confidence":0-100
}`;

// Check if error is rate limit related
function isRateLimitError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.response?.status;
  return status === 429 ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('too many requests');
}

// Check if error is JSON validation error with recoverable data
function isJsonValidationError(error: any): boolean {
  return error?.error?.error?.code === 'json_validate_failed' &&
    error?.error?.error?.failed_generation;
}

// Try to fix and parse malformed JSON
function tryFixMalformedJson(jsonStr: string): any | null {
  try {
    // Try direct parse first
    return JSON.parse(jsonStr);
  } catch {
    // Try to fix common issues
    let fixed = jsonStr;

    // Fix Thai characters in dates: "2025-09-ง16" -> "2025-09-16"
    fixed = fixed.replace(/"date":\s*"(\d{4}-\d{2})-[ก-๙]?(\d{1,2})"/g, '"date": "$1-$2"');

    // Fix malformed date like "2026-01-{"16"]] -> "2026-01-16"
    fixed = fixed.replace(/"date":\s*"(\d{4}-\d{2})-\{?"?(\d{1,2})"?\]?\]?/g, '"date": "$1-$2"');

    // Fix extra brackets in arrays: {"code": "...", {"model" -> {"code": "...", "model"
    fixed = fixed.replace(/,\s*\{"/g, ', "');

    // Fix double opening brackets: {{ -> {
    fixed = fixed.replace(/\{\s*\{/g, '{');

    // Fix missing comma before object: } { -> }, {
    fixed = fixed.replace(/\}\s*\{/g, '}, {');

    // Fix trailing commas
    fixed = fixed.replace(/,\s*}/g, '}');
    fixed = fixed.replace(/,\s*]/g, ']');

    // Fix missing quotes
    fixed = fixed.replace(/:\s*([a-zA-Z0-9ก-๙]+)([,\}])/g, ': "$1"$2');

    try {
      return JSON.parse(fixed);
    } catch {
      // Try extracting JSON object pattern
      const jsonMatch = fixed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          let extracted = jsonMatch[0];
          // Additional cleanup
          extracted = extracted.replace(/,\s*,/g, ',');
          return JSON.parse(extracted);
        } catch {
          console.log('[JSON Recovery] Final parse failed');
          return null;
        }
      }
      return null;
    }
  }
}

// Call Vision API with specific model
async function callVisionAPI(model: string, imageUrl: string) {
  return groq.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: VISION_RECEIPT_PROMPT },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });
}

export const POST = withAuth(async (request) => {
  try {
    const { imageBase64 } = await request.json();
    const validationResult = validateOcrImageBase64(imageBase64);
    if (!validationResult.ok) {
      return NextResponse.json(
        { success: false, error: validationResult.error },
        { status: 400 }
      );
    }

    const groqImageUrl = `data:${validationResult.mime};base64,${validationResult.base64}`;
    const startTime = Date.now();

    let response;
    let usedModel = VISION_MODELS[0];
    let fallbackUsed = false;

    // Try primary model first, fallback on rate limit
    for (let i = 0; i < VISION_MODELS.length; i++) {
      try {
        usedModel = VISION_MODELS[i];
        console.log(`[Vision OCR] Trying model: ${usedModel}`);
        response = await callVisionAPI(usedModel, groqImageUrl);
        break; // Success, exit loop
      } catch (error: any) {
        if (isRateLimitError(error) && i < VISION_MODELS.length - 1) {
          console.log(`[Vision OCR] Rate limited on ${usedModel}, falling back...`);
          fallbackUsed = true;
          continue; // Try next model
        }
        throw error; // Re-throw if not rate limit or no more fallbacks
      }
    }

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'All models rate limited' },
        { status: 429 }
      );
    }

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'No response from Vision AI' },
        { status: 500 }
      );
    }

    let extracted: Partial<ReceiptData>;
    try {
      extracted = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse error:', content);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON response', rawContent: content },
        { status: 500 }
      );
    }

    // Normalize confidence (handle 0-1 or 0-100 scale)
    let confidence = extracted.confidence || 85;
    if (confidence > 0 && confidence <= 1) {
      confidence = Math.round(confidence * 100);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...extracted,
        rawText: null,
        confidence,
      },
      processingTime: Date.now() - startTime,
      model: usedModel,
      fallbackUsed,
      method: 'vision',
    });

  } catch (error: any) {
    console.error('Vision OCR error:', error);

    // Try to recover from JSON validation errors
    if (isJsonValidationError(error)) {
      const failedGeneration = error?.error?.error?.failed_generation;
      console.log('[Vision OCR] Attempting to recover from malformed JSON...');

      const recovered = tryFixMalformedJson(failedGeneration);
      if (recovered) {
        console.log('[Vision OCR] Successfully recovered JSON');

        let confidence = recovered.confidence || 75; // Lower confidence for recovered data
        if (confidence > 0 && confidence <= 1) {
          confidence = Math.round(confidence * 100);
        }

        return NextResponse.json({
          success: true,
          data: {
            ...recovered,
            rawText: null,
            confidence,
          },
          recovered: true, // Flag that this was recovered from error
          method: 'vision',
        });
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Vision OCR failed',
      },
      { status: 500 }
    );
  }
});
