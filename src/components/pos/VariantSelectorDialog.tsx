import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackageOpen } from "lucide-react";

interface ProductVariant {
  id: string;
  variant_name: string;
  color: string | null;
  size: string | null;
  current_stock: number;
  price_adjustment: number;
}

interface VariantSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  basePrice: number;
  variants: ProductVariant[];
  onSelectVariant: (variant: ProductVariant) => void;
}

export function VariantSelectorDialog({
  open,
  onOpenChange,
  productName,
  basePrice,
  variants,
  onSelectVariant,
}: VariantSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5" />
            Select Variant - {productName}
          </DialogTitle>
          <DialogDescription>
            Choose a product variant to add to your cart
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-4">
          {variants.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No variants available for this product
            </p>
          ) : (
            variants.map((variant) => {
              const finalPrice = basePrice + (variant.price_adjustment || 0);
              
              return (
                <Button
                  key={variant.id}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start gap-2 hover:border-primary"
                  onClick={() => {
                    onSelectVariant(variant);
                    onOpenChange(false);
                  }}
                  disabled={variant.current_stock <= 0}
                >
                  <div className="flex justify-between w-full items-start">
                    <div className="text-left">
                      <div className="font-semibold text-base">
                        {variant.variant_name}
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {variant.color && (
                          <Badge variant="secondary" className="text-xs">
                            Color: {variant.color}
                          </Badge>
                        )}
                        {variant.size && (
                          <Badge variant="secondary" className="text-xs">
                            Size: {variant.size}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-base">
                        UGX {finalPrice.toLocaleString()}
                      </div>
                      {variant.price_adjustment !== 0 && (
                        <div className="text-xs text-muted-foreground">
                          {variant.price_adjustment > 0 ? '+' : ''}
                          {(variant.price_adjustment || 0).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between w-full items-center mt-1">
                    <Badge 
                      variant={variant.current_stock > 10 ? "default" : variant.current_stock > 0 ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      Stock: {variant.current_stock}
                    </Badge>
                    {variant.current_stock <= 0 && (
                      <span className="text-xs text-destructive font-medium">
                        Out of stock
                      </span>
                    )}
                  </div>
                </Button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
