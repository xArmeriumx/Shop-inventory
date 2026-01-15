import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use Service Role Key for server-side operations (bypasses RLS)
// This is safe because uploads only happen through authenticated API routes

let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env'
    );
  }

  supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminInstance;
}

// Export as getter to avoid initialization at import time
export const supabase = {
  get storage() {
    return getSupabaseAdmin().storage;
  },
};

// Storage bucket name
export const RECEIPTS_BUCKET = 'receipts';

// Helper function to get public URL
export function getStoragePublicUrl(path: string): string {
  const client = getSupabaseAdmin();
  const { data } = client.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
