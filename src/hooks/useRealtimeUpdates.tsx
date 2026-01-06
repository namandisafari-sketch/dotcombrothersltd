import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseRealtimeUpdatesOptions {
  tables?: string[];
  departmentId?: string | null;
  queryKeys?: string[][];
  showToasts?: boolean;
}

export const useRealtimeUpdates = ({
  tables = ['sales', 'products', 'expenses', 'credits', 'reconciliations'],
  departmentId,
  queryKeys = [],
  showToasts = false
}: UseRealtimeUpdatesOptions = {}) => {
  const queryClient = useQueryClient();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    console.log('Setting up realtime subscriptions for:', tables);

    // Small delay to prevent initial load notifications
    const initTimer = setTimeout(() => {
      isInitializedRef.current = true;
    }, 3000);

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
          async (payload) => {
            console.log(`Realtime ${table} change:`, payload.eventType, payload);

            // Show toast notification for new sales
            if (showToasts && isInitializedRef.current && table === 'sales' && payload.eventType === 'INSERT') {
              const newSale = payload.new as any;
              let departmentName = 'Unknown';

              // Fetch department name
              if (newSale.department_id) {
                const { data: dept } = await supabase
                  .from('departments')
                  .select('name')
                  .eq('id', newSale.department_id)
                  .single();
                if (dept) departmentName = dept.name;
              }

              toast({
                title: "🎉 New Sale!",
                description: `${departmentName}: ${newSale.total?.toLocaleString() || 0} UGX - ${newSale.payment_method || 'Cash'}`,
              });
            }

            // Invalidate all queries that might be affected
            queryClient.invalidateQueries({ queryKey: [table] });

            // Invalidate specific query keys
            queryKeys.forEach(key => {
              queryClient.invalidateQueries({ queryKey: key });
            });

            // Invalidate common dashboard/report queries
            queryClient.invalidateQueries({ queryKey: ['today-sales'] });
            queryClient.invalidateQueries({ queryKey: ['recent-sales'] });
            queryClient.invalidateQueries({ queryKey: ['sales-history'] });
            queryClient.invalidateQueries({ queryKey: ['sales-report'] });
            queryClient.invalidateQueries({ queryKey: ['low-stock'] });
            queryClient.invalidateQueries({ queryKey: ['total-products'] });
            queryClient.invalidateQueries({ queryKey: ['total-customers'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-today-revenue'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-stock'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-recent-sales'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-daily-revenue'] });
            queryClient.invalidateQueries({ queryKey: ['perfume-sales-history'] });
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
      clearTimeout(initTimer);
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [queryClient, tables.join(','), departmentId, queryKeys.length, showToasts]);
};

// Simplified hook for sales-focused pages with toast notifications
export const useSalesRealtime = (departmentId?: string | null, showToasts: boolean = true) => {
  useRealtimeUpdates({
    tables: ['sales', 'sale_items'],
    departmentId,
    showToasts,
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
export const useFinancialRealtime = (departmentId?: string | null, showToasts: boolean = false) => {
  useRealtimeUpdates({
    tables: ['sales', 'expenses', 'credits', 'reconciliations'],
    departmentId,
    showToasts,
  });
};

// Hook for dashboards with all notifications enabled
export const useDashboardRealtime = (departmentId?: string | null) => {
  useRealtimeUpdates({
    tables: ['sales', 'products', 'expenses', 'credits'],
    departmentId,
    showToasts: true,
    queryKeys: [
      ['today-sales', departmentId || ''],
      ['recent-sales', departmentId || ''],
      ['low-stock', departmentId || ''],
    ]
  });
};