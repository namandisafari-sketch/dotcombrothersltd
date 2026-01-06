import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Smartphone, DollarSign } from "lucide-react";
import { useMemo } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PaymentTransactionsReportProps {
  departmentId?: string;
}

export const PaymentTransactionsReport = ({ departmentId }: PaymentTransactionsReportProps) => {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["payment-transactions", departmentId],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("*, customers(name)")
        .in("payment_method", ["mobile_money", "card"])
        .neq("status", "voided");

      if (departmentId) {
        query = query.eq("department_id", departmentId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const analytics = useMemo(() => {
    if (!transactions) return null;

    const mobileMoneyTransactions = transactions.filter(t => t.payment_method === "mobile_money");
    const cardTransactions = transactions.filter(t => t.payment_method === "card");

    const totalMobileMoney = mobileMoneyTransactions.reduce((sum, t) => sum + Number(t.total), 0);
    const totalCard = cardTransactions.reduce((sum, t) => sum + Number(t.total), 0);
    const totalAmount = totalMobileMoney + totalCard;

    return {
      totalMobileMoney,
      totalCard,
      totalAmount,
      mobileMoneyCount: mobileMoneyTransactions.length,
      cardCount: cardTransactions.length,
      totalCount: transactions.length,
    };
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                Mobile Money Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-primary">
                  UGX {analytics.totalMobileMoney.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analytics.mobileMoneyCount} transactions
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-green-600" />
                Card Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-green-600">
                  UGX {analytics.totalCard.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analytics.cardCount} transactions
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent" />
                Total Digital Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-accent">
                  UGX {analytics.totalAmount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analytics.totalCount} transactions
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Card & Mobile Money Transactions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Note: These payments are shown separately and not included in cash sales totals
          </p>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Sale #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount (UGX)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 50).map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">
                        {format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {transaction.sale_number}
                      </TableCell>
                      <TableCell className="text-sm">
                        {transaction.customers?.name || "Walk-in"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={transaction.payment_method === "mobile_money" ? "default" : "secondary"}
                        >
                          {transaction.payment_method === "mobile_money" ? "Mobile Money" : "Card"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(transaction.total).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No card or mobile money transactions found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
