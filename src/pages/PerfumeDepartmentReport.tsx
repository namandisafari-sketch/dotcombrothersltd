import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { PerfumeDepartmentSelector } from "@/components/PerfumeDepartmentSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { 
  DollarSign, 
  TrendingUp, 
  Droplet, 
  Package, 
  Users, 
  AlertCircle,
  Sparkles,
  Archive
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";

const PerfumeDepartmentReport = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const { isAdmin, departmentId: userDepartmentId } = useUserRole();

  // Check if user's department is a perfume department
  const { data: userDepartment } = useQuery({
    queryKey: ["user-department-check", userDepartmentId],
    queryFn: async () => {
      if (!userDepartmentId) return null;
      const { data } = await supabase.from("departments").select("*").eq("id", userDepartmentId).eq("is_perfume_department", true).maybeSingle();
      return data;
    },
    enabled: !!userDepartmentId && !isAdmin,
  });

  const isPerfumeDepartment = !!userDepartment || isAdmin;

  // Fetch sales data with perfume-specific items
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["perfume-sales-report", selectedDate, selectedDepartmentId],
    queryFn: async () => {
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;
      const deptId = selectedDepartmentId || userDepartmentId;

      let salesQuery = supabase.from("sales").select("*, sale_items(*)").gte("created_at", startOfDay).lte("created_at", endOfDay).eq("status", "completed");
      if (deptId) salesQuery = salesQuery.eq("department_id", deptId);
      const { data: sales } = await salesQuery;

      let usageQuery = supabase.from("internal_stock_usage").select("*, products(name)").gte("created_at", startOfDay).lte("created_at", endOfDay);
      if (deptId) usageQuery = usageQuery.eq("department_id", deptId);
      const { data: internalUsage } = await usageQuery;

      const retailSales = (sales || []).filter((s: any) => s.sale_items?.some((i: any) => i.customer_type === "retail"));
      const wholesaleSales = (sales || []).filter((s: any) => s.sale_items?.some((i: any) => i.customer_type === "wholesale"));

      const retailMl = retailSales.reduce((sum: number, s: any) => sum + (s.sale_items?.reduce((iSum: number, i: any) => iSum + Number(i.ml_amount || 0), 0) || 0), 0);
      const wholesaleMl = wholesaleSales.reduce((sum: number, s: any) => sum + (s.sale_items?.reduce((iSum: number, i: any) => iSum + Number(i.ml_amount || 0), 0) || 0), 0);
      const retailRevenue = retailSales.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const wholesaleRevenue = wholesaleSales.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const totalMl = retailMl + wholesaleMl;
      const totalRevenue = retailRevenue + wholesaleRevenue;
      const bottleCosts = (sales || []).reduce((sum: number, s: any) => sum + (s.sale_items?.reduce((iSum: number, i: any) => iSum + Number(i.bottle_cost || 0), 0) || 0), 0);

      // Calculate top scents
      const scentMap: Record<string, { ml: number; revenue: number }> = {};
      (sales || []).forEach((s: any) => {
        s.sale_items?.forEach((i: any) => {
          if (i.scent_mixture) {
            if (!scentMap[i.scent_mixture]) scentMap[i.scent_mixture] = { ml: 0, revenue: 0 };
            scentMap[i.scent_mixture].ml += Number(i.ml_amount || 0);
            scentMap[i.scent_mixture].revenue += Number(i.total || 0);
          }
        });
      });
      const topScents = Object.entries(scentMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.ml - a.ml).slice(0, 10);

      // Split internal usage by reason
      const sacrificedItems = (internalUsage || []).filter((u: any) => u.reason?.toLowerCase().includes("sacrifice") || u.reason?.toLowerCase().includes("wasted"));
      const internalItems = (internalUsage || []).filter((u: any) => !u.reason?.toLowerCase().includes("sacrifice") && !u.reason?.toLowerCase().includes("wasted"));

      return {
        sales: sales || [],
        internalUsage: internalUsage || [],
        totalMl,
        totalRevenue,
        netRevenue: totalRevenue - bottleCosts,
        bottleCosts,
        totalBottleCosts: bottleCosts,
        transactionCount: (sales || []).length,
        totalTransactions: (sales || []).length,
        retailTransactions: retailSales.length,
        wholesaleTransactions: wholesaleSales.length,
        retailMl,
        wholesaleMl,
        retailRevenue,
        wholesaleRevenue,
        topScents,
        sacrificedItems,
        internalItems,
        totalSacrificed: sacrificedItems.reduce((sum: number, u: any) => sum + Number(u.ml_quantity || 0), 0),
        totalInternal: internalItems.reduce((sum: number, u: any) => sum + Number(u.ml_quantity || 0), 0),
      };
    },
  });

  const internalUsage = salesData?.internalUsage;

  // Only allow access to perfume departments or admins
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

  if (salesLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Total ML Sold",
      value: `${(salesData?.totalMl || 0).toLocaleString()} ml`,
      icon: Droplet,
      description: "Combined retail & wholesale",
      color: "text-blue-500"
    },
    {
      title: "Net Revenue",
      value: `UGX ${(salesData?.netRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      description: "After bottle costs",
      color: "text-green-500"
    },
    {
      title: "Total Transactions",
      value: salesData?.totalTransactions || 0,
      icon: Users,
      description: `${salesData?.retailTransactions || 0} retail, ${salesData?.wholesaleTransactions || 0} wholesale`,
      color: "text-purple-500"
    },
    {
      title: "Bottle Costs",
      value: `UGX ${(salesData?.totalBottleCosts || 0).toLocaleString()}`,
      icon: Package,
      description: "Total packaging cost",
      color: "text-orange-500"
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Perfume Department Report</h1>
            <p className="text-muted-foreground">
            ML-based sales tracking with scent analytics
          </p>
        </div>
        <PerfumeDepartmentSelector 
          value={selectedDepartmentId} 
          onChange={setSelectedDepartmentId} 
        />
      </div>

        <div className="flex gap-4 items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-md border bg-background"
          />
          <Badge variant="outline">
            {format(new Date(selectedDate), "MMMM dd, yyyy")}
          </Badge>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="breakdown" className="space-y-4">
          <TabsList>
            <TabsTrigger value="breakdown">Sales Breakdown</TabsTrigger>
            <TabsTrigger value="scents">Scent Analytics</TabsTrigger>
            <TabsTrigger value="internal">Internal Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="breakdown" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Retail Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Retail Sales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">ML Sold</p>
                    <p className="text-2xl font-bold">{salesData?.retailMl || 0} ml</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold">
                      UGX {(salesData?.retailRevenue || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transactions</p>
                    <p className="text-xl font-semibold">{salesData?.retailTransactions || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Price per ML</p>
                    <p className="text-lg font-medium">
                      UGX {salesData?.retailMl ? Math.round((salesData?.retailRevenue || 0) / salesData.retailMl) : 0}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Wholesale Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    Wholesale Sales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">ML Sold</p>
                    <p className="text-2xl font-bold">{salesData?.wholesaleMl || 0} ml</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold">
                      UGX {(salesData?.wholesaleRevenue || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transactions</p>
                    <p className="text-xl font-semibold">{salesData?.wholesaleTransactions || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Price per ML</p>
                    <p className="text-lg font-medium">
                      UGX {salesData?.wholesaleMl ? Math.round((salesData?.wholesaleRevenue || 0) / salesData.wholesaleMl) : 0}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-pink-500" />
                  Top 10 Most Used Scents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salesData?.topScents && salesData.topScents.length > 0 ? (
                  <div className="space-y-3">
                    {salesData.topScents.map((scent: any, index: number) => (
                      <div key={scent.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <span className="font-medium">{scent.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{scent.ml} ml</span>
                          <Badge>UGX {scent.revenue.toLocaleString()}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No scent data available for this date
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="internal" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-yellow-500" />
                    Display / Sacrificed Stock
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items Sacrificed</p>
                    <p className="text-2xl font-bold">{salesData?.sacrificedItems?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Quantity</p>
                    <p className="text-xl font-semibold">
                      {salesData?.totalSacrificed || 0} ml
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-500" />
                    Other Internal Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items Used</p>
                    <p className="text-2xl font-bold">{salesData?.internalItems?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Quantity</p>
                    <p className="text-xl font-semibold">
                      {salesData?.totalInternal || 0} ml
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PerfumeDepartmentReport;
