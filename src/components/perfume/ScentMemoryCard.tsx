import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ShoppingCart, Heart, TrendingUp, Droplet, Clock, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  isPerfumeRefill?: boolean;
}

interface ScentMemoryCardProps {
  customerId: string | null;
  departmentId: string;
  onQuickReorder: (items: CartItem[]) => void;
}

interface ScentStats {
  name: string;
  count: number;
  totalMl: number;
  lastPurchased: string;
  avgBottleSize: number;
}

interface BottleSizeStats {
  size: number;
  count: number;
}

export function ScentMemoryCard({
  customerId,
  departmentId,
  onQuickReorder,
}: ScentMemoryCardProps) {
  // Fetch customer's scent purchase history and analyze patterns
  const { data: scentMemory, isLoading } = useQuery({
    queryKey: ["scent-memory", customerId, departmentId],
    queryFn: async () => {
      if (!customerId) return null;

      // Get all perfume purchases for this customer
      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          id,
          created_at,
          sale_items (
            id,
            name,
            item_name,
            scent_mixture,
            ml_amount,
            unit_price,
            total,
            customer_type,
            price_per_ml,
            bottle_cost
          )
        `)
        .eq("customer_id", customerId)
        .eq("department_id", departmentId)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!sales || sales.length === 0) return null;

      // Analyze scent patterns
      const scentMap = new Map<string, ScentStats>();
      const bottleSizes = new Map<number, number>();
      let totalPurchases = 0;
      let lastPurchaseDate = "";

      sales.forEach((sale: any) => {
        sale.sale_items?.forEach((item: any) => {
          if (item.scent_mixture) {
            totalPurchases++;
            if (!lastPurchaseDate) lastPurchaseDate = sale.created_at;

            // Parse scent mixture (e.g., "Scent A + Scent B")
            const scents = item.scent_mixture.split(" + ").map((s: string) => 
              s.replace(/\s*\(\d+ml\)/, "").trim()
            );

            scents.forEach((scent: string) => {
              const existing = scentMap.get(scent) || {
                name: scent,
                count: 0,
                totalMl: 0,
                lastPurchased: sale.created_at,
                avgBottleSize: 0,
              };
              existing.count++;
              existing.totalMl += (item.ml_amount || 0) / scents.length;
              if (new Date(sale.created_at) > new Date(existing.lastPurchased)) {
                existing.lastPurchased = sale.created_at;
              }
              scentMap.set(scent, existing);
            });

            // Track bottle sizes
            if (item.ml_amount) {
              const size = item.ml_amount;
              bottleSizes.set(size, (bottleSizes.get(size) || 0) + 1);
            }
          }
        });
      });

      // Sort scents by popularity
      const favoriteScents = Array.from(scentMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Sort bottle sizes by frequency
      const preferredSizes = Array.from(bottleSizes.entries())
        .map(([size, count]) => ({ size, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Get last 3 complete orders for quick reorder
      const recentOrders = sales.slice(0, 3).map((sale: any) => ({
        id: sale.id,
        date: sale.created_at,
        items: sale.sale_items?.filter((item: any) => item.scent_mixture) || [],
      })).filter((order: any) => order.items.length > 0);

      return {
        favoriteScents,
        preferredSizes,
        totalPurchases,
        lastPurchaseDate,
        recentOrders,
      };
    },
    enabled: !!customerId,
  });

  const handleQuickReorder = (items: any[]) => {
    const cartItems: CartItem[] = items.map((item: any, index: number) => ({
      id: `quick-reorder-${item.id}-${Date.now()}-${index}`,
      name: item.item_name || item.name,
      price: item.unit_price || item.total,
      quantity: 1,
      type: "perfume" as const,
      customerType: (item.customer_type || "retail") as "retail" | "wholesale",
      scentMixture: item.scent_mixture,
      bottleCost: item.bottle_cost,
      totalMl: item.ml_amount,
      pricePerMl: item.price_per_ml,
      subtotal: item.total,
      isPerfumeRefill: true,
    }));

    onQuickReorder(cartItems);
  };

  if (!customerId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4 animate-pulse" />
            Loading scent memory...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scentMemory || scentMemory.totalPurchases === 0) {
    return (
      <Card className="bg-gradient-to-br from-muted/30 to-muted/50 border-dashed">
        <CardContent className="py-6 text-center">
          <Droplet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No scent history yet. This customer's preferences will appear here after their first purchase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/20 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-full">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span>Scent Memory</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {scentMemory.lastPurchaseDate && (
              <span>Last: {formatDistanceToNow(new Date(scentMemory.lastPurchaseDate), { addSuffix: true })}</span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Favorite Scents */}
        {scentMemory.favoriteScents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Heart className="h-3 w-3 text-rose-500" />
              Favorite Scents
            </div>
            <div className="flex flex-wrap gap-1.5">
              {scentMemory.favoriteScents.map((scent, index) => (
                <Badge
                  key={scent.name}
                  variant={index === 0 ? "default" : "secondary"}
                  className={`text-xs ${index === 0 ? "bg-primary/90" : ""}`}
                >
                  {index === 0 && <Star className="h-3 w-3 mr-1 fill-current" />}
                  {scent.name}
                  <span className="ml-1 opacity-70">×{scent.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Preferred Bottle Sizes */}
        {scentMemory.preferredSizes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              Preferred Sizes
            </div>
            <div className="flex gap-2">
              {scentMemory.preferredSizes.map((size, index) => (
                <div
                  key={size.size}
                  className={`px-3 py-1.5 rounded-lg text-center ${
                    index === 0 
                      ? "bg-emerald-500/10 border border-emerald-500/20" 
                      : "bg-muted/50"
                  }`}
                >
                  <div className="text-sm font-semibold">{size.size}ml</div>
                  <div className="text-xs text-muted-foreground">×{size.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Reorder - Recent Orders */}
        {scentMemory.recentOrders.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <ShoppingCart className="h-3 w-3 text-blue-500" />
              Quick Reorder
            </div>
            <div className="space-y-2">
              {scentMemory.recentOrders.slice(0, 2).map((order: any) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1">
                      {order.items.slice(0, 2).map((item: any, idx: number) => (
                        <span key={idx} className="text-xs truncate">
                          {item.scent_mixture?.split(" + ")[0]}
                          {item.ml_amount && ` (${item.ml_amount}ml)`}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(order.date), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs shrink-0"
                    onClick={() => handleQuickReorder(order.items)}
                  >
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Footer */}
        <div className="pt-2 border-t flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>{scentMemory.totalPurchases} perfume orders</span>
          <span>•</span>
          <span>{scentMemory.favoriteScents.length} unique scents</span>
        </div>
      </CardContent>
    </Card>
  );
}
