import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, ArrowRightLeft, Filter } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type CreditStatus = Database["public"]["Enums"]["credit_status"];

const AdminCreditApproval = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [statusFilter, setStatusFilter] = useState<CreditStatus | "all">("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pendingCredits, isLoading } = useQuery({
    queryKey: ["pending-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credits")
        .select(`
          *,
          from_department:departments!credits_from_department_id_fkey(name),
          to_department:departments!credits_to_department_id_fkey(name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allCredits, isLoading: isLoadingAll } = useQuery({
    queryKey: ["all-credits", statusFilter, departmentFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("credits")
        .select(`
          *,
          from_department:departments!credits_from_department_id_fkey(name),
          to_department:departments!credits_to_department_id_fkey(name)
        `)
        .order("created_at", { ascending: false });
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (departmentFilter !== "all") {
        query = query.or(`from_department_id.eq.${departmentFilter},to_department_id.eq.${departmentFilter}`);
      }
      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (endDate) {
        query = query.lte("created_at", endDate);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const updateCreditStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("credits")
        .update({ 
          status: status as "approved" | "rejected" | "pending" | "partial" | "settled", 
          approved_at: new Date().toISOString(),
          approved_by: user?.id
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-credits"] });
      queryClient.invalidateQueries({ queryKey: ["all-credits"] });
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

  const renderCreditCard = (credit: any, showActions = false) => (
    <Card key={credit.id} className={credit.status === "pending" ? "border-warning bg-warning/5" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            <span>UGX {Number(credit.amount).toLocaleString()}</span>
          </div>
          <Badge variant={credit.status === "pending" ? "secondary" : credit.status === "approved" ? "default" : "destructive"}>
            {credit.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
            {credit.status === "approved" && <CheckCircle className="w-3 h-3 mr-1" />}
            {credit.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
            {credit.status.charAt(0).toUpperCase() + credit.status.slice(1)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Transaction Type</p>
            <p className="font-medium capitalize">
              {credit.transaction_type?.replace(/_/g, " ") || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">
              {format(new Date(credit.created_at), "MMM dd, yyyy HH:mm")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">From</p>
            <p className="font-medium">
              {credit.from_department?.name || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">To</p>
            <p className="font-medium">
              {credit.to_department?.name || "N/A"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Purpose</p>
          <p className="font-medium">{credit.purpose || "N/A"}</p>
        </div>

        {credit.notes && (
          <div>
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="text-sm">{credit.notes}</p>
          </div>
        )}

        {credit.approved_at && (
          <div>
            <p className="text-sm text-muted-foreground">
              {credit.status === "approved" ? "Approved" : "Rejected"} At
            </p>
            <p className="text-sm">
              {format(new Date(credit.approved_at), "MMM dd, yyyy HH:mm")}
            </p>
          </div>
        )}

        {showActions && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => updateCreditStatusMutation.mutate({ id: credit.id, status: "approved" })}
              disabled={updateCreditStatusMutation.isPending}
              className="flex-1"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => updateCreditStatusMutation.mutate({ id: credit.id, status: "rejected" })}
              disabled={updateCreditStatusMutation.isPending}
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Credit Management</h1>
          <p className="text-muted-foreground">Review and approve credit requests, view history</p>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
            <TabsTrigger value="history">All Credits</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : pendingCredits && pendingCredits.length > 0 ? (
              <div className="grid gap-4">
                {pendingCredits.map((credit: any) => renderCreditCard(credit, true))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                  <CheckCircle className="w-12 h-12 text-success mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Pending Credits</h3>
                  <p className="text-muted-foreground">All credit requests have been reviewed</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filter Credits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CreditStatus | "all")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments?.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                {(statusFilter !== "all" || departmentFilter !== "all" || startDate || endDate) && (
                  <Button
                    variant="outline"
                    onClick={() => { setStatusFilter("all"); setDepartmentFilter("all"); setStartDate(""); setEndDate(""); }}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>

            {isLoadingAll ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : allCredits && allCredits.length > 0 ? (
              <div className="grid gap-4">
                {allCredits.map((credit: any) => renderCreditCard(credit, false))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                  <ArrowRightLeft className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Credits Found</h3>
                  <p className="text-muted-foreground">
                    {statusFilter !== "all" || departmentFilter !== "all" || startDate || endDate
                      ? "No credits match your filter criteria"
                      : "No credit transactions have been recorded"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminCreditApproval;