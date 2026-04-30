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

export type UploadProfileKey = 'product-image' | 'expense-receipt' | 'purchase-receipt' | 'sale-receipt' | 'payment-slip';

/**
 * Upload to Supabase Storage via hardened backend API route
 * This replaces the direct browser upload for better security
 */
export async function uploadToStorage(
  file: File,
  profile: UploadProfileKey
): Promise<{ url: string; path: string } | { error: string; message: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profile', profile);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Upload error:', data.error);
      return { error: data.error || 'Upload failed', message: data.error || 'Upload failed' };
    }

    return {
      url: data.url,
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
