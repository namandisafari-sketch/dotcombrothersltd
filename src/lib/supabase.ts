// Unified Supabase client that switches between Lovable Cloud and self-hosted
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase as lovableCloudSupabase } from '@/integrations/supabase/client';

// Self-hosted configuration from environment variables
const SELF_HOSTED_URL = import.meta.env.VITE_SELF_HOSTED_SUPABASE_URL;
const SELF_HOSTED_KEY = import.meta.env.VITE_SELF_HOSTED_SUPABASE_ANON_KEY;

// Check if self-hosted is configured
export const isSelfHosted = !!(SELF_HOSTED_URL && SELF_HOSTED_KEY);

// Create the appropriate client
let _supabaseClient: SupabaseClient<Database>;

if (isSelfHosted) {
  console.log('🏠 Connecting to self-hosted Supabase at:', SELF_HOSTED_URL);
  _supabaseClient = createClient<Database>(SELF_HOSTED_URL, SELF_HOSTED_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
} else {
  console.log('☁️ Using Lovable Cloud Supabase');
  _supabaseClient = lovableCloudSupabase;
}

// Export the unified client
export const supabaseClient = _supabaseClient;

// Re-export for convenience
export { supabaseClient as supabase };
