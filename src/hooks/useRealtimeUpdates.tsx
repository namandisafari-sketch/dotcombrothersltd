import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeUpdatesOptions {
  tables?: string[];
  departmentId?: string | null;
  queryKeys?: string[][];
}

export const useRealtimeUpdates = ({ 
  tables = ['sales', 'products', 'expenses', 'credits', 'reconciliations'],
  departmentId,
  queryKeys = []
}: UseRealtimeUpdatesOptions = {}) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('Setting up realtime subscriptions for:', tables);

    const channels = tables.map(table => {
      const channel = supabase
        .channel(`realtime-${table}-${departmentId || 'all'}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          (payload) => {
            console.log(`Realtime ${table} change:`, payload.eventType, payload);
            
            // Invalidate all queries that might be affected
            queryClient.invalidateQueries({ queryKey: [table] });
            
            // Invalidate specific query keys
            queryKeys.forEach(key => {
              queryClient.invalidateQueries({ queryKey: key });
            });
            
            // Invalidate common dashboard/report queries
            queryClient.invalidateQueries({ queryKey: ['today-sales'] });
            queryClient.invalidateQueries({ queryKey: ['recent-sales'] });
            queryClient.invalidateQueries({ queryKey: ['low-stock'] });
            queryClient.invalidateQueries({ queryKey: ['total-products'] });
            queryClient.invalidateQueries({ queryKey: ['total-customers'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-today-revenue'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-stock'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-recent-sales'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-daily-revenue'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-sales-report'] });
            queryClient.invalidateQueries({ queryKey: ['mobile-money-sales-today'] });
            queryClient.invalidateQueries({ queryKey: ['mobile-money-sales-all'] });
          }
        )
        .subscribe((status) => {
          console.log(`Realtime ${table} subscription status:`, status);
        });

      return channel;
    });

    return () => {
      console.log('Cleaning up realtime subscriptions');
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [queryClient, tables.join(','), departmentId, queryKeys.length]);
};

// Simplified hook for sales-focused pages
export const useSalesRealtime = (departmentId?: string | null) => {
  useRealtimeUpdates({
    tables: ['sales', 'sale_items'],
    departmentId,
    queryKeys: [
      ['today-sales', departmentId || ''],
      ['recent-sales', departmentId || ''],
      ['perfume-today-revenue', departmentId || ''],
      ['perfume-recent-sales', departmentId || ''],
    ]
  });
};

// Hook for inventory-focused pages
export const useInventoryRealtime = (departmentId?: string | null) => {
  useRealtimeUpdates({
    tables: ['products', 'product_variants', 'internal_stock_usage'],
    departmentId,
    queryKeys: [
      ['low-stock', departmentId || ''],
      ['total-products', departmentId || ''],
      ['perfume-stock', departmentId || ''],
    ]
  });
};

// Hook for financial pages
export const useFinancialRealtime = (departmentId?: string | null) => {
  useRealtimeUpdates({
    tables: ['sales', 'expenses', 'credits', 'reconciliations'],
    departmentId,
  });
};