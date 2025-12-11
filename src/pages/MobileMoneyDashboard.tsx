import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, ShoppingCart, Package } from "lucide-react";
import { useDepartment } from "@/contexts/DepartmentContext";
import { format } from "date-fns";
import { useDashboardRealtime } from "@/hooks/useRealtimeUpdates";

const MobileMoneyDashboard = () => {
  const { selectedDepartmentId } = useDepartment();
  
  // Enable realtime updates with toast notifications
  useDashboardRealtime(selectedDepartmentId);

  const { data: todaySales = [] } = useQuery({
    queryKey: ["mobile-money-sales-today", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*)")
        .eq("department_id", selectedDepartmentId)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .neq("status", "voided");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
    refetchInterval: 5000,
  });

  const { data: allSales = [] } = useQuery({
    queryKey: ["mobile-money-sales-all", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*), customers(name)")
        .eq("department_id", selectedDepartmentId)
        .neq("status", "voided")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
    refetchInterval: 5000,
  });

  const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalRevenue = allSales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalCustomers = new Set(allSales.filter(s => s.customer_id).map(s => s.customer_id)).size;
  const totalTransactions = allSales.length;

  const allSaleItems = allSales.flatMap((sale: any) => sale.sale_items || []);
  const productSales = allSaleItems.filter((item: any) => item.product_id).length;
  const serviceSales = allSaleItems.filter((item: any) => item.service_id).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Mobile Money Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">UGX {todayRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{todaySales.length} sales today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">UGX {totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Unique customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">Completed sales</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Product Sales</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Package className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{productSales}</div>
                <p className="text-xs text-muted-foreground">Total products sold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Service Sales</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{serviceSales}</div>
                <p className="text-xs text-muted-foreground">Total services sold</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allSales.slice(0, 10).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                <div className="space-y-1">
                  <p className="font-medium">{sale.customers?.name || "Walk-in Customer"}</p>
                  <p className="text-sm text-muted-foreground">
                    Receipt: {sale.receipt_number} • {sale.payment_method}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(sale.created_at!), "PPp")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">UGX {Number(sale.total).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{sale.sale_items?.length || 0} items</p>
                </div>
              </div>
            ))}
            {allSales.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No sales yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileMoneyDashboard;