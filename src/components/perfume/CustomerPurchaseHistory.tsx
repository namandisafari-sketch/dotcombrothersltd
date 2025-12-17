import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, ShoppingCart, ChevronDown, ChevronUp, Droplet } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: "perfume" | "shop_product";
  productId?: string;
  customerType?: "retail" | "wholesale";
  scentMixture?: string;
  bottleCost?: number;
  totalMl?: number;
  trackingType?: string;
  subtotal: number;
  selectedScents?: Array<{ scent: string; ml: number; scentId?: string }>;
  pricePerMl?: number;
}

interface CustomerPurchaseHistoryProps {
  customerId: string | null;
  departmentId: string;
  onReorder: (items: CartItem[]) => void;
}

export function CustomerPurchaseHistory({
  customerId,
  departmentId,
  onReorder,
}: CustomerPurchaseHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["customer-purchases", customerId, departmentId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          id,
          created_at,
          total,
          receipt_number,
          sale_items (
            id,
            name,
            item_name,
            quantity,
            unit_price,
            total,
            product_id,
            customer_type,
            scent_mixture,
            bottle_cost,
            ml_amount,
            price_per_ml
          )
        `)
        .eq("customer_id", customerId)
        .eq("department_id", departmentId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return sales || [];
    },
    enabled: !!customerId,
  });

  const handleReorder = (sale: any) => {
    const cartItems: CartItem[] = sale.sale_items.map((item: any, index: number) => ({
      id: `reorder-${item.id}-${Date.now()}-${index}`,
      name: item.item_name || item.name,
      price: item.unit_price,
      quantity: item.ml_amount || item.quantity || 1,
      type: item.scent_mixture ? "perfume" : "shop_product",
      productId: item.product_id,
      customerType: item.customer_type || "retail",
      scentMixture: item.scent_mixture,
      bottleCost: item.bottle_cost,
      totalMl: item.ml_amount,
      pricePerMl: item.price_per_ml,
      subtotal: item.total,
    }));

    onReorder(cartItems);
  };

  if (!customerId) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Purchase History
                {purchases.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {purchases.length} orders
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No previous purchases found</p>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {purchases.map((sale: any) => (
                    <div
                      key={sale.id}
                      className="p-3 bg-muted/50 rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(sale.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                          <p className="text-sm font-medium">
                            {sale.receipt_number || "No receipt"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            UGX {sale.total?.toLocaleString()}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs mt-1"
                            onClick={() => handleReorder(sale)}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Reorder
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {sale.sale_items?.slice(0, 3).map((item: any, idx: number) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs"
                          >
                            {item.scent_mixture ? (
                              <Droplet className="h-2.5 w-2.5 mr-1" />
                            ) : null}
                            {item.item_name || item.name}
                          </Badge>
                        ))}
                        {sale.sale_items?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{sale.sale_items.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
