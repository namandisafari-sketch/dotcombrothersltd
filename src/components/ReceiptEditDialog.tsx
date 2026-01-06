import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ReceiptEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: any;
}

interface EditItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  productId?: string;
  originalQuantity: number;
  scentMixture?: string;
  customerType?: string;
}

export const ReceiptEditDialog = ({ isOpen, onClose, receiptData }: ReceiptEditDialogProps) => {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<EditItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money" | "card" | "credit">("cash");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (receiptData && isOpen) {
      // Load items from receipt
      const loadedItems = receiptData.items?.map((item: any, index: number) => ({
        id: item.id || `item-${index}`,
        name: item.name,
        quantity: item.quantity,
        price: item.price || item.unit_price,
        subtotal: item.subtotal || item.total,
        productId: item.product_id,
        originalQuantity: item.quantity,
        scentMixture: item.scentMixture || item.scent_mixture,
        customerType: item.customerType || item.customer_type,
      })) || [];
      setItems(loadedItems);
      const method = receiptData.paymentMethod?.toLowerCase() || receiptData.payment_method || "cash";
      setPaymentMethod(method as "cash" | "mobile_money" | "card" | "credit");
    }
  }, [receiptData, isOpen]);

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
        : item
    ));
  };

  const updatePrice = (itemId: string, newPrice: number) => {
    if (newPrice < 0) return;
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, price: newPrice, subtotal: item.quantity * newPrice }
        : item
    ));
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const updateReceiptMutation = useMutation({
    mutationFn: async () => {
      setLoading(true);

      // Get the actual sale ID from receipt data
      const saleId = receiptData.id || receiptData.saleId;
      
      if (!saleId) throw new Error("Sale ID not found");

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const total = subtotal;

      // Fetch original sale items to handle stock restoration
      const { data: originalSaleItems, error: fetchError } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", saleId);

      if (fetchError) throw fetchError;

      // Restore stock for original items
      for (const originalItem of originalSaleItems || []) {
        if (originalItem.product_id) {
          const { data: product } = await supabase
            .from("products")
            .select("stock, total_ml, tracking_type")
            .eq("id", originalItem.product_id)
            .single();

          if (product) {
            const updateData: Record<string, number> = {};
            if (product.tracking_type === "ml") {
              updateData.total_ml = (product.total_ml || 0) + (originalItem.ml_amount || originalItem.quantity);
            } else {
              updateData.stock = (product.stock || 0) + originalItem.quantity;
            }

            await supabase
              .from("products")
              .update(updateData)
              .eq("id", originalItem.product_id);
          }
        }
      }

      // Update the sale record
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          subtotal,
          total,
          payment_method: paymentMethod,
        })
        .eq("id", saleId);

      if (updateError) throw updateError;

      // Delete old sale items
      const { error: deleteError } = await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", saleId);

      if (deleteError) throw deleteError;

      // Insert new sale items and reduce stock
      for (const item of items) {
        const { error: insertError } = await supabase
          .from("sale_items")
          .insert({
            sale_id: saleId,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total: item.subtotal,
            product_id: item.productId,
          });

        if (insertError) throw insertError;

        // Reduce stock for new quantities
        if (item.productId) {
          const { data: product } = await supabase
            .from("products")
            .select("stock, total_ml, tracking_type")
            .eq("id", item.productId)
            .single();

          if (product) {
            const updateData: Record<string, number> = {};
            if (product.tracking_type === "ml") {
              updateData.total_ml = Math.max(0, (product.total_ml || 0) - item.quantity);
            } else {
              updateData.stock = Math.max(0, (product.stock || 0) - item.quantity);
            }

            await supabase
              .from("products")
              .update(updateData)
              .eq("id", item.productId);
          }
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Receipt updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-products"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-today-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setLoading(false);
      onClose();
    },
    onError: (error: any) => {
      console.error("Error updating receipt:", error);
      toast.error("Failed to update receipt: " + error.message);
      setLoading(false);
    },
  });

  const handleSave = () => {
    if (items.length === 0) {
      toast.error("Receipt must have at least one item");
      return;
    }
    updateReceiptMutation.mutate();
  };

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Receipt #{receiptData?.receiptNumber || receiptData?.sale_number}</DialogTitle>
          <DialogDescription>
            Update items, quantities, and prices. Stock will be adjusted automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-2 items-end p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <Label>Item Name</Label>
                <Input value={item.name} disabled />
              </div>
              <div className="w-24">
                <Label>Qty</Label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <div className="w-32">
                <Label>Price</Label>
                <Input
                  type="number"
                  value={item.price}
                  onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="w-32">
                <Label>Subtotal</Label>
                <Input value={item.subtotal.toLocaleString()} disabled />
              </div>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <div className="flex justify-between items-center pt-4 border-t">
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-2xl font-bold">{subtotal.toLocaleString()} UGX</div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
