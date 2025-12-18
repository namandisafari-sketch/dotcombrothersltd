import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Printer, Calendar, Ban, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { printReceipt, generateReceiptHTML } from "@/utils/receiptPrinter";
import { PrintPreviewDialog } from "@/components/PrintPreviewDialog";
import { MobilePrintDialog } from "@/components/MobilePrintDialog";
import { isMobile } from "@/utils/mobilePrinter";
import { toast } from "sonner";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";

const SalesHistory = () => {
  const queryClient = useQueryClient();
  const { selectedDepartmentId } = useDepartment();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [saleToVoid, setSaleToVoid] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState("");
  const [printPreviewSale, setPrintPreviewSale] = useState<any>(null);
  const [showMobilePrint, setShowMobilePrint] = useState(false);
  const [mobilePrintData, setMobilePrintData] = useState<any>(null);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales-history", searchQuery, startDate, endDate, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      let query = supabase
        .from("sales")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .order("created_at", { ascending: false });
      
      if (startDate) query = query.gte("created_at", startDate);
      if (endDate) query = query.lte("created_at", endDate + "T23:59:59");
      
      const { data: salesData } = await query;
      if (!salesData) return [];
      
      // Fetch sale items for each sale
      const salesWithItems = await Promise.all(
        salesData.map(async (sale: any) => {
          const { data: items } = await supabase
            .from("sale_items")
            .select("*")
            .eq("sale_id", sale.id);
          return { ...sale, sale_items: items || [] };
        })
      );
      
      // Filter by search query if provided
      if (searchQuery) {
        return salesWithItems.filter((sale: any) => 
          sale.receipt_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sale.cashier_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      return salesWithItems;
    },
    enabled: !!selectedDepartmentId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Realtime subscription for sales updates
  useEffect(() => {
    if (!selectedDepartmentId) return;

    const channel = supabase
      .channel('sales-history-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `department_id=eq.${selectedDepartmentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sales-history"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDepartmentId, queryClient]);

  const voidMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      if (!user) throw new Error("No user found");
      const { error } = await supabase
        .from("sales")
        .update({ status: "voided", void_reason: reason, voided_by: user.id, voided_at: new Date().toISOString() })
        .eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sale voided successfully");
      queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      setShowVoidDialog(false);
      setSaleToVoid(null);
      setVoidReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to void sale");
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

  const handleReprintReceipt = async (sale: any, usePreview: boolean = true) => {
    // Fetch settings for receipt
    let settings = null;
    if (sale.department_id) {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .eq("department_id", sale.department_id)
        .maybeSingle();
      settings = data;
    }

    if (!settings) {
      const { data } = await supabase.from("settings").select("*").is("department_id", null).maybeSingle();
      settings = data;
    }

    const receiptData = {
      receiptNumber: sale.receipt_number,
      items: sale.sale_items.map((item: any) => ({
        name: item.item_name,
        quantity: item.quantity,
        price: item.unit_price,
        subtotal: item.subtotal,
        scentMixture: item.scent_mixture,
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
      customerName: "Walk-in Customer",
      businessInfo: {
        name: settings?.business_name || "DOTCOM BROTHERS LTD",
        address: settings?.business_address || "Kasangati opp Kasangati Police Station",
        phone: settings?.business_phone || "+256745368426",
        whatsapp: settings?.whatsapp_number || "+256745368426",
      },
      seasonalRemark: settings?.seasonal_remark,
      showBackPage: settings?.show_back_page !== false,
    };

    // Check if on mobile - use mobile print dialog
    if (isMobile()) {
      setMobilePrintData(receiptData);
      setShowMobilePrint(true);
      return;
    }

    if (usePreview) {
      // Show print preview dialog
      const html = generateReceiptHTML(receiptData);
      setPrintPreviewHtml(html);
      setPrintPreviewSale(sale);
      setShowPrintPreview(true);
    } else {
      try {
        await printReceipt(receiptData, false);
        toast.success("Receipt reprinted successfully");
      } catch (error) {
        toast.error("Failed to reprint receipt");
      }
    }
  };

  const handlePrintFromPreview = async () => {
    if (printPreviewSale) {
      await handleReprintReceipt(printPreviewSale, false);
      setShowPrintPreview(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Sales History</h2>
          <p className="text-sm sm:text-base text-muted-foreground">View and reprint previous receipts</p>
        </div>

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
            <CardTitle>Recent Sales</CardTitle>
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
                            {isMobile() ? (
                              <Smartphone className="h-4 w-4 mr-1" />
                            ) : (
                              <Printer className="h-4 w-4 mr-1" />
                            )}
                            {isMobile() ? "Print" : "Reprint"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleVoidClick(sale)}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            Void
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No sales found
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
                          <div className="font-medium">{item.item_name}</div>
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
                          UGX {item.subtotal?.toLocaleString()}
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
            <DialogTitle>Void Sale - {saleToVoid?.receipt_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">
                ⚠️ Warning: This action cannot be undone
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Voiding this sale will restore all items to stock and exclude it from revenue calculations.
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
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="void-reason">Reason for Voiding *</Label>
              <Textarea
                id="void-reason"
                placeholder="e.g., Customer left items unpaid, Incorrect transaction, etc."
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
              disabled={voidMutation.isPending || !voidReason.trim()}
            >
              {voidMutation.isPending ? "Voiding..." : "Void Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <PrintPreviewDialog
        open={showPrintPreview}
        onOpenChange={setShowPrintPreview}
        documentHtml={printPreviewHtml}
        documentTitle={`Receipt-${printPreviewSale?.receipt_number || ''}`}
        documentType="receipt"
        onPrint={handlePrintFromPreview}
      />

      {/* Mobile Print Dialog */}
      {mobilePrintData && (
        <MobilePrintDialog
          open={showMobilePrint}
          onOpenChange={setShowMobilePrint}
          receiptData={mobilePrintData}
          onPrintComplete={() => {
            toast.success("Receipt sent");
          }}
        />
      )}
    </div>
  );
};

export default SalesHistory;
