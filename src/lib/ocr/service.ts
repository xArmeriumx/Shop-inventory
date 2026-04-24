/**
 * OCR Service — Shop Inventory Smart Pipeline
 *
 * Thai-First OCR with Forensic AI thinking:
 *   1. Typhoon OCR (Thai-specialist) + DB Context → in parallel
 *   2. Primary: Text LLM (reasoning from OCR text)
 *   3. Fallback: Groq Vision (image → JSON directly)
 *   4. Post-processing: fixDate, normalize, validate
 *
 * Mirrors Billsnap's proven architecture, adapted for B2B documents:
 *   receipt → sale | purchase | invoice | shipment
 */

import { groq } from '@/lib/ai';
import { getStrategy, DocumentType, ScanResult } from './strategies';

// ═══════════════════════════════════════
// § 1 — Model Configuration
// ═══════════════════════════════════════

/** Vision models for image → JSON (when OCR fails) */
const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',    // Primary: fast
  'meta-llama/llama-4-maverick-17b-128e-instruct', // Fallback: smarter
];

/** Text models for OCR text → JSON reasoning (round-robin fallback) */
const TEXT_MODELS = [
  'meta-llama/llama-4-maverick-17b-128e-instruct', // slot 0 — Best reasoning
  'llama-3.3-70b-versatile',                        // slot 1 — Strong
  'qwen/qwen3-32b',                                 // slot 2 — Thai/Chinese aware
  'meta-llama/llama-4-scout-17b-16e-instruct',      // slot 3 — Fast fallback
  'llama-3.1-8b-instant',                           // slot 4 — Final fallback
];

// ═══════════════════════════════════════
// § 2 — Typhoon OCR (Thai-Specialist)
// ═══════════════════════════════════════

const TYPHOON_OCR_URL = 'https://api.opentyphoon.ai/v1/ocr';
const TYPHOON_OCR_TIMEOUT_MS = 8_000;

/**
 * Extract raw Thai text from image using Typhoon OCR.
 * Runs in parallel with DB context fetch → zero added latency.
 * Returns '' on any failure so Vision AI can still work standalone.
 */
async function extractRawOCR(imageBase64: string, mimeType: string): Promise<string> {
  const apiKey = process.env.TYPHOON_API_KEY;
  if (!apiKey) return '';

  try {
    const buffer = Buffer.from(imageBase64, 'base64');
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const formData = new FormData();
    formData.append('file', blob, `doc.${ext}`);
    formData.append('model', 'typhoon-ocr');
    formData.append('max_tokens', '16384');
    formData.append('temperature', '0.1');
    formData.append('top_p', '0.6');
    formData.append('repetition_penalty', '1.2');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TYPHOON_OCR_TIMEOUT_MS);

    const response = await fetch(TYPHOON_OCR_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return '';

    const result = await response.json();
    const texts: string[] = [];

    for (const page of result.results || []) {
      if (page.success && page.message) {
        let content = page.message.choices?.[0]?.message?.content || '';
        try {
          const parsed = JSON.parse(content);
          content = parsed.natural_text || content;
        } catch { /* use as-is */ }
        if (content) texts.push(content);
      }
    }

    const rawText = texts.join('\n').trim();
    console.log(`[OCR:Typhoon] ✅ ${rawText.length} chars extracted`);
    return rawText;

  } catch (error: any) {
    const msg = error?.name === 'AbortError' ? `Timeout (${TYPHOON_OCR_TIMEOUT_MS / 1000}s)` : error?.message;
    console.warn(`[OCR:Typhoon] ⚠️ Skipped: ${msg}`);
    return '';
  }
}

// ═══════════════════════════════════════
// § 3 — Post-processing Utilities
// ═══════════════════════════════════════

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
function thaiToArabic(s: string): string {
  return s.replace(/[๐-๙]/g, (ch) => String(THAI_DIGITS.indexOf(ch)));
}

const THAI_MONTHS: Record<string, number> = {
  'ม.ค.': 1, 'มกราคม': 1,
  'ก.พ.': 2, 'กุมภาพันธ์': 2,
  'มี.ค.': 3, 'มีนาคม': 3,
  'เม.ย.': 4, 'เมษายน': 4,
  'พ.ค.': 5, 'พฤษภาคม': 5,
  'มิ.ย.': 6, 'มิถุนายน': 6,
  'ก.ค.': 7, 'กรกฎาคม': 7,
  'ส.ค.': 8, 'สิงหาคม': 8,
  'ก.ย.': 9, 'กันยายน': 9,
  'ต.ค.': 10, 'ตุลาคม': 10,
  'พ.ย.': 11, 'พฤศจิกายน': 11,
  'ธ.ค.': 12, 'ธันวาคม': 12,
};

