import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Currency {
  code: string;
  name: string;
  rate: number;
}

interface CurrencyCashCountProps {
  currencies: Currency[];
  onTotalChange: (totalInBase: number, counts: Record<string, number>) => void;
}

const CurrencyCashCount = ({ currencies, onTotalChange }: CurrencyCashCountProps) => {
  const [counts, setCounts] = useState<Record<string, string>>({});

  useEffect(() => {
    const numericCounts: Record<string, number> = {};
    let totalInBase = 0;

    currencies.forEach((currency) => {
      const amount = parseFloat(counts[currency.code] || "0") || 0;
      numericCounts[currency.code] = amount;
      totalInBase += amount * currency.rate;
    });

    onTotalChange(totalInBase, numericCounts);
  }, [counts, currencies, onTotalChange]);

  const handleChange = (code: string, value: string) => {
    setCounts((prev) => ({ ...prev, [code]: value }));
  };

  const getAmountInBase = (code: string) => {
    const currency = currencies.find((c) => c.code === code);
    const amount = parseFloat(counts[code] || "0") || 0;
    return amount * (currency?.rate || 1);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Count Cash by Currency</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currencies.map((currency) => (
          <Card key={currency.code}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium">{currency.code}</Label>
                <span className="text-xs text-muted-foreground">
                  {currency.rate === 1 ? "Base" : `1 = ${currency.rate.toLocaleString()} UGX`}
                </span>
              </div>
              <Input
                type="number"
                placeholder={`Amount in ${currency.code}`}
                value={counts[currency.code] || ""}
                onChange={(e) => handleChange(currency.code, e.target.value)}
              />
              {currency.rate !== 1 && counts[currency.code] && (
                <p className="text-sm text-muted-foreground">
                  = {getAmountInBase(currency.code).toLocaleString()} UGX
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CurrencyCashCount;
