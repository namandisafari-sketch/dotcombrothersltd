import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Droplet, DollarSign, AlertTriangle, TrendingUp, Sparkles, Package } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { PerfumeDepartmentSelector } from "@/components/PerfumeDepartmentSelector";
import { useState } from "react";
import { useDashboardRealtime, useInventoryRealtime } from "@/hooks/useRealtimeUpdates";

export default function PerfumeDashboard() {
  const { isAdmin, departmentId: userDepartmentId, isLoading: roleLoading } = useUserRole();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);

  // Admins can select any perfume department, others use their assigned department
  const departmentId = isAdmin && selectedDepartmentId ? selectedDepartmentId : userDepartmentId;
  
  // Enable realtime updates with toast notifications
  useDashboardRealtime(departmentId);
  useInventoryRealtime(departmentId);

  // Check if user's department is a perfume department
  const { data: userDepartment, isLoading: deptLoading } = useQuery({
    queryKey: ["user-department", departmentId],
    queryFn: async () => {
      if (!departmentId) return null;
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", departmentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!departmentId,
  });

  const isPerfumeDepartment = userDepartment?.is_perfume_department;
  const hasAccess = isAdmin || isPerfumeDepartment;
  const isLoadingDepartment = roleLoading || deptLoading;

  // Today's sales revenue
  const { data: todayRevenue } = useQuery({
    queryKey: ["perfume-today-revenue", departmentId],
    queryFn: async () => {
      if (!departmentId) return 0;
      
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("sales")
        .select("total")
        .eq("department_id", departmentId)
        .neq("status", "voided")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);
      
      if (error) throw error;
      return (data || []).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    },
    enabled: !!departmentId && hasAccess,
    refetchInterval: 5000,
  });

  // Total stock = sum of all scent stock_ml
  const { data: totalStock } = useQuery({
    queryKey: ["perfume-stock", departmentId],
    queryFn: async () => {
      if (!departmentId) return 0;
      
      // Fetch department-specific scents
      const { data: deptScents, error: deptError } = await supabase
        .from("perfume_scents")
        .select("stock_ml")
        .eq("department_id", departmentId)
        .eq("is_active", true);
      
      if (deptError) throw deptError;
      
      // Fetch global scents (null department)
      const { data: globalScents, error: globalError } = await supabase
        .from("perfume_scents")
        .select("stock_ml")
        .is("department_id", null)
        .eq("is_active", true);
      
      if (globalError) throw globalError;
      
      const allScents = [...(deptScents || []), ...(globalScents || [])];
      return allScents.reduce((sum, scent) => sum + (scent.stock_ml || 0), 0);
    },
    enabled: !!departmentId && hasAccess,
    refetchInterval: 5000,
  });

  // Low stock scents (individual scents running low)
  const { data: lowStockProducts } = useQuery({
    queryKey: ["perfume-low-stock", departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      
      // Fetch department-specific scents
      const { data: deptScents, error: deptError } = await supabase
        .from("perfume_scents")
        .select("id, name, stock_ml")
        .eq("department_id", departmentId)
        .eq("is_active", true);
      
      if (deptError) throw deptError;
      
      // Fetch global scents (null department)
      const { data: globalScents, error: globalError } = await supabase
        .from("perfume_scents")
        .select("id, name, stock_ml")
        .is("department_id", null)
        .eq("is_active", true);
      
      if (globalError) throw globalError;
      
      const allScents = [...(deptScents || []), ...(globalScents || [])];
      // Return scents with stock below 100ml as low stock
      return allScents
        .filter(s => (s.stock_ml || 0) < 100)
        .sort((a, b) => (a.stock_ml || 0) - (b.stock_ml || 0))
        .slice(0, 5);
    },
    enabled: !!departmentId && hasAccess,
    refetchInterval: 5000,
  });

  // Recent sales (excluding voided)
  const { data: recentSales } = useQuery({
    queryKey: ["perfume-recent-sales", departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("department_id", departmentId)
        .neq("status", "voided")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!departmentId && hasAccess,
    refetchInterval: 5000,
  });

  // Popular scents (from recent sales, excluding voided)
  const { data: popularScents } = useQuery({
    queryKey: ["popular-scents", departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      
      // Get sales for this department
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id")
        .eq("department_id", departmentId)
        .neq("status", "voided");
      
      if (salesError) throw salesError;
      if (!sales || sales.length === 0) return [];
      
      const saleIds = sales.map(s => s.id);
      
      // Get sale items with scent mixtures
      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("scent_mixture")
        .in("sale_id", saleIds)
        .not("scent_mixture", "is", null);
      
      if (itemsError) throw itemsError;
      
      // Count scent mixtures
      const scentCounts: Record<string, number> = {};
      (items || []).forEach((item) => {
        if (item.scent_mixture) {
          scentCounts[item.scent_mixture] = (scentCounts[item.scent_mixture] || 0) + 1;
        }
      });

      return Object.entries(scentCounts)
        .map(([scent, count]) => ({ scent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
    enabled: !!departmentId && hasAccess,
    refetchInterval: 10000,
  });

  // Total sales count today (excluding voided)
  const { data: todaySalesCount } = useQuery({
    queryKey: ["perfume-today-sales-count", departmentId],
    queryFn: async () => {
      if (!departmentId) return 0;
      
      const today = new Date().toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .eq("department_id", departmentId)
        .neq("status", "voided")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!departmentId && hasAccess,
    refetchInterval: 5000,
  });

  // NOW we can do conditional rendering AFTER all hooks
  if (isLoadingDepartment) {
    return (
      <div className="min-h-screen bg-background pt-32 lg:pt-20">
        <Navigation />
        <main className="container mx-auto p-4 md:p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your perfume shop...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!departmentId && !isAdmin) {
    return (
      <div className="min-h-screen bg-background pt-32 lg:pt-20">
        <Navigation />
        <main className="container mx-auto p-4 md:p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No department assigned. Please contact your administrator.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  if (!isAdmin && !isPerfumeDepartment) {
    return (
      <div className="min-h-screen bg-background pt-32 lg:pt-20">
        <Navigation />
        <main className="container mx-auto p-4 md:p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This page is only for perfume shops. Your shop does not sell perfumes.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-32 lg:pt-20">
      <Navigation />
      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Droplet className="h-8 w-8 text-primary" />
              My Perfume Shop
            </h1>
            <p className="text-muted-foreground mt-1">
              {userDepartment?.name || "Your Perfume Shop"}
            </p>
          </div>
          {isAdmin && (
            <div className="min-w-[250px]">
              <PerfumeDepartmentSelector
                value={selectedDepartmentId || userDepartmentId || ""}
                onChange={setSelectedDepartmentId}
              />
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today Money</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                UGX {todayRevenue?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                From {todaySalesCount || 0} sales today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">All Stock</CardTitle>
              <Droplet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalStock?.toLocaleString() || 0} ml
              </div>
              <p className="text-xs text-muted-foreground">
                All perfume in shop
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Need More Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {lowStockProducts?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Perfumes low on stock
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Scents</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {popularScents?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Popular scent mixes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts && lowStockProducts.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{lowStockProducts.length} perfume(s)</strong> need more stock soon!
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Sales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                New Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSales && recentSales.length > 0 ? (
                <div className="space-y-4">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{sale.receipt_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(sale.created_at), "h:mm a")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">UGX {Number(sale.total).toLocaleString()}</p>
                        <Badge variant="outline" className="text-xs">
                          {sale.payment_method}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No sales yet today</p>
              )}
            </CardContent>
          </Card>

          {/* Popular Scents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Top Scent Mixes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {popularScents && popularScents.length > 0 ? (
                <div className="space-y-3">
                  {popularScents.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <p className="text-sm font-medium">{item.scent}</p>
                      <Badge>{item.count} sales</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No scent data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Products Table */}
        {lowStockProducts && lowStockProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Perfumes Need More Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scent Name</TableHead>
                    <TableHead>Stock Now</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((scent) => (
                    <TableRow key={scent.id}>
                      <TableCell className="font-medium">{scent.name}</TableCell>
                      <TableCell>{Number(scent.stock_ml || 0).toLocaleString()} ml</TableCell>
                      <TableCell>100 ml</TableCell>
                      <TableCell>
                        <Badge variant={(scent.stock_ml || 0) === 0 ? "destructive" : "secondary"}>
                          {(scent.stock_ml || 0) === 0 ? "Empty" : "Low"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