/**
 * Robust Thai date fixer.
 * Handles พ.ศ.↔ค.ศ., 2-digit year, Thai numerals, future dates.
 */
function fixDate(raw: string | null | undefined): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const todayStr = now.toISOString().split('T')[0];

  if (!raw) return todayStr;

  let cleaned = thaiToArabic(raw.trim());

  // Try Thai month name format: "13 ก.พ. 69"
  for (const [thaiMonth, monthNum] of Object.entries(THAI_MONTHS)) {
    if (cleaned.includes(thaiMonth)) {
      const escaped = thaiMonth.replace(/\./g, '\\.');
      const thaiMatch = cleaned.match(new RegExp(`(\\d{1,2})\\s*${escaped}\\s*(\\d{2,4})?`));
      if (thaiMatch) {
        const day = parseInt(thaiMatch[1], 10);
        let year = thaiMatch[2] ? parseInt(thaiMatch[2], 10) : currentYear;
        if (year < 100) year = year >= 25 ? 2500 + year - 543 : 2000 + year;
        if (year > 2400) year -= 543;
        if (year >= currentYear + 2) year = currentYear;
        if (year < currentYear - 5) year = currentYear;
        cleaned = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        break;
      }
    }
  }

  let match = cleaned.match(/(\d{2,4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})/);
  if (!match) {
    const dmyMatch = cleaned.match(/(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{2,4})/);
    if (dmyMatch) match = [dmyMatch[0], dmyMatch[3], dmyMatch[2], dmyMatch[1]];
  }

  if (!match) return todayStr;

  let year = parseInt(match[1], 10);
  let month = parseInt(match[2], 10);
  let day = parseInt(match[3], 10);

  if (month > 12 && day <= 12) [month, day] = [day, month];

  if (year < 100) {
    year = year >= 25 ? 2500 + year - 543 : 2000 + year;
  }
  if (year > 2400) year -= 543;
  if (year >= currentYear + 2) year = currentYear;
  if (year < currentYear - 5) year = currentYear;

  month = Math.max(1, Math.min(12, month));
  day = Math.max(1, Math.min(31, day));

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(dateStr + 'T00:00:00');

  if (isNaN(parsed.getTime())) return todayStr;
  if (parsed > now) return todayStr;

  return dateStr;
}

// ═══════════════════════════════════════
// § 4 — Error Helpers
// ═══════════════════════════════════════

function isRateLimitError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.response?.status;
  return status === 429 ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('too many requests');
}

function tryFixJson(raw: string): any | null {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { }
  let fixed = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
  try { return JSON.parse(fixed); } catch { }
  const match = fixed.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch { } }
  return null;
}

// ═══════════════════════════════════════
// § 5 — Text-LLM Reasoning (OCR → JSON)
// ═══════════════════════════════════════

/**
 * Use Text LLM to reason from raw OCR text → structured JSON.
 * More reliable than Vision-only because Typhoon OCR handles Thai text better.
 */
async function parseOCRWithTextLLM(
  rawOCR: string,
  documentPrompt: string,
  dbContext: string,
): Promise<any | null> {
  const instruction = `${documentPrompt}

═══ Raw OCR Text (Thai-specialist extracted) ═══
"""
${rawOCR}
"""

Context (DB Products/Suppliers for matching):
${dbContext || 'ไม่มีข้อมูลเพิ่มเติม'}

วิเคราะห์ข้อความ OCR ข้างต้น แล้วตอบ JSON ตาม Schema ที่กำหนด:`;

  for (let i = 0; i < TEXT_MODELS.length; i++) {
    const model = TEXT_MODELS[i];
    try {
      console.log(`[OCR:TextLLM] Trying ${model}...`);
      const response = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert Thai business document analyzer. Extract structured data from OCR text. Output JSON only, no explanation.',
          },
          { role: 'user', content: instruction },
        ],
        temperature: 0.1,
        max_completion_tokens: 3000,
        response_format: { type: 'json_object' },
      } as any);

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = tryFixJson(content);
      if (parsed) {
        console.log(`[OCR:TextLLM] ✅ Parsed via ${model}`);
        return parsed;
      }
    } catch (error: any) {
      if (isRateLimitError(error) && i < TEXT_MODELS.length - 1) {
        console.warn(`[OCR:TextLLM] Rate limited on ${model}, trying next...`);
        continue;
      }
      console.error(`[OCR:TextLLM] ❌ ${model}: ${error?.message}`);
    }
  }

  return null;
}

// ═══════════════════════════════════════
// § 6 — Vision Direct (Image → JSON)
// ═══════════════════════════════════════

