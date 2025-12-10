import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if Supabase backend is available
 * (Migrated from local backend to Supabase)
 */
export const useLocalBackend = () => {
  const { data: healthData, isLoading } = useQuery({
    queryKey: ["supabase-backend-health"],
    queryFn: async () => {
      // Check if Supabase is accessible
      const { data, error } = await supabase.from("departments").select("id").limit(1);
      if (error) throw error;
      return { status: "healthy", timestamp: new Date().toISOString() };
    },
    refetchInterval: 30000,
    retry: false,
  });

  return {
    isAvailable: !!healthData,
    isLoading,
    healthData,
  };
};
