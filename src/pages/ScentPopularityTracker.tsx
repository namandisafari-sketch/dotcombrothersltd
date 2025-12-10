import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { PerfumeDepartmentSelector } from "@/components/PerfumeDepartmentSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";

export default function ScentPopularityTracker() {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const { isAdmin, departmentId: userDepartmentId } = useUserRole();

  const { data: userDepartment } = useQuery({
    queryKey: ["user-department-check", userDepartmentId],
    queryFn: async () => {
      if (!userDepartmentId) return null;
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", userDepartmentId)
        .eq("is_perfume_department", true)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!userDepartmentId && !isAdmin,
  });

  const isPerfumeDepartment = !!userDepartment || isAdmin;

  if (!isAdmin && !isPerfumeDepartment) {
    return (
      <div className="min-h-screen bg-background pt-32 lg:pt-20">
        <Navigation />
        <main className="container mx-auto p-4 md:p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This page is only accessible to users in departments that manage oil perfumes.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  const activeDepartmentId = isAdmin ? selectedDepartmentId : userDepartmentId;

  const { data: scentData } = useQuery({
    queryKey: ["scent-popularity", activeDepartmentId],
    queryFn: async () => {
      // Get sales for the department
      let salesQuery = supabase
        .from("sales")
        .select("id")
        .eq("status", "completed");
      
      if (activeDepartmentId) {
        salesQuery = salesQuery.eq("department_id", activeDepartmentId);
      }
      
      const { data: sales, error: salesError } = await salesQuery;
      if (salesError || !sales) return [];
      
      const saleIds = sales.map(s => s.id);
      if (saleIds.length === 0) return [];
      
      // Get sale items with scent mixture
      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("*")
        .in("sale_id", saleIds)
        .not("scent_mixture", "is", null);
      
      if (itemsError || !items) return [];
      
      // Aggregate by scent
      const scentMap = new Map<string, { count: number; revenue: number; totalMl: number }>();
      
      items.forEach(item => {
        const scent = item.scent_mixture || "Unknown";
        const existing = scentMap.get(scent) || { count: 0, revenue: 0, totalMl: 0 };
        scentMap.set(scent, {
          count: existing.count + 1,
          revenue: existing.revenue + Number(item.total || 0),
          totalMl: existing.totalMl + Number(item.ml_amount || 0),
        });
      });
      
      return Array.from(scentMap.entries()).map(([scent, data]) => ({
        scent,
        ...data,
      })).sort((a, b) => b.count - a.count);
    },
    enabled: isAdmin || isPerfumeDepartment,
  });

  const totalSales = scentData?.reduce((sum, item) => sum + item.count, 0) || 0;
  const totalRevenue = scentData?.reduce((sum, item) => sum + item.revenue, 0) || 0;
  const totalMl = scentData?.reduce((sum, item) => sum + item.totalMl, 0) || 0;

  return (
    <div className="min-h-screen bg-background pt-32 lg:pt-20">
      <Navigation />
      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Scent Popularity Tracker</h1>
          </div>
          <PerfumeDepartmentSelector 
            value={selectedDepartmentId} 
            onChange={setSelectedDepartmentId} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Uses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalSales}</p>
              <p className="text-xs text-muted-foreground">Scent applications</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">UGX {totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">From scent sales</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total ML Used</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalMl.toLocaleString()} ml</p>
              <p className="text-xs text-muted-foreground">Across all scents</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Unique Scents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{scentData?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Different scents used</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Most Popular Scents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scentData && scentData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Scent Name</TableHead>
                    <TableHead className="text-right">Times Used</TableHead>
                    <TableHead className="text-right">Total ML</TableHead>
                    <TableHead className="text-right">Revenue (UGX)</TableHead>
                    <TableHead className="text-right">Avg per Use</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scentData.map((item, index) => (
                    <TableRow key={item.scent}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-semibold">{item.scent}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right">{item.totalMl.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{item.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {(item.revenue / item.count).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No scent data available yet</p>
                <p className="text-sm mt-2">Sales with scent mixtures will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
