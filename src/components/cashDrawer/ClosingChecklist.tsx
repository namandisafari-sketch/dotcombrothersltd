import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import CurrencyCashCount from "./CurrencyCashCount";

interface Currency {
  code: string;
  name: string;
  rate: number;
}

interface ClosingChecklistProps {
  shift: {
    id: string;
    opening_float: number;
    department_id: string;
  };
  expectedCash: number;
  currencies: Currency[];
  onClose: () => void;
}

const ClosingChecklist = ({ shift, expectedCash, currencies, onClose }: ClosingChecklistProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [cashCounted, setCashCounted] = useState(false);
  const [cashVerified, setCashVerified] = useState(false);
  const [discrepancyExplained, setDiscrepancyExplained] = useState(false);
  const [notes, setNotes] = useState("");
  const [totalCash, setTotalCash] = useState(0);
  const [currencyCounts, setCurrencyCounts] = useState<Record<string, number>>({});

  const discrepancy = totalCash - expectedCash;
  const hasDiscrepancy = Math.abs(discrepancy) > 0;

  const handleTotalChange = useCallback((total: number, counts: Record<string, number>) => {
    setTotalCash(total);
    setCurrencyCounts(counts);
  }, []);

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      // Update shift
      const { error: shiftError } = await supabase
        .from("cash_drawer_shifts")
        .update({
          closed_by: user?.id,
          closed_at: new Date().toISOString(),
          closing_cash: totalCash,
          expected_cash: expectedCash,
          discrepancy: discrepancy,
          status: "closed",
        })
        .eq("id", shift.id);

      if (shiftError) throw shiftError;

      // Save currency counts
      const currencyRecords = currencies.map((currency) => ({
        shift_id: shift.id,
        currency: currency.code,
        amount: currencyCounts[currency.code] || 0,
        exchange_rate: currency.rate,
        amount_in_base: (currencyCounts[currency.code] || 0) * currency.rate,
        count_type: "closing",
      }));

      const { error: currencyError } = await supabase
        .from("currency_cash_counts")
        .insert(currencyRecords);

      if (currencyError) throw currencyError;

      // Save checklist
      const { error: checklistError } = await supabase
        .from("closing_checklists")
        .insert({
          shift_id: shift.id,
          department_id: shift.department_id,
          completed_by: user?.id,
          cash_counted: cashCounted,
          cash_verified: cashVerified,
          discrepancy_explained: hasDiscrepancy ? discrepancyExplained : true,
          notes: notes || null,
          completed_at: new Date().toISOString(),
        });

      if (checklistError) throw checklistError;
    },
    onSuccess: () => {
      toast.success("Shift closed successfully");
      queryClient.invalidateQueries({ queryKey: ["current-shift"] });
      queryClient.invalidateQueries({ queryKey: ["shift-history"] });
      onClose();
    },
    onError: (error) => {
      toast.error("Failed to close shift: " + error.message);
    },
  });

  const canClose = cashCounted && cashVerified && (!hasDiscrepancy || discrepancyExplained);

  return (
    <div className="space-y-6">
      {/* Multi-currency Cash Count */}
      <CurrencyCashCount currencies={currencies} onTotalChange={handleTotalChange} />

      <Separator />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Expected Cash</p>
            <p className="text-xl font-bold">{expectedCash.toLocaleString()} UGX</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Counted Cash</p>
            <p className="text-xl font-bold">{totalCash.toLocaleString()} UGX</p>
          </CardContent>
        </Card>

        <Card className={hasDiscrepancy ? (discrepancy > 0 ? "border-green-500" : "border-red-500") : "border-primary"}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Difference</p>
            <div className="flex items-center gap-2">
              {!hasDiscrepancy ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : discrepancy > 0 ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <p className={`text-xl font-bold ${
                !hasDiscrepancy ? "text-green-600" :
                discrepancy > 0 ? "text-amber-600" : "text-red-600"
              }`}>
                {discrepancy > 0 ? "+" : ""}{discrepancy.toLocaleString()} UGX
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {!hasDiscrepancy ? "Perfect match!" :
               discrepancy > 0 ? "Overage" : "Shortage"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Checklist */}
      <div className="space-y-4">
        <h3 className="font-semibold">Closing Checklist</h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="cashCounted"
              checked={cashCounted}
              onCheckedChange={(checked) => setCashCounted(checked as boolean)}
            />
            <Label htmlFor="cashCounted" className="cursor-pointer">
              I have physically counted all cash in the drawer
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Checkbox
              id="cashVerified"
              checked={cashVerified}
              onCheckedChange={(checked) => setCashVerified(checked as boolean)}
            />
            <Label htmlFor="cashVerified" className="cursor-pointer">
              I have verified the amounts entered above are correct
            </Label>
          </div>

          {hasDiscrepancy && (
            <div className="flex items-center space-x-3">
              <Checkbox
                id="discrepancyExplained"
                checked={discrepancyExplained}
                onCheckedChange={(checked) => setDiscrepancyExplained(checked as boolean)}
              />
              <Label htmlFor="discrepancyExplained" className="cursor-pointer text-amber-600">
                I acknowledge the {Math.abs(discrepancy).toLocaleString()} UGX {discrepancy > 0 ? "overage" : "shortage"}
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="closeNotes">Closing Notes (Optional)</Label>
        <Textarea
          id="closeNotes"
          placeholder="Any notes about this shift closing..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={() => closeShiftMutation.mutate()}
          disabled={!canClose || closeShiftMutation.isPending}
          className="flex-1"
        >
          {closeShiftMutation.isPending ? "Closing..." : "Close Shift"}
        </Button>
      </div>
    </div>
  );
};

export default ClosingChecklist;