async function parseWithVision(
  imageUrl: string,
  documentPrompt: string,
  rawOCR: string = '',
): Promise<{ data: any; model: string } | null> {
  const ocrHint = rawOCR.trim()
    ? `\n\n<raw_ocr>\n${rawOCR.slice(0, 600)}\n</raw_ocr>\nCross-check your readings with the raw_ocr above.`
    : '';

  for (let i = 0; i < VISION_MODELS.length; i++) {
    const model = VISION_MODELS[i];
    try {
      console.log(`[OCR:Vision] Trying ${model}...`);
      const response = await groq.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text', text: documentPrompt + ocrHint },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const data = tryFixJson(content);
        if (data) {
          console.log(`[OCR:Vision] ✅ Parsed via ${model}`);
          return { data, model };
        }
      }
    } catch (error: any) {
      if (isRateLimitError(error) && i < VISION_MODELS.length - 1) {
        console.warn(`[OCR:Vision] Rate limited on ${model}, falling back...`);
        continue;
      }
      // Try to recover from JSON validation errors
      const failedGeneration = error?.error?.error?.failed_generation;
      if (failedGeneration) {
        const recovered = tryFixJson(failedGeneration);
        if (recovered) {
          console.log(`[OCR:Vision] ✅ Recovered malformed JSON from ${model}`);
          return { data: recovered, model };
        }
      }
      console.error(`[OCR:Vision] ❌ ${model}: ${error?.message}`);
    }
  }

  return null;
}

// ═══════════════════════════════════════
// § 7 — Scan Options & Service Class
// ═══════════════════════════════════════

export interface ScanOptions {
  /** Document type - determines which strategy/prompt to use */
  documentType: DocumentType;
  /** Image as base64 string */
  imageBase64: string;
  /** MIME type of the image */
  mimeType: string;
  /** Optional DB context (products/suppliers) to help AI match */
  dbContext?: string;
}

/**
 * Main OCR Service — Smart Pipeline
 *
 * Pipeline flow:
 *   Step 1: Typhoon OCR + DB context (parallel, ~1-3s)
 *   Step 2a: Text LLM reasoning from OCR (primary if OCR succeeded)
 *   Step 2b: Vision direct if OCR failed or text LLM failed
 *   Step 3: Post-processing (fixDate, normalize)
 */
export class OCRService {

  async scan(options: ScanOptions): Promise<ScanResult> {
    const { documentType, imageBase64, mimeType, dbContext = '' } = options;
    const startTime = Date.now();

    // Get strategy for document type
    const strategy = getStrategy(documentType);
    const prompt = strategy.getPrompt();

    // Build image URL for Vision fallback
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;

    // ── Step 1: Parallel pre-fetch ──────────────────────
    // Typhoon OCR runs at the same time as anything else we pre-fetch
    console.log(`[OCR Service] 🚀 Starting scan: ${documentType}`);
    const [rawOCR] = await Promise.all([
      extractRawOCR(imageBase64, mimeType),
    ]);

    let ocrSource = rawOCR ? 'typhoon' : 'none';
    console.log(`[OCR Service] OCR source: ${ocrSource} (${rawOCR.length} chars)`);

    let extracted: any = null;
    let usedModel = '';
    let recovered = false;

    // ── Step 2a: Text LLM from OCR (primary) ────────────
    if (rawOCR) {
      console.log('[OCR Service] 📝 Step 2a: Text LLM reasoning from OCR...');
      extracted = await parseOCRWithTextLLM(rawOCR, prompt, dbContext);
      if (extracted) {
        usedModel = 'text-llm';
        console.log('[OCR Service] ✅ Step 2a success (OCR + TextLLM)');
      }
    }

    // ── Step 2b: Vision direct (fallback) ───────────────
    if (!extracted) {
      console.log('[OCR Service] 👁️ Step 2b: Vision direct (fallback)...');
      const visionResult = await parseWithVision(imageUrl, prompt, rawOCR);
      if (visionResult) {
        extracted = visionResult.data;
        usedModel = visionResult.model;
        if (visionResult.data._recovered) recovered = true;
        console.log('[OCR Service] ✅ Step 2b success (Vision)');
      }
    }

    if (!extracted) {
      console.error('[OCR Service] ❌ All methods failed');
      return {
        success: false,
        data: null,
        confidence: 0,
        documentType,
        processingTime: Date.now() - startTime,
      };
    }

    // ── Step 3: Post-processing ──────────────────────────
    // Fix date (Thai → AD, พ.ศ. → ค.ศ., future dates)
    if (extracted.date) {
      extracted.date = fixDate(extracted.date);
    }

    // Normalize confidence score (0-1 → 0-100)
    let confidence = extracted.confidence || 85;
    if (confidence > 0 && confidence <= 1) {
      confidence = Math.round(confidence * 100);
    }

    // Validate using strategy
    const isValid = strategy.validate(extracted);

    console.log(`[OCR Service] ✅ Complete: confidence=${confidence}%, valid=${isValid}, model=${usedModel}, time=${Date.now() - startTime}ms`);

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
