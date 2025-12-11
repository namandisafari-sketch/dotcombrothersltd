import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StockReconciliationProps {
  departmentId: string;
}

export function StockReconciliation({ departmentId }: StockReconciliationProps) {
  // Fetch master Oil Perfume product
  const { data: masterPerfume } = useQuery({
    queryKey: ["master-perfume-reconcile", departmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, total_ml, min_stock")
        .eq("name", "Oil Perfume")
        .eq("tracking_type", "ml")
        .eq("department_id", departmentId)
        .maybeSingle();
      return data;
    },
    enabled: !!departmentId,
  });

  // Fetch all active scents with stock
  const { data: scents = [] } = useQuery({
    queryKey: ["scents-reconcile", departmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("perfume_scents")
        .select("id, name, stock_ml")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!departmentId,
  });

  const totalScentMl = scents.reduce((sum, s) => sum + (s.stock_ml || 0), 0);
  const oilPerfumeMl = masterPerfume?.total_ml || 0;
  const discrepancy = totalScentMl - oilPerfumeMl;
  const discrepancyPercent = oilPerfumeMl > 0 ? Math.abs((discrepancy / oilPerfumeMl) * 100) : 0;
  
  const isBalanced = Math.abs(discrepancy) < 10; // Within 10ml tolerance
  const scentsWithStock = scents.filter(s => (s.stock_ml || 0) > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="w-5 h-5" />
          Stock Reconciliation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comparison Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Scent Stock</p>
            <p className="text-2xl font-bold">{totalScentMl.toLocaleString()} ml</p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {scentsWithStock.length} scents
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Oil Perfume Total</p>
            <p className="text-2xl font-bold">{oilPerfumeMl.toLocaleString()} ml</p>
            <p className="text-xs text-muted-foreground mt-1">
              Master product tracking
            </p>
          </div>
        </div>

        {/* Discrepancy Alert */}
        {isBalanced ? (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-600">Balanced</AlertTitle>
            <AlertDescription className="text-green-600/80">
              Stock levels are reconciled within acceptable tolerance.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant={Math.abs(discrepancy) > 100 ? "destructive" : "default"}>
            {discrepancy > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <AlertTitle>
              {discrepancy > 0 ? "Scent Stock Exceeds" : "Oil Perfume Exceeds"} by {Math.abs(discrepancy).toLocaleString()} ml
            </AlertTitle>
            <AlertDescription>
              {discrepancy > 0 
                ? "Total scent stock is higher than Oil Perfume total. Consider updating Oil Perfume stock."
                : "Oil Perfume total is higher than scent stock. Some scent stock may need to be recorded."}
              {discrepancyPercent > 0 && ` (${discrepancyPercent.toFixed(1)}% difference)`}
            </AlertDescription>
          </Alert>
        )}

        {/* Visual Comparison */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Scent Stock</span>
            <span className="font-medium">{totalScentMl.toLocaleString()} ml</span>
          </div>
          <Progress 
            value={oilPerfumeMl > 0 ? Math.min((totalScentMl / Math.max(totalScentMl, oilPerfumeMl)) * 100, 100) : 0} 
            className="h-3"
          />
          <div className="flex justify-between text-sm mt-2">
            <span>Oil Perfume</span>
            <span className="font-medium">{oilPerfumeMl.toLocaleString()} ml</span>
          </div>
          <Progress 
            value={totalScentMl > 0 ? Math.min((oilPerfumeMl / Math.max(totalScentMl, oilPerfumeMl)) * 100, 100) : 0} 
            className={cn("h-3", discrepancy < 0 && "bg-orange-100 [&>div]:bg-orange-500")}
          />
        </div>

        {/* Scent Breakdown */}
        {scentsWithStock.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-3">Scent Stock Breakdown</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scentsWithStock.map((scent) => (
                <div key={scent.id} className="flex justify-between items-center text-sm">
                  <span className="truncate mr-2">{scent.name}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {(scent.stock_ml || 0).toLocaleString()} ml
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
