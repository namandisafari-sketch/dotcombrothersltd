// Self-hosted Supabase client for deployment
// This client is used when deploying to your own infrastructure with self-hosted Supabase

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Self-hosted Supabase configuration
// Set these environment variables in your deployment:
// VITE_SELF_HOSTED_SUPABASE_URL=http://172.234.31.22:8000
// VITE_SELF_HOSTED_SUPABASE_ANON_KEY=your-anon-key

const SELF_HOSTED_URL = import.meta.env.VITE_SELF_HOSTED_SUPABASE_URL;
const SELF_HOSTED_KEY = import.meta.env.VITE_SELF_HOSTED_SUPABASE_ANON_KEY;

// Check if self-hosted credentials are available
export const isSelfHosted = !!(SELF_HOSTED_URL && SELF_HOSTED_KEY);

// Create self-hosted client if credentials are available
export const selfHostedSupabase = isSelfHosted 
  ? createClient<Database>(SELF_HOSTED_URL, SELF_HOSTED_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;

// Helper to log which backend is being used
if (isSelfHosted) {
  console.log('🏠 Using self-hosted Supabase at:', SELF_HOSTED_URL);
} else {
  console.log('☁️ Using Lovable Cloud Supabase');
}
