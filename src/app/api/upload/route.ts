import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  supabase, 
  RECEIPTS_BUCKET, 
  PRODUCTS_BUCKET, 
  getStoragePublicUrl, 
  getProductImageUrl 
} from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Check authentication using NextAuth v5
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string || 'misc';
    const bucket = formData.get('bucket') as string || 'receipts';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Determine target bucket and allowed types
    const isProductUpload = bucket === 'products';
    const targetBucket = isProductUpload ? PRODUCTS_BUCKET : RECEIPTS_BUCKET;
    
    // Validate file type based on bucket
    const allowedTypes = isProductUpload 
      ? ['image/jpeg', 'image/png', 'image/webp']  // Products: images only
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']; // Receipts: + PDF
      
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: isProductUpload 
          ? 'Invalid file type. Allowed: JPEG, PNG, WebP' 
          : 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF'
      }, { status: 400 });
    }

    // Validate file size (10MB for products, 5MB for receipts)
    const maxSize = isProductUpload ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: `File too large. Max ${isProductUpload ? '10' : '5'}MB` 
      }, { status: 400 });
    }

    // Generate unique filename with random suffix for uniqueness
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${folder}/${session.user.id}/${timestamp}-${random}.${ext}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(targetBucket)
      .upload(fileName, buffer, {
        contentType: file.type,
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
}
