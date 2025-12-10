import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { DepartmentSelector } from "@/components/DepartmentSelector";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Plus, ArrowRightLeft, Bell, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

const Credits = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedDepartmentId } = useDepartment();
  const { isAdmin, isModerator, departmentId: userDepartmentId } = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<any>(null);
  const [notificationMessage, setNotificationMessage] = useState("");

  const [formData, setFormData] = useState({
    transaction_type: "interdepartmental" as "interdepartmental" | "external_in" | "external_out",
    from_department_id: "",
    to_department_id: "",
    from_person: "",
    to_person: "",
    amount: "",
    purpose: "",
    notes: "",
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*");
      return data || [];
    },
  });

  const { data: credits, isLoading } = useQuery({
    queryKey: ["credits", selectedDepartmentId, isAdmin],
    queryFn: async () => {
      let query = supabase.from("credits").select("*, from_dept:departments!credits_from_department_id_fkey(name), to_dept:departments!credits_to_department_id_fkey(name)");
      
      if (!isAdmin && selectedDepartmentId) {
        query = query.or(`from_department_id.eq.${selectedDepartmentId},to_department_id.eq.${selectedDepartmentId}`);
      }
      
      const { data } = await query;
      
      // Transform to match expected format
      return (data || []).map((credit: any) => ({
        ...credit,
        from_department: { name: credit.from_dept?.name },
        to_department: { name: credit.to_dept?.name },
      }));
    },
    enabled: true,
  });

  const createCreditMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("credits").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      toast({ title: "Credit request created successfully" });
      setIsDialogOpen(false);
      setFormData({
        transaction_type: "interdepartmental",
        from_department_id: "",
        to_department_id: "",
        from_person: "",
        to_person: "",
        amount: "",
        purpose: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create credit request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ creditId, message }: { creditId: string; message: string }) => {
      const credit = credits?.find((c: any) => c.id === creditId);
      if (!credit) throw new Error("Credit not found");

      const toDepartmentId = credit.transaction_type === "interdepartmental" 
        ? credit.to_department_id 
        : credit.from_department_id;

      const { error } = await supabase.from("interdepartmental_inbox").insert({
        from_department_id: selectedDepartmentId || null,
        to_department_id: toDepartmentId,
        subject: `Credit Payment Notification - ${credit.purpose}`,
        message: message,
        credit_id: creditId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notification sent successfully" });
      setIsNotificationDialogOpen(false);
      setNotificationMessage("");
      setSelectedCredit(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send notification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCreditStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("credits")
        .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      toast({ title: "Credit status updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update credit status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const settleCreditMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("credits")
        .update({ settlement_status: "settled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      toast({ title: "Credit settled successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to settle credit",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData: any = {
      transaction_type: formData.transaction_type,
      amount: parseFloat(formData.amount),
      purpose: formData.purpose,
      notes: formData.notes,
    };

    if (formData.transaction_type === "interdepartmental") {
      submitData.from_department_id = formData.from_department_id;
      submitData.to_department_id = formData.to_department_id;
    } else if (formData.transaction_type === "external_in") {
      submitData.to_department_id = formData.to_department_id;
      submitData.from_person = formData.from_person;
    } else if (formData.transaction_type === "external_out") {
      submitData.from_department_id = formData.from_department_id;
      submitData.to_person = formData.to_person;
    }

    createCreditMutation.mutate(submitData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getSettlementBadge = (settlementStatus: string) => {
    switch (settlementStatus) {
      case "settled":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500">Settled</Badge>;
      case "overdue":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500">Overdue</Badge>;
      default:
        return <Badge variant="outline">Pending Settlement</Badge>;
    }
  };

  const pendingCredits = credits?.filter((c: any) => c.status === "pending") || [];
  const approvedCredits = credits?.filter((c: any) => c.status === "approved") || [];

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Credits Management</h1>
            <p className="text-muted-foreground">Manage interdepartmental and external money transfers</p>
          </div>
          <div className="flex gap-2 items-center">
            {isAdmin && <DepartmentSelector />}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Credit Request
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Credit Request</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Transaction Type</Label>
                    <Select
                      value={formData.transaction_type}
                      onValueChange={(value: any) =>
                        setFormData({ ...formData, transaction_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interdepartmental">Interdepartmental Transfer</SelectItem>
                        <SelectItem value="external_in">Receive from External</SelectItem>
                        <SelectItem value="external_out">Send to External</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.transaction_type === "interdepartmental" && (
                    <>
                      <div>
                        <Label>From Department</Label>
                        <Select
                          value={formData.from_department_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, from_department_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments
                              ?.filter((dept) => isAdmin || dept.id === userDepartmentId)
                              .map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>To Department</Label>
                        <Select
                          value={formData.to_department_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, to_department_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments?.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {formData.transaction_type === "external_in" && (
                    <>
                      <div>
                        <Label>From Person/Entity</Label>
                        <Input
                          value={formData.from_person}
                          onChange={(e) =>
                            setFormData({ ...formData, from_person: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>To Department</Label>
                        <Select
                          value={formData.to_department_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, to_department_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments?.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {formData.transaction_type === "external_out" && (
                    <>
                      <div>
                        <Label>From Department</Label>
                        <Select
                          value={formData.from_department_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, from_department_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments
                              ?.filter((dept) => isAdmin || dept.id === userDepartmentId)
                              .map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>To Person/Entity</Label>
                        <Input
                          value={formData.to_person}
                          onChange={(e) =>
                            setFormData({ ...formData, to_person: e.target.value })
                          }
                          required
                        />
                      </div>
                    </>
                  )}

                  <div>
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

                  <div>
                    <Label>Purpose</Label>
                    <Input
                      value={formData.purpose}
                      onChange={(e) =>
                        setFormData({ ...formData, purpose: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={createCreditMutation.isPending}>
                      {createCreditMutation.isPending ? "Creating..." : "Create Request"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isAdmin && pendingCredits.length > 0 && (
          <Card className="border-warning bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <Clock className="w-5 h-5" />
                Pending Approvals ({pendingCredits.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingCredits.map((credit: any) => (
                  <div
                    key={credit.id}
                    className="border rounded-lg p-4 space-y-3 bg-background"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">
                          UGX {credit.amount.toLocaleString()}
                        </h3>
                        <p className="text-sm text-muted-foreground">{credit.purpose}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {format(new Date(credit.created_at), "MMM dd, yyyy")}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">From:</span>
                        <p className="font-medium">
                          {credit.from_department?.name || credit.from_person || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">To:</span>
                        <p className="font-medium">
                          {credit.to_department?.name || credit.to_person || "N/A"}
                        </p>
                      </div>
                    </div>

                    {credit.notes && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Notes:</span> {credit.notes}
                      </p>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          updateCreditStatusMutation.mutate({
                            id: credit.id,
                            status: "approved",
                          })
                        }
                        disabled={updateCreditStatusMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          updateCreditStatusMutation.mutate({
                            id: credit.id,
                            status: "rejected",
                          })
                        }
                        disabled={updateCreditStatusMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Credit Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : !selectedDepartmentId && !isAdmin ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Please select a department to view credit transactions.</p>
              </div>
            ) : credits && credits.length > 0 ? (
              <div className="space-y-4">
                {credits.map((credit: any) => (
                  <div
                    key={credit.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">
                            UGX {credit.amount.toLocaleString()}
                          </h3>
                          {getStatusBadge(credit.status)}
                          {credit.status === "approved" && getSettlementBadge(credit.settlement_status || "pending")}
                        </div>
                        <p className="text-sm text-muted-foreground">{credit.purpose}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {format(new Date(credit.created_at), "MMM dd, yyyy")}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">From:</span>
                        <p className="font-medium">
                          {credit.from_department?.name || credit.from_person || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">To:</span>
                        <p className="font-medium">
                          {credit.to_department?.name || credit.to_person || "N/A"}
                        </p>
                      </div>
                    </div>

                    {credit.notes && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Notes:</span> {credit.notes}
                      </p>
                    )}

                    {credit.status === "approved" && credit.settlement_status !== "settled" && isAdmin && (
                      <div className="flex gap-2 pt-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => settleCreditMutation.mutate(credit.id)}
                          disabled={settleCreditMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Mark as Settled
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCredit(credit);
                            setIsNotificationDialogOpen(true);
                          }}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Send Payment Notification
                        </Button>
                      </div>
                    )}

                    {credit.status === "pending" && (isAdmin || false) && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateCreditStatusMutation.mutate({
                              id: credit.id,
                              status: "approved",
                            })
                          }
                          disabled={updateCreditStatusMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            updateCreditStatusMutation.mutate({
                              id: credit.id,
                              status: "rejected",
                            })
                          }
                          disabled={updateCreditStatusMutation.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {credit.approved_at && (
                      <p className="text-xs text-muted-foreground">
                        {credit.status === "approved" ? "Approved" : "Rejected"} on{" "}
                        {format(new Date(credit.approved_at), "MMM dd, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No credit transactions found
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Credits;
