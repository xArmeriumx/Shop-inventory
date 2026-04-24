import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Browser Client
 * 
 * Uses the public anon key for client-side operations.
 * Security is enforced through:
 * 1. RLS (Row Level Security) policies in Supabase
 * 2. Storage policies for uploads
 * 
 * This client can:
 * - Read from public buckets
 * - Upload to buckets with proper policies
 * - Cannot bypass RLS (unlike service role key)
 */

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return browserClient;
}

// Bucket names
export const PRODUCTS_BUCKET = 'products';
export const RECEIPTS_BUCKET = 'receipts';

/**
 * Direct upload to Supabase Storage
 * Bypasses Vercel's 4.5MB limit by uploading directly from browser
 */
export async function uploadToStorage(
  file: File,
  bucket: string,
  folder: string
): Promise<{ url: string; path: string } | { error: string; message: string }> {
  try {
    const client = getSupabaseBrowser();

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${folder}/${timestamp}-${random}.${ext}`;

    // Upload directly to Supabase
    const { data, error } = await client.storage
      .from(bucket)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return { error: error.message, message: error.message };
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (err) {
    console.error('Upload error:', err);
    const errMsg = err instanceof Error ? err.message : 'Upload failed';
    return { error: errMsg, message: errMsg };
  }
}

/**
 * Delete file from storage
 */
export async function deleteFromStorage(
  bucket: string,
  path: string
): Promise<boolean> {
  try {
    const client = getSupabaseBrowser();
    const { error } = await client.storage.from(bucket).remove([path]);
    return !error;
  } catch {
    return false;
  }
}
