import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { PerfumeDepartmentSelector } from "@/components/PerfumeDepartmentSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, AlertCircle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";

export default function PerfumeAnalytics() {
  const { isAdmin, departmentId: userDepartmentId } = useUserRole();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);

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

  const isPerfumeDepartment = !!userDepartment;
  const activeDepartmentId = isAdmin ? selectedDepartmentId : (isPerfumeDepartment ? userDepartmentId : null);

  const { data: perfumeSales } = useQuery({
    queryKey: ["perfume-analytics", activeDepartmentId],
    queryFn: async () => {
      if (!activeDepartmentId) return [];
      
      const { data: sales, error } = await supabase
        .from("sales")
        .select("id")
        .eq("department_id", activeDepartmentId)
        .eq("status", "completed");
      
      if (error || !sales) return [];
      
      const saleIds = sales.map(s => s.id);
      if (saleIds.length === 0) return [];
      
      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("*")
        .in("sale_id", saleIds)
        .ilike("item_name", "%perfume refill%");
      
      if (itemsError) return [];
      return items || [];
    },
    enabled: isAdmin || isPerfumeDepartment,
  });

  const scentCombinations = perfumeSales?.reduce((acc: any[], item) => {
    const match = item.item_name?.match(/\((.*?)\)/);
    if (match) {
      const scents = match[1];
      const existing = acc.find(a => a.scents === scents);
      if (existing) {
        existing.count += 1;
        existing.revenue += Number(item.total);
      } else {
        acc.push({ scents, count: 1, revenue: Number(item.total) });
      }
    }
    return acc;
  }, []).sort((a, b) => b.count - a.count).slice(0, 10) || [];

  const bottleSizes = perfumeSales?.reduce((acc: any[], item) => {
    const size = item.quantity;
    const existing = acc.find(a => a.size === size);
    if (existing) {
      existing.count += 1;
      existing.revenue += Number(item.total);
    } else {
      acc.push({ size, count: 1, revenue: Number(item.total) });
    }
    return acc;
  }, []).sort((a, b) => b.count - a.count) || [];

  const customerTypeData = perfumeSales?.reduce((acc: any, item) => {
    const isWholesale = item.customer_type === "wholesale";
    if (isWholesale) {
      acc.wholesale += Number(item.total);
      acc.wholesaleCount += 1;
    } else {
      acc.retail += Number(item.total);
      acc.retailCount += 1;
    }
    return acc;
  }, { retail: 0, wholesale: 0, retailCount: 0, wholesaleCount: 0 }) || { retail: 0, wholesale: 0, retailCount: 0, wholesaleCount: 0 };

  const pieData = [
    { name: "Retail", value: customerTypeData.retail, count: customerTypeData.retailCount },
    { name: "Wholesale", value: customerTypeData.wholesale, count: customerTypeData.wholesaleCount },
  ];

  const avgBottleSize = perfumeSales && perfumeSales.length > 0
    ? perfumeSales.reduce((sum, item) => sum + (item.quantity || 0), 0) / perfumeSales.length
    : 0;

  const totalRevenue = perfumeSales?.reduce((sum, item) => sum + Number(item.total), 0) || 0;
  const totalSales = perfumeSales?.length || 0;

  if (!isAdmin && !isPerfumeDepartment) {
    return (
      <div className="min-h-screen bg-background pt-32 lg:pt-20">
        <Navigation />
        <main className="container mx-auto p-4 md:p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This page is only accessible to perfume departments.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Perfume Sales Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive analytics for perfume sales
            </p>
          </div>
          {isAdmin && (
            <div className="min-w-[250px]">
              <PerfumeDepartmentSelector 
                value={selectedDepartmentId} 
                onChange={setSelectedDepartmentId} 
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">UGX {totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalSales}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Sale Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                UGX {totalSales > 0 ? (totalRevenue / totalSales).toLocaleString() : 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Bottle Size</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{avgBottleSize.toFixed(0)} ml</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="scents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scents">Top Scent Combinations</TabsTrigger>
            <TabsTrigger value="sizes">Bottle Sizes</TabsTrigger>
            <TabsTrigger value="customer">Retail vs Wholesale</TabsTrigger>
          </TabsList>

          <TabsContent value="scents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Scent Combinations</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Rank</TableHead>
                      <TableHead>Scent Combination</TableHead>
                      <TableHead className="text-right">Sales Count</TableHead>
                      <TableHead className="text-right">Revenue (UGX)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scentCombinations.length > 0 ? (
                      scentCombinations.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{item.scents}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right">{item.revenue.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No scent combination data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sizes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Popular Bottle Sizes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bottle Size (ml)</TableHead>
                      <TableHead className="text-right">Sales Count</TableHead>
                      <TableHead className="text-right">Revenue (UGX)</TableHead>
                      <TableHead className="text-right">Avg Price per Sale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bottleSizes.length > 0 ? (
                      bottleSizes.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.size} ml</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right">{item.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{(item.revenue / item.count).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No bottle size data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Retail vs Wholesale Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Type</TableHead>
                      <TableHead className="text-right">Sales Count</TableHead>
                      <TableHead className="text-right">Total Revenue (UGX)</TableHead>
                      <TableHead className="text-right">Avg per Sale</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pieData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right">{item.value.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {item.count > 0 ? (item.value / item.count).toLocaleString() : 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(1) : 0}%
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{pieData.reduce((sum, item) => sum + item.count, 0)}</TableCell>
                      <TableCell className="text-right">{totalRevenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
