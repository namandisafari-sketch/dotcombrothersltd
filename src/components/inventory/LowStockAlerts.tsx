import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, PackageX } from "lucide-react";
import { useDepartment } from "@/contexts/DepartmentContext";

export const LowStockAlerts = () => {
  const { selectedDepartmentId } = useDepartment();

  const { data: allProducts } = useQuery({
    queryKey: ["low-stock-alerts", selectedDepartmentId],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .neq("tracking_type", "ml") // Exclude perfume products
        .order("stock");
      
      // Filter by selected department if one is selected
      if (selectedDepartmentId) {
        query = query.eq("department_id", selectedDepartmentId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  // Fetch products with variants
  const { data: productsWithVariants } = useQuery({
    queryKey: ["products-with-variants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("product_id");
      
      if (error) throw error;
      
      // Get unique product IDs that have variants
      const productIds = [...new Set(data?.map(v => v.product_id) || [])];
      return productIds;
    },
  });

  // Filter out products with variants (since variants represent the actual stock)
  const productsWithoutVariants = allProducts?.filter(
    (product) => !productsWithVariants?.includes(product.id)
  );

  const alerts = productsWithoutVariants?.filter(
    (product) => (product.stock || 0) <= (product.min_stock || 5)
  );

  const criticalAlerts = alerts?.filter((p) => (p.stock || 0) === 0) || [];
  const lowStockAlerts = alerts?.filter((p) => (p.stock || 0) > 0) || [];

  if (!alerts || alerts.length === 0) return null;

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          Stock Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {criticalAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <PackageX className="w-4 h-4" />
                Out of Stock ({criticalAlerts.length})
              </h4>
              <div className="space-y-1">
                {criticalAlerts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 rounded bg-destructive/10 text-sm"
                  >
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="destructive">Out of Stock</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lowStockAlerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Low Stock ({lowStockAlerts.length})
              </h4>
              <div className="space-y-1">
                {lowStockAlerts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 rounded bg-orange-500/10 text-sm"
                  >
                    <span>{product.name}</span>
                    <Badge variant="outline" className="border-orange-500 text-orange-500">
                      {product.stock || 0} left
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
