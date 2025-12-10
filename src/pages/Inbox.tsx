import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { Mail, MailOpen, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DepartmentSelector } from "@/components/DepartmentSelector";

export default function Inbox() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedDepartmentId } = useDepartment();
  const { isAdmin } = useUserRole();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["inbox-messages", selectedDepartmentId, isAdmin],
    queryFn: async () => {
      let query = supabase.from("interdepartmental_inbox").select("*, credits(amount, purpose, transaction_type, status, settlement_status)").order("created_at", { ascending: false });
      if (!isAdmin && selectedDepartmentId) query = query.eq("to_department_id", selectedDepartmentId);
      const { data } = await query;
      
      // Fetch department names
      const { data: departments } = await supabase.from("departments").select("id, name");
      const deptMap = Object.fromEntries((departments || []).map(d => [d.id, d.name]));
      
      return (data || []).map((message: any) => ({
        ...message,
        from_department: { name: deptMap[message.from_department_id] || "Unknown" },
        to_department: { name: deptMap[message.to_department_id] || "Unknown" },
        credit: message.credits,
      }));
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from("interdepartmental_inbox").update({ is_read: true }).eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-messages"] });
    },
  });

  const handleViewCredit = (creditId: string, messageId: string) => {
    if (creditId) {
      markAsReadMutation.mutate(messageId);
      navigate("/credits");
    }
  };

  const unreadCount = messages?.filter(m => !m.is_read)?.length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Interdepartmental Inbox</h1>
            <p className="text-muted-foreground">
              View credit payment notifications and messages
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} unread
                </Badge>
              )}
            </p>
          </div>
          {isAdmin && <DepartmentSelector />}
        </div>

        <div className="space-y-4">
          {messages?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No messages yet</p>
              </CardContent>
            </Card>
          ) : (
            messages?.map((message: any) => (
              <Card 
                key={message.id} 
                className={`transition-all ${!message.is_read ? 'border-primary' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {message.is_read ? (
                        <MailOpen className="w-5 h-5 text-muted-foreground mt-0.5" />
                      ) : (
                        <Mail className="w-5 h-5 text-primary mt-0.5" />
                      )}
                      <div className="flex-1">
                        <CardTitle className="text-lg">{message.subject}</CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                          <span>From: <strong>{message.from_department?.name}</strong></span>
                          <span>→</span>
                          <span>To: <strong>{message.to_department?.name}</strong></span>
                          <span>•</span>
                          <span>{format(new Date(message.created_at), "PPp")}</span>
                        </div>
                      </div>
                    </div>
                    {!message.is_read && (
                      <Badge variant="destructive">New</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  
                  {message.credit && (
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <p className="text-sm font-semibold">Related Credit Information:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Amount: <strong>{Number(message.credit.amount).toLocaleString()} UGX</strong></div>
                        <div>Type: <strong className="capitalize">{message.credit.transaction_type?.replace('_', ' ')}</strong></div>
                        <div>Purpose: <strong>{message.credit.purpose}</strong></div>
                        <div>
                          Status: 
                          <Badge className="ml-2" variant={
                            message.credit.status === 'approved' ? 'default' :
                            message.credit.status === 'rejected' ? 'destructive' : 'secondary'
                          }>
                            {message.credit.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {message.credit_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewCredit(message.credit_id, message.id)}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Credit Details
                      </Button>
                    )}
                    {!message.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsReadMutation.mutate(message.id)}
                      >
                        Mark as Read
                      </Button>
                    )}
                  </div>

                  {message.is_read && message.read_at && (
                    <p className="text-xs text-muted-foreground">
                      Read on {format(new Date(message.read_at), "PPp")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
