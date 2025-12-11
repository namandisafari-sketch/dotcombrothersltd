import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Beaker, Scale } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface StockReconciliationProps {
  departmentId: string;
}

const LOW_STOCK_THRESHOLD = 100; // ml

export function StockReconciliation({ departmentId }: StockReconciliationProps) {
  // Fetch all active scents with stock (include global scents with null department_id)
  const { data: scents = [] } = useQuery({
    queryKey: ["scents-reconcile", departmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("perfume_scents")
        .select("id, name, stock_ml")
        .or(`department_id.eq.${departmentId},department_id.is.null`)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!departmentId,
  });

  const totalScentMl = scents.reduce((sum, s) => sum + (s.stock_ml || 0), 0);
  const scentsWithStock = scents.filter(s => (s.stock_ml || 0) > 0);
  const lowStockScents = scents.filter(s => (s.stock_ml || 0) > 0 && (s.stock_ml || 0) < LOW_STOCK_THRESHOLD);
  const emptyScents = scents.filter(s => (s.stock_ml || 0) === 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="w-5 h-5" />
          Stock Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Stock Summary */}
        <div className="p-4 bg-primary/10 rounded-lg text-center">
          <p className="text-sm text-muted-foreground mb-1">Total Perfume Stock</p>
          <p className="text-3xl font-bold text-primary">{totalScentMl.toLocaleString()} ml</p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {scentsWithStock.length} scents with stock
          </p>
        </div>

        {/* Stock Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded">
            <p className="text-lg font-semibold text-green-600">{scentsWithStock.length}</p>
            <p className="text-xs text-muted-foreground">In Stock</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <p className="text-lg font-semibold text-orange-500">{lowStockScents.length}</p>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <p className="text-lg font-semibold text-red-500">{emptyScents.length}</p>
            <p className="text-xs text-muted-foreground">Empty</p>
          </div>
        </div>

        {/* Low Stock Warning */}
        {lowStockScents.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Low Stock Alert</AlertTitle>
            <AlertDescription>
              {lowStockScents.length} scent(s) below {LOW_STOCK_THRESHOLD}ml: {lowStockScents.map(s => s.name).join(", ")}
            </AlertDescription>
          </Alert>
        )}

        {/* Scent Breakdown */}
        {scents.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Beaker className="w-4 h-4" />
              Scent Stock Breakdown
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scents.map((scent) => {
                const stockMl = scent.stock_ml || 0;
                const isLow = stockMl > 0 && stockMl < LOW_STOCK_THRESHOLD;
                const isEmpty = stockMl === 0;
                
                return (
                  <div key={scent.id} className="flex justify-between items-center text-sm">
                    <span className="truncate mr-2">{scent.name}</span>
                    <Badge 
                      variant={isEmpty ? "destructive" : isLow ? "secondary" : "outline"}
                      className={isLow ? "bg-orange-100 text-orange-700" : ""}
                    >
                      {stockMl.toLocaleString()} ml
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
