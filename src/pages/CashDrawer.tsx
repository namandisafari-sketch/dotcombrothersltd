import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { DollarSign, Clock, CheckCircle2, AlertCircle, Banknote, Calculator } from "lucide-react";
import CurrencyCashCount from "@/components/cashDrawer/CurrencyCashCount";
import ClosingChecklist from "@/components/cashDrawer/ClosingChecklist";

const CURRENCIES = [
  { code: "UGX", name: "Ugandan Shillings", rate: 1 },
  { code: "USD", name: "US Dollars", rate: 3750 },
  { code: "KES", name: "Kenyan Shillings", rate: 29 },
];

const CashDrawer = () => {
  const { selectedDepartment } = useDepartment();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openFloat, setOpenFloat] = useState("");
  const [openNotes, setOpenNotes] = useState("");
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

  // Fetch current open shift
  const { data: currentShift, isLoading: shiftLoading } = useQuery({
    queryKey: ["current-shift", selectedDepartment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_drawer_shifts")
        .select("*")
        .eq("department_id", selectedDepartment)
        .eq("status", "open")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedDepartment,
  });

  // Fetch shift history
  const { data: shiftHistory } = useQuery({
    queryKey: ["shift-history", selectedDepartment],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_drawer_shifts")
        .select("*")
        .eq("department_id", selectedDepartment)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedDepartment,
  });

  // Open shift mutation
  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("cash_drawer_shifts")
        .insert({
          department_id: selectedDepartment,
          opened_by: user?.id,
          opening_float: parseFloat(openFloat) || 0,
          notes: openNotes || null,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-shift"] });
      queryClient.invalidateQueries({ queryKey: ["shift-history"] });
      toast.success("Cash drawer opened successfully");
      setIsOpenDialogOpen(false);
      setOpenFloat("");
      setOpenNotes("");
    },
    onError: (error) => {
      toast.error("Failed to open drawer: " + error.message);
    },
  });

  // Calculate expected cash from today's sales
  const { data: todaysCashSales } = useQuery({
    queryKey: ["todays-cash-sales", selectedDepartment, currentShift?.id],
    queryFn: async () => {
      if (!currentShift) return 0;
      
      const { data, error } = await supabase
        .from("sales")
        .select("total")
        .eq("department_id", selectedDepartment)
        .eq("payment_method", "cash")
        .eq("status", "completed")
        .gte("created_at", currentShift.opened_at);

      if (error) throw error;
      return data?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
    },
    enabled: !!currentShift && !!selectedDepartment,
  });

  const expectedCash = (currentShift?.opening_float || 0) + (todaysCashSales || 0);

  if (!selectedDepartment) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Please select a department to manage the cash drawer.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cash Drawer</h1>
          <p className="text-muted-foreground">Manage float, track cash, and close shifts</p>
        </div>
      </div>

      {/* Current Shift Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Current Shift Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shiftLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : currentShift ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500">
                  <Clock className="h-3 w-3 mr-1" />
                  Shift Open
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Since {format(new Date(currentShift.opened_at), "MMM d, yyyy h:mm a")}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Opening Float</p>
                    <p className="text-2xl font-bold">
                      {Number(currentShift.opening_float).toLocaleString()} UGX
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Cash Sales Today</p>
                    <p className="text-2xl font-bold text-green-600">
                      +{todaysCashSales?.toLocaleString() || 0} UGX
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Expected Cash</p>
                    <p className="text-2xl font-bold text-primary">
                      {expectedCash.toLocaleString()} UGX
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="lg">
                    <Calculator className="h-4 w-4 mr-2" />
                    Close Shift & Count Cash
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Close Shift</DialogTitle>
                  </DialogHeader>
                  <ClosingChecklist
                    shift={currentShift}
                    expectedCash={expectedCash}
                    currencies={CURRENCIES}
                    onClose={() => {
                      setIsCloseDialogOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["current-shift"] });
                      queryClient.invalidateQueries({ queryKey: ["shift-history"] });
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No Active Shift
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Open a new shift to start tracking cash for today.
              </p>
              
              <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Open Cash Drawer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Open Cash Drawer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="float">Opening Float (UGX)</Label>
                      <Input
                        id="float"
                        type="number"
                        placeholder="Enter opening float amount"
                        value={openFloat}
                        onChange={(e) => setOpenFloat(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        The starting cash amount in the drawer
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Any notes about this shift..."
                        value={openNotes}
                        onChange={(e) => setOpenNotes(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => openShiftMutation.mutate()}
                      disabled={openShiftMutation.isPending}
                    >
                      {openShiftMutation.isPending ? "Opening..." : "Open Drawer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shift History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          {shiftHistory && shiftHistory.length > 0 ? (
            <div className="space-y-3">
              {shiftHistory.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {format(new Date(shift.opened_at), "MMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Float: {Number(shift.opening_float).toLocaleString()} UGX
                    </p>
                  </div>
                  <div className="text-right">
                    {shift.status === "open" ? (
                      <Badge variant="default" className="bg-green-500">Open</Badge>
                    ) : (
                      <div>
                        <Badge variant="secondary">Closed</Badge>
                        {shift.discrepancy !== null && shift.discrepancy !== 0 && (
                          <p className={`text-sm mt-1 ${Number(shift.discrepancy) > 0 ? "text-green-600" : "text-red-600"}`}>
                            {Number(shift.discrepancy) > 0 ? "+" : ""}
                            {Number(shift.discrepancy).toLocaleString()} UGX
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No shift history yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CashDrawer;
