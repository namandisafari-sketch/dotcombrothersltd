import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";

const SuspendedRevenue = () => {
  const queryClient = useQueryClient();
  const { isAdmin, departmentId } = useUserRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    cashier_name: "",
    date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    reason: "",
    investigation_notes: "",
  });

  const { data: suspendedRevenue } = useQuery({
    queryKey: ["suspended-revenue", departmentId],
    queryFn: async () => {
      let query = supabase.from("suspended_revenue").select("*").order("created_at", { ascending: false });
      if (!isAdmin && departmentId) query = query.eq("department_id", departmentId);
      const { data } = await query;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const amount = parseFloat(data.amount);
      const { error } = await supabase.from("suspended_revenue").insert({
        cashier_name: data.cashier_name,
        date: data.date,
        amount: amount,
        reason: data.reason,
        investigation_notes: data.investigation_notes,
        department_id: departmentId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Suspended revenue recorded successfully");
      setFormData({
        cashier_name: "",
        date: format(new Date(), "yyyy-MM-dd"),
        amount: "",
        reason: "",
        investigation_notes: "",
      });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["suspended-revenue"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record suspended revenue");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: any = {
        status,
        resolved_at: status !== "pending" ? new Date().toISOString() : null,
      };
      if (notes) updateData.investigation_notes = notes;
      const { error } = await supabase.from("suspended_revenue").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated successfully");
      setEditDialogOpen(false);
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: ["suspended-revenue"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleStatusUpdate = (status: string) => {
    if (selectedItem) {
      updateStatusMutation.mutate({
        id: selectedItem.id,
        status,
        notes: selectedItem.investigation_notes,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: any; variant: any; label: string }> = {
      pending: { icon: Clock, variant: "secondary", label: "Pending Investigation" },
      explained: { icon: AlertCircle, variant: "default", label: "Explained" },
      approved: { icon: CheckCircle, variant: "default", label: "Approved" },
      rejected: { icon: XCircle, variant: "destructive", label: "Rejected" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const totalPending = suspendedRevenue?.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount), 0) || 0;
  const totalExplained = suspendedRevenue?.filter(r => r.status === 'explained').reduce((sum, r) => sum + Number(r.amount), 0) || 0;
  const totalApproved = suspendedRevenue?.filter(r => r.status === 'approved').reduce((sum, r) => sum + Number(r.amount), 0) || 0;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">Suspended Revenue</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Track unexplained cash differences pending investigation
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Record Suspended Revenue</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Suspended Revenue</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cashier Name *</Label>
                  <Input
                    value={formData.cashier_name}
                    onChange={(e) => setFormData({ ...formData, cashier_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extra Cash Amount (UGX) *</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial Reason/Explanation</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Investigation Notes</Label>
                  <Textarea
                    value={formData.investigation_notes}
                    onChange={(e) => setFormData({ ...formData, investigation_notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Record
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Investigation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPending.toLocaleString()} UGX</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Explained
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalExplained.toLocaleString()} UGX</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalApproved.toLocaleString()} UGX</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Suspended Revenue Records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {suspendedRevenue?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{item.cashier_name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(item.amount).toLocaleString()} UGX
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {item.reason || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Dialog open={editDialogOpen && selectedItem?.id === item.id} onOpenChange={(open) => {
                          setEditDialogOpen(open);
                          if (!open) setSelectedItem(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedItem(item)}
                            >
                              Manage
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Manage Suspended Revenue</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Investigation Notes</Label>
                                <Textarea
                                  value={selectedItem?.investigation_notes || ""}
                                  onChange={(e) =>
                                    setSelectedItem({
                                      ...selectedItem,
                                      investigation_notes: e.target.value,
                                    })
                                  }
                                  rows={4}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleStatusUpdate("explained")}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  Mark Explained
                                </Button>
                                <Button
                                  onClick={() => handleStatusUpdate("approved")}
                                  variant="default"
                                  className="flex-1"
                                >
                                  Approve
                                </Button>
                                <Button
                                  onClick={() => handleStatusUpdate("rejected")}
                                  variant="destructive"
                                  className="flex-1"
                                >
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {suspendedRevenue?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground">
                      No suspended revenue records yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SuspendedRevenue;
