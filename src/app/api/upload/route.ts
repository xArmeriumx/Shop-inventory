import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  supabase, 
  RECEIPTS_BUCKET, 
  PRODUCTS_BUCKET, 
  getStoragePublicUrl, 
  getProductImageUrl 
} from '@/lib/supabase';

import { withAuth } from '@/lib/auth/api-guard';
import { detectMimeTypeFromBuffer } from '@/lib/upload/magic-bytes';
import { Security } from '@/services/core/iam/security.service';
import { getSessionContext } from '@/lib/auth-guard';
import crypto from 'crypto';

const UPLOAD_PROFILES = {
  'product-image': {
    bucket: PRODUCTS_BUCKET,
    folder: 'product-images',
    permission: ['PRODUCT_CREATE', 'PRODUCT_UPDATE'],
    maxSize: 10 * 1024 * 1024,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
  },
  'expense-receipt': {
    bucket: RECEIPTS_BUCKET,
    folder: 'expense-receipts',
    permission: ['EXPENSE_CREATE', 'FINANCE_CONFIG'],
    maxSize: 5 * 1024 * 1024,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  'purchase-receipt': {
    bucket: RECEIPTS_BUCKET,
    folder: 'purchase-receipts',
    permission: ['PURCHASE_CREATE', 'FINANCE_CONFIG'],
    maxSize: 5 * 1024 * 1024,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  'sale-receipt': {
    bucket: RECEIPTS_BUCKET,
    folder: 'sale-receipts',
    permission: ['SALE_CREATE', 'POS_ACCESS', 'FINANCE_CONFIG'],
    maxSize: 5 * 1024 * 1024,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  'payment-slip': {
    bucket: RECEIPTS_BUCKET,
    folder: 'slips',
    permission: ['POS_ACCESS', 'SALE_CREATE', 'FINANCE_CONFIG'],
    maxSize: 5 * 1024 * 1024,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
} as const;

export type UploadProfileKey = keyof typeof UPLOAD_PROFILES;

export const POST = withAuth(
  async (request: NextRequest, session: any) => {
    try {
      const ctx = await getSessionContext();
      if (!ctx || !ctx.shopId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const profileKey = formData.get('profile') as string;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      if (!profileKey || !(profileKey in UPLOAD_PROFILES)) {
        return NextResponse.json({ error: 'Invalid or missing upload profile' }, { status: 400 });
      }

      const profile = UPLOAD_PROFILES[profileKey as UploadProfileKey];

      // Check permission (oneOf)
      const hasPermission = ctx.isOwner || profile.permission.some(perm => ctx.permissions.includes(perm as any));
      if (!hasPermission) {
        return NextResponse.json({ error: 'Permission denied for this upload profile' }, { status: 403 });
      }

      const isProductUpload = profile.bucket === PRODUCTS_BUCKET;
      const targetBucket = profile.bucket;

      if (file.size <= 0) {
        return NextResponse.json({ error: 'Empty file is not allowed' }, { status: 400 });
      }

      if (file.size > profile.maxSize) {
        return NextResponse.json({
          error: `File too large. Max ${profile.maxSize / (1024 * 1024)}MB`
        }, { status: 400 });
      }

      // Read to ArrayBuffer only after size check
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Validate file type based on magic bytes (NOT client MIME type)
      const detectedMime = detectMimeTypeFromBuffer(buffer);

      if (!detectedMime) {
        return NextResponse.json({
          error: 'รูปแบบไฟล์ไม่ถูกต้อง หรือไม่ได้รับการรองรับ'
        }, { status: 400 });
      }
      if (!profile.allowedMime.includes(detectedMime as any)) {
        return NextResponse.json({ 
          error: `ไฟล์ประเภทนี้ไม่ได้รับอนุญาตสำหรับโปรไฟล์ ${profileKey}`
        }, { status: 400 });
      }

    // Canonical extension mapping
    const EXT_BY_MIME: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };

    // Generate secure unique filename with tenant isolation
    const ext = EXT_BY_MIME[detectedMime] || 'bin';
    const uniqueId = crypto.randomUUID();
    const fileName = `shops/${ctx.shopId}/${profile.folder}/${ctx.userId}/${uniqueId}.${ext}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(targetBucket)
      .upload(fileName, buffer, {
        contentType: detectedMime,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json({ 
        error: 'Upload failed: ' + error.message 
      }, { status: 500 });
    }

    // Get public URL based on bucket
    const publicUrl = isProductUpload 
      ? getProductImageUrl(data.path)
      : getStoragePublicUrl(data.path);

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      path: data.path,
      bucket: targetBucket,
    });
    } catch (error) {
      console.error('Upload error:', error);
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 });
    }
  },
  { rateLimitPolicy: 'upload' }
);
