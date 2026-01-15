import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env'
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

// Export as getter to avoid initialization at import time
export const supabase = {
  get storage() {
    return getSupabaseClient().storage;
  },
};

// Storage bucket name
export const RECEIPTS_BUCKET = 'receipts';

// Helper function to get public URL
export function getStoragePublicUrl(path: string): string {
  const client = getSupabaseClient();
  const { data } = client.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
