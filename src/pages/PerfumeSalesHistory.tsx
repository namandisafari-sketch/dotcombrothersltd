import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Printer, Calendar, Ban, Droplet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { printReceipt } from "@/utils/receiptPrinter";
import { voidSale } from "@/utils/voidSale";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { PerfumeDepartmentSelector } from "@/components/PerfumeDepartmentSelector";

const PerfumeSalesHistory = () => {
  const queryClient = useQueryClient();
  const { isAdmin, departmentId: userDepartmentId } = useUserRole();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [saleToVoid, setSaleToVoid] = useState<any>(null);

  // Determine which department to filter by
  const activeDepartmentId = isAdmin ? selectedDepartmentId : userDepartmentId;

  const { data: sales, isLoading } = useQuery({
    queryKey: ["perfume-sales-history", searchQuery, startDate, endDate, activeDepartmentId],
    queryFn: async () => {
      if (!activeDepartmentId) return [];

      let query = supabase
        .from("sales")
        .select(`
          *, 
          sale_items(
            *, 
            products(name), 
            services(name), 
            product_variants!sale_items_variant_id_fkey(variant_name, color, size)
          )
        `)
        .eq("department_id", activeDepartmentId)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`receipt_number.ilike.%${searchQuery}%,cashier_name.ilike.%${searchQuery}%`);
      }

      if (startDate) {
        query = query.gte("created_at", new Date(startDate).toISOString());
      }

      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59);
        query = query.lte("created_at", endDateTime.toISOString());
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: !!activeDepartmentId,
  });

  const voidMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      
      return await voidSale({ saleId, reason, userId: user.id });
    },
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ["perfume-sales-history"] });
        setShowVoidDialog(false);
        setSaleToVoid(null);
        setVoidReason("");
      }
    },
  });

  const handleVoidClick = (sale: any) => {
    if (sale.status === "voided") {
      toast.error("This sale has already been voided");
      return;
    }
    setSaleToVoid(sale);
    setShowVoidDialog(true);
  };

  const handleConfirmVoid = () => {
    if (!voidReason.trim()) {
      toast.error("Please provide a reason for voiding this sale");
      return;
    }
    if (!saleToVoid) return;
    
    voidMutation.mutate({
      saleId: saleToVoid.id,
      reason: voidReason.trim(),
    });
  };

  const handleViewDetails = (sale: any) => {
    setSelectedSale(sale);
    setShowDetailsDialog(true);
  };

  const handleReprintReceipt = async (sale: any) => {
    // Fetch settings for receipt
    let settings = null;
    if (sale.department_id) {
      const { data: deptSettings } = await supabase
        .from("department_settings")
        .select("*")
        .eq("department_id", sale.department_id)
        .maybeSingle();
      settings = deptSettings;
    }

    if (!settings) {
      const { data: globalSettings } = await supabase
        .from("settings")
        .select("*")
        .maybeSingle();
      settings = globalSettings;
    }

    // Fetch customer data if available
    let customerName = "Walk-in Customer";
    let customerPhone = undefined;
    if (sale.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("id", sale.customer_id)
        .maybeSingle();
      
      if (customer) {
        customerName = customer.name;
        customerPhone = customer.phone;
      }
    }

    const receiptData = {
      receiptNumber: sale.receipt_number,
      items: sale.sale_items.map((item: any) => ({
        name: item.item_name,
        quantity: item.quantity,
        price: item.unit_price,
        subtotal: item.total,
      })),
      subtotal: sale.subtotal,
      tax: 0,
      total: sale.total,
      paymentMethod: sale.payment_method,
      date: new Date(sale.created_at).toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      cashierName: sale.cashier_name || "Staff",
      customerName,
      customerPhone,
      businessInfo: {
        name: settings?.business_name || "DOTCOM BROTHERS LTD",
        address: settings?.business_address || "Kasangati opp Kasangati Police Station",
        phone: settings?.business_phone || "+256745368426",
        whatsapp: settings?.whatsapp_number || "+256745368426",
      },
      seasonalRemark: settings?.seasonal_remark,
    };

    try {
      await printReceipt(receiptData, false);
      toast.success("Receipt reprinted successfully");
    } catch (error) {
      toast.error("Failed to reprint receipt");
    }
  };

  const hasPerfumeMixtures = saleToVoid?.sale_items?.some((item: any) => item.scent_mixture);

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Perfume Sales History</h2>
          <p className="text-sm sm:text-base text-muted-foreground">View and manage perfume sales transactions</p>
        </div>

        {isAdmin && (
          <div className="mb-4">
            <PerfumeDepartmentSelector
              value={selectedDepartmentId}
              onChange={setSelectedDepartmentId}
            />
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Receipt</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Receipt # or Cashier"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Perfume Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading sales...</div>
            ) : sales && sales.length > 0 ? (
              <div className="space-y-3">
                {sales.map((sale: any) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline">{sale.receipt_number}</Badge>
                        {sale.status === "voided" && (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3 w-3" />
                            VOIDED
                          </Badge>
                        )}
                        {sale.sale_items?.some((item: any) => item.scent_mixture) && (
                          <Badge variant="secondary" className="gap-1">
                            <Droplet className="h-3 w-3" />
                            Mixture
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          {new Date(sale.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className={`font-medium ${sale.status === "voided" ? "line-through text-muted-foreground" : ""}`}>
                          UGX {sale.total.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground">
                          {sale.cashier_name || "Staff"}
                        </span>
                        <Badge variant="secondary">{sale.payment_method}</Badge>
                        <span className="text-muted-foreground">
                          {sale.sale_items?.length || 0} items
                        </span>
                      </div>
                      {sale.status === "voided" && sale.void_reason && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Void reason: {sale.void_reason}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(sale)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {sale.status !== "voided" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReprintReceipt(sale)}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Reprint
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleVoidClick(sale)}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {activeDepartmentId ? "No sales found" : "Please select a perfume department"}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details - {selectedSale?.receipt_number}</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Date:</span>{" "}
                    {new Date(selectedSale.created_at).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Cashier:</span>{" "}
                    {selectedSale.cashier_name || "Staff"}
                  </div>
                  <div>
                    <span className="font-medium">Payment:</span>{" "}
                    {selectedSale.payment_method}
                  </div>
                  <div>
                    <span className="font-medium">Amount Paid:</span> UGX{" "}
                    {selectedSale.amount_paid?.toLocaleString()}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Items Sold</h4>
                  <div className="space-y-2">
                    {selectedSale.sale_items?.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-muted rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {item.item_name}
                            {item.scent_mixture && (
                              <Badge variant="secondary" className="gap-1">
                                <Droplet className="h-3 w-3" />
                                Mixture
                              </Badge>
                            )}
                          </div>
                          {item.scent_mixture && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Scents: {item.scent_mixture}
                            </div>
                          )}
                          {item.product_variants && (
                            <div className="text-xs text-muted-foreground">
                              Variant: {item.product_variants.variant_name}
                              {item.product_variants.color && ` • Color: ${item.product_variants.color}`}
                              {item.product_variants.size && ` • Size: ${item.product_variants.size}`}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} × UGX {item.unit_price?.toLocaleString()}
                          </div>
                        </div>
                        <div className="font-medium">
                          UGX {item.total?.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>UGX {selectedSale.subtotal?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>UGX {selectedSale.total?.toLocaleString()}</span>
                    </div>
                    {selectedSale.change_amount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Change:</span>
                        <span>UGX {selectedSale.change_amount?.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Sale Dialog */}
      <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Sale - {saleToVoid?.receipt_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Warning: This action cannot be undone
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {hasPerfumeMixtures 
                  ? "Canceling this sale will restore non-mixture items to stock. Perfume mixtures will be marked as damaged (non-returnable)."
                  : "Canceling this sale will restore all items to stock and exclude it from revenue calculations."}
              </p>
            </div>
            
            {saleToVoid && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sale Amount:</span>
                  <span className="font-medium">UGX {saleToVoid.total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items:</span>
                  <span>{saleToVoid.sale_items?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cashier:</span>
                  <span>{saleToVoid.cashier_name || "Staff"}</span>
                </div>
                {hasPerfumeMixtures && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <Droplet className="h-4 w-4" />
                    <span className="text-xs">Contains perfume mixtures</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="void-reason">Reason for Canceling *</Label>
              <Textarea
                id="void-reason"
                placeholder="e.g., Customer rejected mixture, Incorrect mixture, Damaged product, etc."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVoidDialog(false);
                setSaleToVoid(null);
                setVoidReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmVoid}
              disabled={voidMutation.isPending}
            >
              {voidMutation.isPending ? "Processing..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerfumeSalesHistory;