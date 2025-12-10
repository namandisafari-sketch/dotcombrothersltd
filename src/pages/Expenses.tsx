import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { Receipt } from "lucide-react";
import { expenseSchema } from "@/lib/validation";

const Expenses = () => {
  const queryClient = useQueryClient();
  const { isAdmin, departmentId } = useUserRole();
  const [formData, setFormData] = useState({
    description: "",
    category: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses", departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("department_id", departmentId)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!departmentId,
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      try {
        const validated = expenseSchema.parse(data);
        
        const { error } = await supabase
          .from("expenses")
          .insert({
            description: validated.description,
            category: validated.category,
            amount: parseFloat(data.amount),
            expense_date: validated.date,
            department_id: departmentId,
          });
        if (error) throw error;
      } catch (validationError: any) {
        if (validationError.errors) {
          throw new Error(validationError.errors[0].message);
        }
        throw validationError;
      }
    },
    onSuccess: () => {
      toast.success("Expense recorded successfully");
      setFormData({
        description: "",
        category: "",
        amount: "",
        date: format(new Date(), "yyyy-MM-dd"),
      });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record expense");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createExpenseMutation.mutate(formData);
  };

  const totalExpenses = expenses?.reduce(
    (sum, exp) => sum + Number(exp.amount),
    0
  ) || 0;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Expenses</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Track business expenses</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Record Expense
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="What was purchased?"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., Utilities, Supplies"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount (UGX)</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Record Expense
                </Button>
              </form>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{totalExpenses.toLocaleString()} UGX</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Expense History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses?.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.expense_date || expense.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-muted rounded text-xs">
                          {expense.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(expense.amount).toLocaleString()} UGX
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenses?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No expenses recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Expenses;