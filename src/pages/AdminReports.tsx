import { useQuery } from "@tanstack/react-query";
import { localApi } from "@/lib/localApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { DollarSign, TrendingUp, TrendingDown, FileText, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const AdminReports = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"current" | "previous" | "ytd">("current");

  const isAdmin = user?.role === "admin";

  const getDateRange = () => {
    const now = new Date();
    if (period === "current") {
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        label: format(now, "MMMM yyyy"),
      };
    } else if (period === "previous") {
      const prevMonth = subMonths(now, 1);
      return {
        start: startOfMonth(prevMonth),
        end: endOfMonth(prevMonth),
        label: format(prevMonth, "MMMM yyyy"),
      };
    } else {
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: now,
        label: `Year to Date (${now.getFullYear()})`,
      };
    }
  };

  const dateRange = getDateRange();

  // Fetch all financial data
  const { data: financialData, isLoading } = useQuery({
    queryKey: ["financial-data", period],
    queryFn: async () => {
      const [sales, expenses, credits, products, customers, reconciliations] = await Promise.all([
        localApi.sales.getAll(),
        localApi.expenses.getAll(),
        localApi.credits.getAll(),
        localApi.products.getAll(),
        localApi.customers.getAll(),
        localApi.reconciliations.getAll(),
      ]);

      // Filter by date range
      const filteredSales = sales.filter((sale: any) => {
        const saleDate = new Date(sale.created_at);
        return saleDate >= dateRange.start && saleDate <= dateRange.end && sale.status !== 'voided';
      });

      const filteredExpenses = expenses.filter((expense: any) => {
        const expenseDate = new Date(expense.expense_date || expense.created_at);
        return expenseDate >= dateRange.start && expenseDate <= dateRange.end;
      });

      // Calculate totals
      const totalRevenue = filteredSales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
      const cashSales = filteredSales.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
      const creditSales = filteredSales.filter((s: any) => s.payment_method === 'credit').reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
      const mobileMoneySales = filteredSales.filter((s: any) => ['mobile_money', 'card', 'bank'].includes(s.payment_method)).reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
      
      const totalExpenses = filteredExpenses.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);
      
      // Group expenses by category
      const expensesByCategory = filteredExpenses.reduce((acc: any, expense: any) => {
        const category = expense.category || 'Other';
        acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
        return acc;
      }, {});

      // Calculate Cost of Goods Sold (estimated from product cost prices)
      const costOfGoodsSold = filteredSales.reduce((sum: number, sale: any) => {
        // Estimate COGS as 60% of revenue for simplicity
        return sum + (Number(sale.total || 0) * 0.6);
      }, 0);

      // Calculate inventory value
      const inventoryValue = products.reduce((sum: number, product: any) => {
        const stock = Number(product.stock || 0);
        const costPrice = Number(product.cost_price || product.price * 0.6 || 0);
        return sum + (stock * costPrice);
      }, 0);

      // Calculate accounts receivable (customer outstanding balances)
      const accountsReceivable = customers.reduce((sum: number, customer: any) => {
        return sum + Number(customer.outstanding_balance || 0);
      }, 0);

      // Calculate credits/loans data
      const totalCreditsReceivable = credits
        .filter((c: any) => c.status !== 'settled' && c.transaction_type === 'interdepartmental')
        .reduce((sum: number, c: any) => sum + Number(c.amount || 0) - Number(c.paid_amount || 0), 0);

      const totalCreditsPayable = credits
        .filter((c: any) => c.status !== 'settled' && c.transaction_type === 'customer_credit')
        .reduce((sum: number, c: any) => sum + Number(c.amount || 0) - Number(c.paid_amount || 0), 0);

      // Cash on hand from reconciliations
      const latestReconciliation = reconciliations.sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      const cashOnHand = latestReconciliation ? Number(latestReconciliation.reported_cash || 0) : 0;

      return {
        // Income Statement
        totalRevenue,
        cashSales,
        creditSales,
        mobileMoneySales,
        costOfGoodsSold,
        grossProfit: totalRevenue - costOfGoodsSold,
        totalExpenses,
        expensesByCategory,
        operatingIncome: totalRevenue - costOfGoodsSold - totalExpenses,
        netIncome: totalRevenue - costOfGoodsSold - totalExpenses,
        
        // Balance Sheet
        cashOnHand,
        accountsReceivable,
        inventoryValue,
        totalCurrentAssets: cashOnHand + accountsReceivable + inventoryValue + mobileMoneySales,
        totalCreditsReceivable,
        totalCreditsPayable,
        
        // Cash Flow
        operatingCashFlow: cashSales - totalExpenses,
        investingCashFlow: 0, // Would need asset purchases data
        financingCashFlow: totalCreditsReceivable - totalCreditsPayable,
        
        // Counts
        salesCount: filteredSales.length,
        expensesCount: filteredExpenses.length,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const formatCurrency = (amount: number) => {
    return `UGX ${amount.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">Financial Reports</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Standard financial statements for {dateRange.label}
            </p>
          </div>
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="previous">Previous Month</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(financialData?.totalRevenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {financialData?.salesCount || 0} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <TrendingDown className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(financialData?.totalExpenses || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {financialData?.expensesCount || 0} expense records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              <TrendingUp className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(financialData?.grossProfit || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(financialData?.grossProfit || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {((financialData?.grossProfit || 0) / (financialData?.totalRevenue || 1) * 100).toFixed(1)}% margin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Income</CardTitle>
              <FileText className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(financialData?.netIncome || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(financialData?.netIncome || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {((financialData?.netIncome || 0) / (financialData?.totalRevenue || 1) * 100).toFixed(1)}% net margin
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="income" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="income">Income Statement</TabsTrigger>
            <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          </TabsList>

          {/* Income Statement */}
          <TabsContent value="income">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Income Statement
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  For the period ending {format(dateRange.end, "MMMM d, yyyy")}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60%]">Description</TableHead>
                      <TableHead className="text-right">Amount (UGX)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Revenue Section */}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">REVENUE</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Cash Sales</TableCell>
                      <TableCell className="text-right">{(financialData?.cashSales || 0).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Credit Sales</TableCell>
                      <TableCell className="text-right">{(financialData?.creditSales || 0).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Mobile Money & Card Sales</TableCell>
                      <TableCell className="text-right">{(financialData?.mobileMoneySales || 0).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">Total Revenue</TableCell>
                      <TableCell className="text-right font-semibold text-success">
                        {(financialData?.totalRevenue || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>

                    {/* Cost of Goods Sold */}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">COST OF GOODS SOLD</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8">Cost of Goods Sold (Est.)</TableCell>
                      <TableCell className="text-right text-destructive">
                        ({(financialData?.costOfGoodsSold || 0).toLocaleString()})
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">Gross Profit</TableCell>
                      <TableCell className={`text-right font-semibold ${(financialData?.grossProfit || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {(financialData?.grossProfit || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>

                    {/* Operating Expenses */}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">OPERATING EXPENSES</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {financialData?.expensesByCategory && Object.entries(financialData.expensesByCategory).map(([category, amount]) => (
                      <TableRow key={category}>
                        <TableCell className="pl-8">{category}</TableCell>
                        <TableCell className="text-right text-destructive">
                          ({(amount as number).toLocaleString()})
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t">
                      <TableCell className="pl-8 font-medium">Total Operating Expenses</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        ({(financialData?.totalExpenses || 0).toLocaleString()})
                      </TableCell>
                    </TableRow>

                    {/* Net Income */}
                    <TableRow className="border-t-4 bg-muted">
                      <TableCell className="font-bold text-lg">NET INCOME</TableCell>
                      <TableCell className={`text-right font-bold text-lg ${(financialData?.netIncome || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {(financialData?.netIncome || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Sheet */}
          <TabsContent value="balance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Balance Sheet
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  As of {format(dateRange.end, "MMMM d, yyyy")}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Assets */}
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60%]">ASSETS</TableHead>
                          <TableHead className="text-right">Amount (UGX)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-semibold">Current Assets</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8">Cash on Hand</TableCell>
                          <TableCell className="text-right">{(financialData?.cashOnHand || 0).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8">Mobile Money/Bank</TableCell>
                          <TableCell className="text-right">{(financialData?.mobileMoneySales || 0).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8">Accounts Receivable</TableCell>
                          <TableCell className="text-right">{(financialData?.accountsReceivable || 0).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8">Inventory</TableCell>
                          <TableCell className="text-right">{(financialData?.inventoryValue || 0).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8">Interdepartmental Receivables</TableCell>
                          <TableCell className="text-right">{(financialData?.totalCreditsReceivable || 0).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow className="border-t-2 bg-muted">
                          <TableCell className="font-bold">Total Current Assets</TableCell>
                          <TableCell className="text-right font-bold text-success">
                            {(financialData?.totalCurrentAssets || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Liabilities & Equity */}
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60%]">LIABILITIES & EQUITY</TableHead>
                          <TableHead className="text-right">Amount (UGX)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-semibold">Current Liabilities</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8">Accounts Payable</TableCell>
                          <TableCell className="text-right">{(financialData?.totalCreditsPayable || 0).toLocaleString()}</TableCell>
                        </TableRow>
                        <TableRow className="border-t">
                          <TableCell className="font-medium">Total Liabilities</TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {(financialData?.totalCreditsPayable || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>

                        <TableRow className="bg-muted/50">
                          <TableCell className="font-semibold">Equity</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-8">Retained Earnings</TableCell>
                          <TableCell className="text-right">
                            {((financialData?.totalCurrentAssets || 0) - (financialData?.totalCreditsPayable || 0)).toLocaleString()}
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-t-2 bg-muted">
                          <TableCell className="font-bold">Total Liabilities & Equity</TableCell>
                          <TableCell className="text-right font-bold">
                            {(financialData?.totalCurrentAssets || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow Statement */}
          <TabsContent value="cashflow">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Cash Flow Statement
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  For the period ending {format(dateRange.end, "MMMM d, yyyy")}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60%]">Description</TableHead>
                      <TableHead className="text-right">Amount (UGX)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Operating Activities */}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">CASH FLOWS FROM OPERATING ACTIVITIES</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-success" />
                        Cash received from customers
                      </TableCell>
                      <TableCell className="text-right text-success">{(financialData?.cashSales || 0).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4 text-destructive" />
                        Cash paid for operating expenses
                      </TableCell>
                      <TableCell className="text-right text-destructive">({(financialData?.totalExpenses || 0).toLocaleString()})</TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium pl-4">Net Cash from Operating Activities</TableCell>
                      <TableCell className={`text-right font-medium ${(financialData?.operatingCashFlow || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {(financialData?.operatingCashFlow || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>

                    {/* Investing Activities */}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">CASH FLOWS FROM INVESTING ACTIVITIES</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 flex items-center gap-2">
                        <Minus className="w-4 h-4 text-muted-foreground" />
                        Purchase of equipment/assets
                      </TableCell>
                      <TableCell className="text-right">0</TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium pl-4">Net Cash from Investing Activities</TableCell>
                      <TableCell className="text-right font-medium">0</TableCell>
                    </TableRow>

                    {/* Financing Activities */}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">CASH FLOWS FROM FINANCING ACTIVITIES</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-success" />
                        Credits received
                      </TableCell>
                      <TableCell className="text-right text-success">{(financialData?.totalCreditsReceivable || 0).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-8 flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4 text-destructive" />
                        Credits paid
                      </TableCell>
                      <TableCell className="text-right text-destructive">({(financialData?.totalCreditsPayable || 0).toLocaleString()})</TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium pl-4">Net Cash from Financing Activities</TableCell>
                      <TableCell className={`text-right font-medium ${(financialData?.financingCashFlow || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {(financialData?.financingCashFlow || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>

                    {/* Net Change */}
                    <TableRow className="border-t-4 bg-muted">
                      <TableCell className="font-bold text-lg">NET CHANGE IN CASH</TableCell>
                      <TableCell className={`text-right font-bold text-lg ${((financialData?.operatingCashFlow || 0) + (financialData?.financingCashFlow || 0)) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {((financialData?.operatingCashFlow || 0) + (financialData?.financingCashFlow || 0)).toLocaleString()}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="pl-4">Cash at Beginning of Period</TableCell>
                      <TableCell className="text-right">{(financialData?.cashOnHand || 0).toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 bg-primary/10">
                      <TableCell className="font-bold">Cash at End of Period</TableCell>
                      <TableCell className="text-right font-bold">
                        {((financialData?.cashOnHand || 0) + (financialData?.operatingCashFlow || 0) + (financialData?.financingCashFlow || 0)).toLocaleString()}
                      </TableCell>
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
};

export default AdminReports;
