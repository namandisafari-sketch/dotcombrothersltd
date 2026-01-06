import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { Calculator } from "lucide-react";

const Reconcile = () => {
  const queryClient = useQueryClient();
  const { isAdmin, departmentId } = useUserRole();
  const [formData, setFormData] = useState({
    cashier_name: "",
    date: format(new Date(), "yyyy-MM-dd"),
    reported_cash: "",
    notes: "",
  });

  // Fetch daily sales total for the selected date and department
  const { data: dailySalesData, isLoading: loadingSales } = useQuery({
    queryKey: ["dailySales", formData.date, departmentId],
    queryFn: async () => {
      if (!departmentId) return { total: 0 };
      const startOfDay = `${formData.date}T00:00:00`;
      const endOfDay = `${formData.date}T23:59:59`;
      const { data } = await supabase.from("sales").select("total").eq("department_id", departmentId).eq("status", "completed").eq("payment_method", "cash").gte("created_at", startOfDay).lte("created_at", endOfDay);
      const total = (data || []).reduce((sum, s) => sum + Number(s.total || 0), 0);
      return { total };
    },
    enabled: !!departmentId && !!formData.date,
  });

  const dailySales = dailySalesData?.total || 0;

  const { data: reconciliations } = useQuery({
    queryKey: ["reconciliations", departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      const { data } = await supabase.from("reconciliations").select("*").eq("department_id", departmentId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!departmentId,
  });

  const createReconciliationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const systemCash = dailySales || 0;
      const reportedCash = parseFloat(data.reported_cash);
      const discrepancy = reportedCash - systemCash;

      const { error } = await supabase.from("reconciliations").insert({
        cashier_name: data.cashier_name,
        date: data.date,
        system_cash: systemCash,
        reported_cash: reportedCash,
        discrepancy: discrepancy,
        notes: data.notes,
        department_id: departmentId,
        status: discrepancy === 0 ? "completed" : "pending",
      });

      if (error) throw error;

      // If there's a surplus, also create a suspended revenue entry
      if (discrepancy > 0) {
        const { error: suspendedError } = await supabase.from("suspended_revenue").insert({
          cashier_name: data.cashier_name,
          date: data.date,
          amount: discrepancy,
          reason: `Surplus from reconciliation on ${data.date}`,
          department_id: departmentId,
          status: "pending",
        });
        if (suspendedError) {
          console.error("Failed to create suspended revenue:", suspendedError);
          // Don't throw here to avoid failing the whole reconciliation if just the surplus record fails
          toast.warning("Reconciliation saved, but failed to record surplus in suspended revenue.");
        }
      }
    },
    onSuccess: () => {
      toast.success("Reconciliation recorded successfully");
      setFormData({
        cashier_name: "",
        date: format(new Date(), "yyyy-MM-dd"),
        reported_cash: "",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["suspended_revenue"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record reconciliation");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cashier_name || !formData.reported_cash) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (loadingSales) {
      toast.error("Please wait while we calculate the system cash");
      return;
    }

    createReconciliationMutation.mutate(formData);
  };

  const systemCash = dailySales || 0;
  const difference = formData.reported_cash
    ? parseFloat(formData.reported_cash) - systemCash
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Cash Reconciliation</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Track daily cash reconciliations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                New Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cashier Name</Label>
                  <Input
                    value={formData.cashier_name}
                    onChange={(e) =>
                      setFormData({ ...formData, cashier_name: e.target.value })
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
                <div className="space-y-2">
                  <Label>System Cash (UGX) - Auto-calculated</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={loadingSales ? "Calculating..." : systemCash.toLocaleString()}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Total cash sales for {formData.date} (excludes mobile money & card)
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reported Cash (UGX)</Label>
                  <Input
                    type="number"
                    value={formData.reported_cash}
                    onChange={(e) =>
                      setFormData({ ...formData, reported_cash: e.target.value })
                    }
                    required
                  />
                </div>
                {formData.reported_cash && !loadingSales && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Difference:</p>
                    <p className={`text-2xl font-bold ${difference === 0
                        ? "text-success"
                        : difference > 0
                          ? "text-warning"
                          : "text-destructive"
                      }`}>
                      {difference.toLocaleString()} UGX
                    </p>
                    {difference > 0 && (
                      <p className="text-xs text-warning mt-1">
                        Surplus - Will create suspended revenue entry
                      </p>
                    )}
                    {difference < 0 && (
                      <p className="text-xs text-destructive mt-1">
                        Shortage - Investigation required
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Record Reconciliation
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Reconciliation History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">System Cash</TableHead>
                    <TableHead className="text-right">Reported Cash</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciliations?.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>{format(new Date(rec.date), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{rec.cashier_name}</TableCell>
                      <TableCell className="text-right">
                        {Number(rec.system_cash).toLocaleString()} UGX
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(rec.reported_cash).toLocaleString()} UGX
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            Number(rec.discrepancy) === 0
                              ? "default"
                              : "destructive"
                          }
                        >
                          {Number(rec.discrepancy).toLocaleString()} UGX
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {rec.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {reconciliations?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No reconciliations recorded yet
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

export default Reconcile;
