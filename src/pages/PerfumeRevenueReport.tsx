import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { PerfumeDepartmentSelector } from "@/components/PerfumeDepartmentSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DollarSign, TrendingUp, Package, Users, AlertCircle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { useFinancialRealtime } from "@/hooks/useRealtimeUpdates";

const PerfumeRevenueReport = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const { isAdmin, departmentId: userDepartmentId } = useUserRole();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  
  const departmentId = isAdmin && selectedDepartmentId ? selectedDepartmentId : userDepartmentId;
  
  // Enable realtime updates
  useFinancialRealtime(departmentId);

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

  const isPerfumeDepartment = !!userDepartment;

  // Block access for perfume departments - they should use their own reports
  if (!isAdmin && isPerfumeDepartment) {
    return (
      <div className="min-h-screen bg-background pt-32 lg:pt-20">
        <Navigation />
        <main className="container mx-auto p-4 md:p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This page is not accessible to perfume departments. Please use the perfume-specific reports.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }
  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["perfume-daily-revenue", today, departmentId],
    queryFn: async () => {
      const startOfDay = `${today}T00:00:00`;
      const endOfDay = `${today}T23:59:59`;
      
      let salesQuery = supabase.from("sales").select("*, sale_items(*)").gte("created_at", startOfDay).lte("created_at", endOfDay).eq("status", "completed");
      if (departmentId) salesQuery = salesQuery.eq("department_id", departmentId);
      const { data: sales } = await salesQuery;

      let expensesQuery = supabase.from("expenses").select("*").eq("expense_date", today);
      if (departmentId) expensesQuery = expensesQuery.eq("department_id", departmentId);
      const { data: expenses } = await expensesQuery;

      let creditsQuery = supabase.from("credits").select("*").gte("created_at", startOfDay).lte("created_at", endOfDay);
      if (departmentId) creditsQuery = creditsQuery.or(`from_department_id.eq.${departmentId},to_department_id.eq.${departmentId}`);
      const { data: credits } = await creditsQuery;

      let reconQuery = supabase.from("reconciliations").select("*").eq("date", today);
      if (departmentId) reconQuery = reconQuery.eq("department_id", departmentId);
      const { data: reconciliations } = await reconQuery;

      let voidQuery = supabase.from("sales").select("*, sale_items(*)").eq("status", "voided").gte("voided_at", startOfDay).lte("voided_at", endOfDay);
      if (departmentId) voidQuery = voidQuery.eq("department_id", departmentId);
      const { data: voidedSales } = await voidQuery;

      const retailSales = (sales || []).filter((s: any) => s.sale_items?.some((i: any) => i.customer_type === "retail"));
      const wholesaleSales = (sales || []).filter((s: any) => s.sale_items?.some((i: any) => i.customer_type === "wholesale"));

      const retailRevenue = retailSales.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const wholesaleRevenue = wholesaleSales.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const totalMlSold = (sales || []).reduce((sum: number, s: any) => sum + (s.sale_items?.reduce((iSum: number, i: any) => iSum + Number(i.ml_amount || 0), 0) || 0), 0);

      const creditsOut = (credits || []).filter((c: any) => c.from_department_id === departmentId).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
      const creditsIn = (credits || []).filter((c: any) => c.to_department_id === departmentId).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

      return {
        totalRevenue: retailRevenue + wholesaleRevenue,
        retailRevenue,
        wholesaleRevenue,
        retailCount: retailSales.length,
        wholesaleCount: wholesaleSales.length,
        totalMlSold,
        retailSales,
        wholesaleSales,
        creditsOut,
        creditsIn,
        netCredits: creditsIn - creditsOut,
        credits: credits || [],
        expenses: expenses || [],
        totalExpenses: (expenses || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0),
        netRevenue: retailRevenue + wholesaleRevenue - (expenses || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0),
        totalDifference: (reconciliations || []).reduce((sum: number, r: any) => sum + Number(r.discrepancy || 0), 0),
        reconciliations: reconciliations || [],
        totalVoidedAmount: (voidedSales || []).reduce((sum: number, s: any) => sum + Number(s.total || 0), 0),
        voidedCount: (voidedSales || []).length,
        voidedSales: voidedSales || [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Provide default values if revenueData is undefined
  const safeRevenueData = revenueData || {
    totalRevenue: 0,
    retailRevenue: 0,
    wholesaleRevenue: 0,
    retailCount: 0,
    wholesaleCount: 0,
    totalMlSold: 0,
    retailSales: [],
    wholesaleSales: [],
    creditsOut: 0,
    creditsIn: 0,
    netCredits: 0,
    credits: [],
    expenses: [],
    totalExpenses: 0,
    netRevenue: 0,
    totalDifference: 0,
    reconciliations: [],
    totalVoidedAmount: 0,
    voidedCount: 0,
    voidedSales: [],
  };

  const stats = [
    {
      title: "Total Revenue",
      value: `UGX ${(safeRevenueData.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      description: "Today's perfume sales",
      variant: "default" as const,
    },
    {
      title: "Retail Revenue",
      value: `UGX ${(safeRevenueData.retailRevenue || 0).toLocaleString()}`,
      icon: Users,
      description: `${safeRevenueData.retailCount || 0} transactions`,
      variant: "secondary" as const,
    },
    {
      title: "Wholesale Revenue",
      value: `UGX ${(safeRevenueData.wholesaleRevenue || 0).toLocaleString()}`,
      icon: TrendingUp,
      description: `${safeRevenueData.wholesaleCount || 0} transactions`,
      variant: "default" as const,
    },
    {
      title: "Total ML Sold",
      value: `${(safeRevenueData.totalMlSold || 0).toLocaleString()} ml`,
      icon: Package,
      description: "Across all perfumes",
      variant: "outline" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-primary" />
              Perfume Revenue Report
            </h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive daily breakdown for {format(new Date(), "MMMM d, yyyy")}
            </p>
          </div>
          {isAdmin && (
            <div className="min-w-[250px]">
              <PerfumeDepartmentSelector
                value={departmentId || ""}
                onChange={setSelectedDepartmentId}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Breakdown */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Retail Sales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Revenue:</span>
                <span className="text-2xl font-bold">
                  UGX {safeRevenueData.retailRevenue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Transactions:</span>
                <Badge variant="secondary">{safeRevenueData.retailCount}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Share of Total:</span>
                <span className="font-semibold">
                  {safeRevenueData.totalRevenue > 0 ? ((safeRevenueData.retailRevenue / safeRevenueData.totalRevenue) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Wholesale Sales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Revenue:</span>
                <span className="text-2xl font-bold">
                  UGX {safeRevenueData.wholesaleRevenue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Transactions:</span>
                <Badge variant="secondary">{safeRevenueData.wholesaleCount}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Share of Total:</span>
                <span className="font-semibold">
                  {safeRevenueData.totalRevenue > 0 ? ((safeRevenueData.wholesaleRevenue / safeRevenueData.totalRevenue) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expenses Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              Expenses Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="font-semibold">Total Expenses:</span>
                <span className="text-2xl font-bold text-destructive">
                  UGX {safeRevenueData.totalExpenses.toLocaleString()}
                </span>
              </div>
              {safeRevenueData.expenses.length > 0 ? (
                <div className="space-y-3">
                  {safeRevenueData.expenses.map((expense: any) => (
                    <div key={expense.id} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">{expense.description}</p>
                        <p className="text-sm text-muted-foreground">{expense.category}</p>
                      </div>
                      <span className="font-semibold">UGX {Number(expense.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No expenses recorded today</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reconciliations Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Reconciliations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="font-semibold">Total Difference:</span>
                <span className={`text-2xl font-bold ${safeRevenueData.totalDifference >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  UGX {safeRevenueData.totalDifference.toLocaleString()}
                </span>
              </div>
              {safeRevenueData.reconciliations.length > 0 ? (
                <div className="space-y-3">
                  {safeRevenueData.reconciliations.map((rec: any) => (
                    <div key={rec.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{rec.cashier_name}</p>
                          <Badge variant={rec.status === 'resolved' ? 'default' : 'secondary'} className="mt-1">
                            {rec.status}
                          </Badge>
                        </div>
                        <span className={`font-semibold ${Number(rec.difference) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                          {Number(rec.difference) >= 0 ? '+' : ''}UGX {Number(rec.difference).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div>
                          <span className="text-muted-foreground">System: </span>
                          <span>UGX {Number(rec.system_cash).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Reported: </span>
                          <span>UGX {Number(rec.reported_cash).toLocaleString()}</span>
                        </div>
                      </div>
                      {rec.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{rec.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No reconciliations recorded today</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Void Receipts Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Void Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="font-semibold">Total Voided Amount:</span>
                <span className="text-2xl font-bold text-destructive">
                  UGX {safeRevenueData.totalVoidedAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Voided Transactions:</span>
                <Badge variant="destructive">{safeRevenueData.voidedCount}</Badge>
              </div>
              {safeRevenueData.voidedSales.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {safeRevenueData.voidedSales.map((sale: any) => (
                    <div key={sale.id} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(sale.voided_at), "h:mm a")}
                          </p>
                          {sale.void_reason && (
                            <p className="text-sm mt-1">{sale.void_reason}</p>
                          )}
                        </div>
                        <span className="font-semibold text-destructive">
                          UGX {Number(sale.total).toLocaleString()}
                        </span>
                      </div>
                      {sale.sale_items && sale.sale_items.length > 0 && (
                        <div className="text-sm text-muted-foreground mt-2">
                          {sale.sale_items.map((item: any, idx: number) => (
                            <div key={idx}>
                              {item.scent_mixture} - {item.quantity}ml
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No voided receipts today</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Credits Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Credits Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 pb-4 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">Credits Out</p>
                  <p className="text-xl font-bold text-destructive">
                    UGX {safeRevenueData.creditsOut.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credits In</p>
                  <p className="text-xl font-bold text-green-600">
                    UGX {safeRevenueData.creditsIn.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Credits</p>
                  <p className={`text-xl font-bold ${safeRevenueData.netCredits >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    UGX {safeRevenueData.netCredits.toLocaleString()}
                  </p>
                </div>
              </div>
              {safeRevenueData.credits.length > 0 ? (
                <div className="space-y-3">
                  {safeRevenueData.credits.map((credit: any) => (
                    <div key={credit.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{credit.purpose}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant={credit.transaction_type === 'out' ? 'destructive' : 'default'}>
                              {credit.transaction_type}
                            </Badge>
                            <Badge variant={credit.status === 'approved' ? 'default' : 'secondary'}>
                              {credit.status}
                            </Badge>
                          </div>
                        </div>
                        <span className={`font-semibold ${credit.from_department_id === departmentId ? 'text-destructive' : 'text-green-600'}`}>
                          {credit.from_department_id === departmentId ? '-' : '+'}UGX {Number(credit.amount).toLocaleString()}
                        </span>
                      </div>
                      {credit.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{credit.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No credits recorded today</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PerfumeRevenueReport;
