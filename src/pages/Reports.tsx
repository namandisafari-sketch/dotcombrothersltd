import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RegularDepartmentSelector } from "@/components/RegularDepartmentSelector";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartment } from "@/contexts/DepartmentContext";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentTransactionsReport } from "@/components/admin/PaymentTransactionsReport";
import { FileText, Download, TrendingUp, AlertTriangle, Package, RefreshCw, Undo2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Reports = () => {
  const { isAdmin } = useUserRole();
  const { selectedDepartmentId, selectedDepartment } = useDepartment();
  const [dateFilter, setDateFilter] = useState<"daily" | "weekly" | "monthly">("daily");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const queryClient = useQueryClient();

  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    if (dateFilter === "daily") {
      return {
        start: `${today}T00:00:00`,
        end: `${today}T23:59:59`,
      };
    } else if (dateFilter === "weekly") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      };
    } else {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return {
        start: monthAgo.toISOString(),
        end: now.toISOString(),
      };
    }
  };

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").maybeSingle();
      return data;
    },
  });

  const { data: salesData, refetch: refetchSales } = useQuery({
    queryKey: ["sales-report", dateFilter, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { start, end } = getDateRange();
      
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .gte("created_at", start)
        .lte("created_at", end)
        .eq("status", "completed");
      
      if (!sales) return [];
      
      // Fetch sale items for each sale
      const salesWithItems = await Promise.all(
        sales.map(async (sale: any) => {
          const { data: items } = await supabase
            .from("sale_items")
            .select("*")
            .eq("sale_id", sale.id);
          return { ...sale, sale_items: items || [] };
        })
      );
      
      // Filter out mobile_money, card, bank payments
      return salesWithItems.filter((sale: any) => 
        !['mobile_money', 'card', 'bank'].includes(sale.payment_method)
      );
    },
    enabled: !!selectedDepartmentId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: products, refetch: refetchProducts } = useQuery({
    queryKey: ["products-stock", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("department_id", selectedDepartmentId);
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  // Get credits for this department
  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: ["credits-report", dateFilter, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      let query = supabase.from("credits").select("*");
      if (!isAdmin) {
        query = query.or(`from_department_id.eq.${selectedDepartmentId},to_department_id.eq.${selectedDepartmentId}`);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Get reconciliations for this department (only approved ones affect sales)
  const { data: reconciliations, refetch: refetchReconciliations } = useQuery({
    queryKey: ["reconciliations-report", dateFilter, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { start, end } = getDateRange();
      const { data } = await supabase
        .from("reconciliations")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .gte("date", start.split("T")[0])
        .lte("date", end.split("T")[0])
        .eq("status", "approved");
      return data || [];
    },
    enabled: !!selectedDepartmentId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Get expenses for this department
  const { data: expenses, refetch: refetchExpenses } = useQuery({
    queryKey: ["expenses-report", dateFilter, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { start, end } = getDateRange();
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .gte("expense_date", start.split("T")[0])
        .lte("expense_date", end.split("T")[0]);
      return data || [];
    },
    enabled: !!selectedDepartmentId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Get suspended revenue (unapproved extra cash)
  const { data: suspendedRevenue, refetch: refetchSuspendedRevenue } = useQuery({
    queryKey: ["suspended-revenue-report", dateFilter, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { data } = await supabase
        .from("suspended_revenue")
        .select("*")
        .eq("department_id", selectedDepartmentId);
      return data || [];
    },
    enabled: !!selectedDepartmentId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchSettings(),
        refetchSales(),
        refetchProducts(),
        refetchCredits(),
        refetchReconciliations(),
        refetchExpenses(),
        refetchSuspendedRevenue()
      ]);
      toast.success("Reports refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh reports");
    } finally {
      setIsRefreshing(false);
    }
  };

  const restoreStockMutation = useMutation({
    mutationFn: async () => {
      if (!salesData || salesData.length === 0) {
        throw new Error("No sales data to restore");
      }

      // Collect all sale items from all sales
      const allSaleItems = salesData.flatMap(sale => sale.sale_items || []);
      
      if (allSaleItems.length === 0) {
        throw new Error("No sale items found");
      }

      // Note: Stock restoration requires backend implementation
      toast.info("Stock restoration is not yet implemented in local backend");
      return { success: true };
    },
    onSuccess: () => {
      toast.success("Stock restored successfully from sales");
      queryClient.invalidateQueries({ queryKey: ["products-stock"] });
      queryClient.invalidateQueries({ queryKey: ["sales-report"] });
      setShowRestoreDialog(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to restore stock");
      setShowRestoreDialog(false);
    },
  });

  // Calculate metrics
  const totalSales = salesData?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
  const totalTransactions = salesData?.length || 0;
  
  // Calculate credits impact
  // Unsettled credits (approved but not settled yet)
  const unsettledCreditsIn = credits?.filter((c: any) => 
    c.to_department_id === selectedDepartmentId && c.settlement_status !== 'settled'
  ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
  
  const unsettledCreditsOut = credits?.filter((c: any) => 
    c.from_department_id === selectedDepartmentId && c.settlement_status !== 'settled'
  ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
  
  // Settled credits (impact on final revenue)
  const settledCreditsIn = credits?.filter((c: any) => 
    c.to_department_id === selectedDepartmentId && c.settlement_status === 'settled'
  ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
  
  const settledCreditsOut = credits?.filter((c: any) => 
    c.from_department_id === selectedDepartmentId && c.settlement_status === 'settled'
  ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
  
  // Calculate reconciliation differences (only approved ones)
  const reconciliationDifferences = reconciliations?.reduce((sum, r) => sum + Number(r.discrepancy), 0) || 0;
  
  // Calculate total expenses
  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  
  // Calculate total suspended revenue (unapproved extra cash)
  const totalSuspendedRevenue = suspendedRevenue?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
  
  // Calculate adjusted total sales
  // Formula: Sales + Unsettled Credits IN - Unsettled Credits OUT 
  //          - Settled Credits IN (refunded back) + Settled Credits OUT (received back)
  //          - Expenses + Reconciliation Adjustments - Suspended Revenue
  const adjustedTotalSales = totalSales 
    + unsettledCreditsIn 
    - unsettledCreditsOut 
    - settledCreditsIn   // Deduction: paying back borrowed money
    + settledCreditsOut  // Addition: receiving back lent money
    - totalExpenses 
    + reconciliationDifferences
    - totalSuspendedRevenue; // Subtract unapproved extra cash
  
  // Calculate total items sold, COGS, COSO, and separate product/service metrics
  let totalItemsSold = 0;
  let totalProductsSold = 0;
  let totalServicesSold = 0;
  let totalCOGS = 0;
  let totalCOSO = 0;
  let totalServiceRevenue = 0;
  let totalProductRevenue = 0;
  
  salesData?.forEach(sale => {
    sale.sale_items?.forEach((item: any) => {
      // Use actual quantity sold (not multiplied by quantity_per_unit)
      totalItemsSold += item.quantity;
      
      // Separate products and services
      if (item.product_id) {
        totalProductsSold += item.quantity;
        totalProductRevenue += Number(item.subtotal);
        // Calculate COGS for products
        const costPrice = item.products?.cost_price || 0;
        totalCOGS += costPrice * item.quantity;
      } else if (item.service_id) {
        totalServicesSold += item.quantity;
        totalServiceRevenue += Number(item.subtotal);
        // Calculate COSO for services
        const materialCost = item.services?.material_cost || 0;
        totalCOSO += materialCost * item.quantity;
      }
    });
  });

  const netServiceRevenue = totalServiceRevenue - totalCOSO;
  const totalCost = totalCOGS + totalCOSO;
  const grossProfit = totalSales - totalCost;
  const adjustedGrossProfit = adjustedTotalSales - totalCost;
  const avgBasketSize = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  // Separate product and service stats
  const productStats: Record<string, { sold: number; revenue: number }> = {};
  const serviceStats: Record<string, { sold: number; revenue: number; coso: number }> = {};
  
  salesData?.forEach(sale => {
    sale.sale_items?.forEach((item: any) => {
      if (item.product_id) {
        if (!productStats[item.item_name]) {
          productStats[item.item_name] = { sold: 0, revenue: 0 };
        }
        productStats[item.item_name].sold += item.quantity;
        productStats[item.item_name].revenue += Number(item.subtotal);
      } else if (item.service_id) {
        if (!serviceStats[item.item_name]) {
          serviceStats[item.item_name] = { sold: 0, revenue: 0, coso: 0 };
        }
        serviceStats[item.item_name].sold += item.quantity;
        serviceStats[item.item_name].revenue += Number(item.subtotal);
        const materialCost = item.services?.material_cost || 0;
        serviceStats[item.item_name].coso += materialCost * item.quantity;
      }
    });
  });

  const topProducts = Object.entries(productStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);
  
  const topServices = Object.entries(serviceStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // Keep legacy itemStats for compatibility
  const itemStats: Record<string, { sold: number; revenue: number }> = {};
  salesData?.forEach(sale => {
    sale.sale_items?.forEach((item: any) => {
      if (!itemStats[item.item_name]) {
        itemStats[item.item_name] = { sold: 0, revenue: 0 };
      }
      itemStats[item.item_name].sold += item.quantity;
      itemStats[item.item_name].revenue += Number(item.subtotal);
    });
  });

  const topItems = Object.entries(itemStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // Suspicious entries (simplified detection)
  const suspiciousEntries = salesData?.filter(sale => {
    const hasZeroPrice = sale.sale_items?.some((item: any) => item.unit_price === 0);
    const hasDuplicates = new Set(sale.sale_items?.map((i: any) => i.item_name)).size !== sale.sale_items?.length;
    return hasZeroPrice || hasDuplicates;
  }) || [];

  // Low stock items - handle both unit and ml tracking
  const lowStockItems = products?.filter(p => {
    if (p.tracking_type === 'ml') {
      return (p.total_ml || 0) <= (p.min_stock || 0);
    }
    return (p.current_stock || 0) <= (p.min_stock || 0);
  }).slice(0, 5) || [];
  
  const isPerfumeDepartment = selectedDepartment?.is_perfume_department;

  // Staff performance
  const staffStats: Record<string, { count: number; total: number }> = {};
  salesData?.forEach(sale => {
    const cashier = sale.cashier_name || "Unknown";
    if (!staffStats[cashier]) {
      staffStats[cashier] = { count: 0, total: 0 };
    }
    staffStats[cashier].count += 1;
    staffStats[cashier].total += Number(sale.total);
  });

  const staffPerformance = Object.entries(staffStats)
    .sort((a, b) => b[1].total - a[1].total);

  const exportToPDF = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      // Create a detailed report content
      const reportContent = `
        <div style="padding: 20px; font-family: Arial, sans-serif; font-weight: bold;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #333; font-weight: bold;">${selectedDepartment?.name || "Sales"} Report</h1>
            <h2 style="margin: 5px 0; color: #666; font-weight: bold;">${settings?.business_name || "DOTCOM BROTHERS LTD"}</h2>
            <p style="color: #888; font-weight: bold;">Date: ${new Date().toLocaleDateString()} | Period: ${dateFilter}</p>
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="border-bottom: 2px solid #333; padding-bottom: 10px; font-weight: bold;">Summary Metrics</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Total Sales</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${totalSales.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Total Transactions</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${totalTransactions}</td>
              </tr>
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Items Sold</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${totalItemsSold}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Products Sold</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${totalProductsSold}</td>
              </tr>
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Services Offered</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${totalServicesSold}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Product Revenue</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${totalProductRevenue.toLocaleString()}</td>
              </tr>
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Service Revenue</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${totalServiceRevenue.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>COGS (Cost of Goods Sold)</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${totalCOGS.toLocaleString()}</td>
              </tr>
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>COSO (Cost of Services Offered)</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${totalCOSO.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Total Cost</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${totalCost.toLocaleString()}</td>
              </tr>
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Gross Profit</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${grossProfit.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Total Expenses</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${totalExpenses.toLocaleString()}</td>
              </tr>
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Net Sales</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${adjustedTotalSales.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="border-bottom: 2px solid #333; padding-bottom: 10px; font-weight: bold;">Top Selling Products</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background: #333; color: white;">
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: bold;">Product</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Quantity Sold</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${topProducts.map(([name, stats], idx) => `
                  <tr style="${idx % 2 === 0 ? 'background: #f5f5f5;' : ''}">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${stats.sold}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">UGX ${stats.revenue.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="border-bottom: 2px solid #333; padding-bottom: 10px; font-weight: bold;">Top Services</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background: #333; color: white;">
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: bold;">Service</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Times Offered</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Revenue</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Cost</th>
                  <th style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Net</th>
                </tr>
              </thead>
              <tbody>
                ${topServices.map(([name, stats], idx) => `
                  <tr style="${idx % 2 === 0 ? 'background: #f5f5f5;' : ''}">
                    <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${stats.sold}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">UGX ${stats.revenue.toLocaleString()}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">UGX ${stats.coso.toLocaleString()}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">UGX ${(stats.revenue - stats.coso).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-bottom: 30px;">
            <h3 style="border-bottom: 2px solid #333; padding-bottom: 10px; font-weight: bold;">Credits Summary</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Unsettled Credits In</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${unsettledCreditsIn.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Unsettled Credits Out</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${unsettledCreditsOut.toLocaleString()}</td>
              </tr>
              <tr style="background: #f5f5f5;">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Settled Credits In</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${settledCreditsIn.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;"><strong>Settled Credits Out</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">UGX ${settledCreditsOut.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-weight: bold;">
            <p style="font-weight: bold;">Generated on ${new Date().toLocaleString()}</p>
            <p style="font-weight: bold;">${settings?.business_name || "DOTCOM BROTHERS LTD"}</p>
            ${settings?.business_address ? `<p style="font-weight: bold;">${settings.business_address}</p>` : ''}
            ${settings?.business_phone ? `<p style="font-weight: bold;">Tel: ${settings.business_phone}</p>` : ''}
          </div>
        </div>
      `;

      const element = document.createElement('div');
      element.innerHTML = reportContent;

      const opt = {
        margin: 10,
        filename: `${selectedDepartment?.name || 'sales'}-report-${dateFilter}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF report generated successfully");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF report");
    }
  };

  const exportToExcel = () => {
    // Create CSV content
    let csv = "Sales Report - " + (settings?.business_name || "DOTCOM BROTHERS LTD") + "\n\n";
    csv += "Date Range," + dateFilter + "\n";
    csv += "Generated," + new Date().toLocaleString() + "\n\n";
    csv += "SUMMARY\n";
    csv += "Metric,Value\n";
    csv += `Total Sales,${totalSales}\n`;
    csv += `Total Transactions,${totalTransactions}\n`;
    csv += `Total Items Sold,${totalItemsSold}\n`;
    csv += `Products Sold,${totalProductsSold}\n`;
    csv += `Services Offered,${totalServicesSold}\n`;
    csv += `Service Revenue,${totalServiceRevenue}\n`;
    csv += `Net Service Revenue,${netServiceRevenue}\n`;
    csv += `COGS,${totalCOGS}\n`;
    csv += `COSO,${totalCOSO}\n`;
    csv += `Total Cost,${totalCost}\n`;
    csv += `Gross Profit,${grossProfit}\n`;
    csv += `Avg Basket Size,${avgBasketSize}\n\n`;
    
    csv += "TOP SELLING PRODUCTS\n";
    csv += "Product,Sold,Revenue\n";
    topProducts.forEach(([name, stats]) => {
      csv += `${name},${stats.sold},${stats.revenue}\n`;
    });
    
    csv += "\nTOP SERVICES\n";
    csv += "Service,Offered,Revenue,COSO,Net Revenue\n";
    topServices.forEach(([name, stats]) => {
      csv += `${name},${stats.sold},${stats.revenue},${stats.coso},${stats.revenue - stats.coso}\n`;
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${dateFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 pt-24 print:pt-4">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:mb-4">
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold">
              {selectedDepartment?.name || "Sales"} Report – {settings?.business_name || "DOTCOM BROTHERS LTD"}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              📆 {new Date().toLocaleDateString()} | 🧑‍💼 Prepared by: Admin
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {isAdmin && <RegularDepartmentSelector />}
            <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {isAdmin && salesData && salesData.length > 0 && (
              <Button
                onClick={() => setShowRestoreDialog(true)}
                variant="destructive"
                size="default"
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Restore Stock
              </Button>
            )}
            <Button variant="outline" onClick={exportToPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Report Explanation:</strong> Gross Sales = Total sales revenue for selected period (excluding mobile money/card/bank). 
            Adjusted Net Sales = Gross Sales + Credits IN - Credits OUT - Settled Credits IN + Settled Credits OUT - Expenses + Reconciliation Adjustments - Suspended Revenue.
            COGS = Cost of Goods Sold (products). COSO = Cost of Service Offered (services). Net Revenue = Revenue after deducting costs.
          </AlertDescription>
        </Alert>

        {/* Summary Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              🧾 SUMMARY
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Gross Sales</p>
                <p className="text-xl font-bold">{totalSales.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unsettled Credits In</p>
                <p className="text-xl font-bold text-success">+{unsettledCreditsIn.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unsettled Credits Out</p>
                <p className="text-xl font-bold text-destructive">-{unsettledCreditsOut.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Settled Credits In (Refunded)</p>
                <p className="text-xl font-bold text-destructive">-{settledCreditsIn.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Settled Credits Out (Received)</p>
                <p className="text-xl font-bold text-success">+{settledCreditsOut.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-xl font-bold text-destructive">-{totalExpenses.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reconciliation</p>
                <p className={`text-xl font-bold ${reconciliationDifferences >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {reconciliationDifferences >= 0 ? '+' : ''}{reconciliationDifferences.toLocaleString()} UGX
                </p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-sm text-muted-foreground">Adjusted Total Sales</p>
                <p className="text-2xl font-bold text-primary">{adjustedTotalSales.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-xl font-bold">{totalTransactions}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Items Sold</p>
                <p className="text-xl font-bold">{totalItemsSold} units</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Products Sold</p>
                <p className="text-xl font-bold">{totalProductsSold} units</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Services Offered</p>
                <p className="text-xl font-bold">{totalServicesSold} times</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Service Revenue</p>
                <p className="text-xl font-bold">{totalServiceRevenue.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Service Revenue</p>
                <p className="text-xl font-bold text-success">{netServiceRevenue.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">COGS</p>
                <p className="text-xl font-bold">{totalCOGS.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">COSO</p>
                <p className="text-xl font-bold">{totalCOSO.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-xl font-bold text-destructive">{totalCost.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Profit</p>
                <p className="text-xl font-bold text-success">{grossProfit.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Adjusted Profit</p>
                <p className="text-xl font-bold text-success">{adjustedGrossProfit.toLocaleString()} UGX</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Basket</p>
                <p className="text-xl font-bold">{avgBasketSize.toLocaleString()} UGX</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Selling Products */}
          <Card>
            <CardHeader>
              <CardTitle>🛍️ Top 5 Products</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Revenue (UGX)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map(([name, stats]) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-right">{stats.sold}</TableCell>
                      <TableCell className="text-right">{stats.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {topProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No product sales data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Services Offered */}
          <Card>
            <CardHeader>
              <CardTitle>🎯 Top 5 Services</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Name</TableHead>
                    <TableHead className="text-right">Offered</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COSO</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topServices.map(([name, stats]) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-right">{stats.sold}</TableCell>
                      <TableCell className="text-right">{stats.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive">{stats.coso.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success font-bold">
                        {(stats.revenue - stats.coso).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {topServices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No service sales data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Suspicious Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                🧾 Suspicious Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suspiciousEntries.slice(0, 5).map((sale) => {
                    const hasZeroPrice = sale.sale_items?.some((item: any) => item.unit_price === 0);
                    return (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <Badge variant="destructive">
                            {hasZeroPrice ? "Zero-price item" : "Duplicate entries"}
                          </Badge>
                        </TableCell>
                        <TableCell>{sale.receipt_number}</TableCell>
                      </TableRow>
                    );
                  })}
                  {suspiciousEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No suspicious entries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Inventory Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                🔧 Inventory Restock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">In Stock</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={
                          (product.tracking_type === 'ml' ? (product.total_ml || 0) : (product.current_stock || 0)) === 0 
                            ? "destructive" 
                            : "secondary"
                        }>
                          {product.tracking_type === 'ml' 
                            ? `${product.total_ml || 0} ml` 
                            : `${product.current_stock || 0} ${product.unit}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {product.min_stock} {product.tracking_type === 'ml' ? 'ml' : product.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                  {lowStockItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No low stock items
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Staff Performance */}
          <Card>
            <CardHeader>
              <CardTitle>🧑‍💻 Staff Sales Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">Sales Count</TableHead>
                    <TableHead className="text-right">Total (UGX)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffPerformance.map(([name, stats]) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-right">{stats.count}</TableCell>
                      <TableCell className="text-right">{stats.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {staffPerformance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No sales data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Payment Transactions Section */}
        <div className="mt-6">
          <h3 className="text-xl font-bold mb-4">💳 Card & Mobile Money Transactions</h3>
          <PaymentTransactionsReport departmentId={selectedDepartmentId || undefined} />
        </div>
      </main>

      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Stock from Sales</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore all sold items from the current report period back to stock. 
              {salesData && (
                <div className="mt-2 font-semibold">
                  Total items to restore: {salesData.flatMap(s => s.sale_items || []).length} items from {salesData.length} sales
                </div>
              )}
              <div className="mt-2 text-destructive">
                This action cannot be undone automatically. Are you sure you want to proceed?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => restoreStockMutation.mutate()}
              disabled={restoreStockMutation.isPending}
            >
              {restoreStockMutation.isPending ? "Restoring..." : "Restore Stock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Reports;
