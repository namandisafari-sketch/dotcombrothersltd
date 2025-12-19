// Configuration for switching between Lovable Cloud and self-hosted Supabase
// When deployed, set these environment variables to use your self-hosted instance

export const getSupabaseConfig = () => {
  // Check if we're in a deployed environment with self-hosted Supabase
  const selfHostedUrl = import.meta.env.VITE_SELF_HOSTED_SUPABASE_URL;
  const selfHostedKey = import.meta.env.VITE_SELF_HOSTED_SUPABASE_ANON_KEY;
  
  // If self-hosted credentials are provided, use them
  if (selfHostedUrl && selfHostedKey) {
    console.log('Using self-hosted Supabase');
    return {
      url: selfHostedUrl,
      anonKey: selfHostedKey,
      isSelfHosted: true
    };
  }
  
  // Otherwise, use Lovable Cloud (default for preview)
  console.log('Using Lovable Cloud Supabase');
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    isSelfHosted: false
  };
};

// Export the configuration
export const supabaseConfig = getSupabaseConfig();
