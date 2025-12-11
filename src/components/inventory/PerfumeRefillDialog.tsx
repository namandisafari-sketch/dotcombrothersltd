import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles, Plus, Package, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PERFUME_SCENTS } from "@/constants/perfumeScents";
import { useDepartment } from "@/contexts/DepartmentContext";

interface PerfumeRefillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfumeProducts: any[];
  customerId?: string | null;
  onAddToCart: (item: any) => void;
}

interface SelectedScent {
  scent: string;
  scentId: string | null;
  ml: number;
}

// Default pricing config
const DEFAULT_PRICING_CONFIG = {
  retail_price_per_ml: 800,
  wholesale_price_per_ml: 400,
  bottle_cost_config: {
    ranges: [
      { min: 0, max: 10, cost: 300 },
      { min: 11, max: 30, cost: 500 },
      { min: 31, max: 50, cost: 1000 },
      { min: 51, max: 100, cost: 1500 },
      { min: 101, max: 200, cost: 2000 },
      { min: 201, max: 999999, cost: 3000 }
    ]
  },
  retail_bottle_pricing: {
    sizes: [
      { ml: 10, price: 8000 },
      { ml: 15, price: 12000 },
      { ml: 20, price: 16000 },
      { ml: 25, price: 20000 },
      { ml: 30, price: 24000 },
      { ml: 50, price: 40000 },
      { ml: 100, price: 80000 }
    ]
  }
};

const BOTTLE_SIZES = [10, 15, 20, 25, 30, 50, 100];
const LOW_STOCK_THRESHOLD = 100; // ml

export function PerfumeRefillDialog({
  open,
  onOpenChange,
  perfumeProducts,
  customerId,
  onAddToCart,
}: PerfumeRefillDialogProps) {
  const { selectedDepartmentId } = useDepartment();
  const [selectedScents, setSelectedScents] = useState<SelectedScent[]>([]);
  const [currentScent, setCurrentScent] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customerType, setCustomerType] = useState<"retail" | "wholesale">("retail");
  const [selectedBottleSize, setSelectedBottleSize] = useState<string>("");
  const [selectedShopProducts, setSelectedShopProducts] = useState<Record<string, number>>({});

  // Fetch scents with stock information
  const { data: scentsWithStock = [] } = useQuery({
    queryKey: ["scents-with-stock", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data, error } = await supabase
        .from("perfume_scents")
        .select("id, name, description, stock_ml")
        .eq("department_id", selectedDepartmentId)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  // Fetch frequently used scents (from recent sales)
  const { data: frequentScents = [] } = useQuery({
    queryKey: ["frequent-scents", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      // Get sales from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentSales } = await supabase
        .from("sale_items")
        .select("scent_mixture, ml_amount")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .not("scent_mixture", "is", null);
      
      if (!recentSales) return [];
      
      // Count scent usage
      const scentCounts: Record<string, number> = {};
      recentSales.forEach(sale => {
        if (sale.scent_mixture) {
          const scents = sale.scent_mixture.split(" + ").map(s => s.replace(/\s*\(\d+ml\)/, "").trim());
          scents.forEach(scent => {
            scentCounts[scent] = (scentCounts[scent] || 0) + 1;
          });
        }
      });
      
      // Return top 5 most used scents
      return Object.entries(scentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
    },
    enabled: !!selectedDepartmentId,
  });

  // Get pricing config from department settings or use defaults
  const { data: departmentSettings } = useQuery({
    queryKey: ["department-settings", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return null;
      
      const { data, error } = await supabase
        .from("settings")
        .select("settings_json")
        .eq("department_id", selectedDepartmentId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!selectedDepartmentId,
  });

  const pricingConfig = (departmentSettings?.settings_json as any)?.perfume_pricing || DEFAULT_PRICING_CONFIG;

  // Fetch shop products
  const { data: shopProducts = [] } = useQuery({
    queryKey: ["perfume-shop-products", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .eq("is_archived", false)
        .neq("name", "Oil Perfume")
        .order("name");
      
      if (error) throw error;
      return (data || []).filter(p => 
        p.tracking_type !== 'ml' && (p.stock > 0 || p.current_stock > 0)
      );
    },
    enabled: !!selectedDepartmentId,
  });

  // Fetch custom scents (for backwards compatibility)
  const { data: customScents } = useQuery({
    queryKey: ["custom-scents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfume_scents")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Combine default and custom scents
  const allScents = [...new Set([
    ...scentsWithStock.map(s => s.name),
    ...PERFUME_SCENTS,
    ...(customScents?.map(s => s.name) || [])
  ])].sort();

  // Get scent stock info
  const getScentInfo = (scentName: string) => {
    return scentsWithStock.find(s => s.name === scentName);
  };

  // Check if scent is frequently used
  const isFrequentScent = (scentName: string) => {
    return frequentScents.some(s => s.name === scentName);
  };

  // Get low stock scents
  const getLowStockScents = () => {
    return scentsWithStock.filter(s => (s.stock_ml || 0) < LOW_STOCK_THRESHOLD);
  };

  // Get scents with warnings (low stock that are frequently used)
  const getWarningScents = () => {
    return scentsWithStock.filter(s => {
      const isLowStock = (s.stock_ml || 0) < LOW_STOCK_THRESHOLD;
      const isFrequent = isFrequentScent(s.name);
      return isLowStock && isFrequent;
    });
  };

  const addScent = () => {
    if (!currentScent) {
      toast.error("Please select a scent");
      return;
    }
    
    if (selectedScents.length >= 10) {
      toast.error("Maximum 10 scents allowed");
      return;
    }
    
    if (selectedScents.some(s => s.scent === currentScent)) {
      toast.error("Scent already added");
      return;
    }

    const scentInfo = getScentInfo(currentScent);
    
    // Warn if low stock
    if (scentInfo && (scentInfo.stock_ml || 0) < LOW_STOCK_THRESHOLD) {
      toast.warning(`Low stock warning: ${currentScent} only has ${scentInfo.stock_ml || 0}ml remaining`);
    }
    
    setSelectedScents([...selectedScents, {
      scent: currentScent,
      scentId: scentInfo?.id || null,
      ml: 0,
    }]);
    
    setCurrentScent("");
  };

  const removeScent = (scent: string) => {
    setSelectedScents(selectedScents.filter(s => s.scent !== scent));
  };

  // Calculate ML per scent based on bottle size and number of scents
  const getMlPerScent = () => {
    if (!selectedBottleSize || selectedScents.length === 0) return 0;
    return Math.round((parseInt(selectedBottleSize) / selectedScents.length) * 10) / 10;
  };

  const getBottleCostBySize = (totalMl: number) => {
    const config = pricingConfig?.bottle_cost_config as any;
    if (!config?.ranges) return 1000;
    
    const ranges = config.ranges;
    const range = ranges.find((r: any) => totalMl >= r.min && totalMl <= r.max);
    return range?.cost || 1000;
  };

  const calculatePrice = () => {
    const totalMl = parseInt(selectedBottleSize) || 0;
    if (totalMl <= 0) return 0;

    if (customerType === "retail") {
      const bottlePricing = pricingConfig?.retail_bottle_pricing?.sizes;
      if (!bottlePricing || !Array.isArray(bottlePricing)) return 0;
      
      const pricing = bottlePricing.find((p: any) => p.ml === totalMl);
      if (pricing) return pricing.price;
      
      return totalMl * (pricingConfig?.retail_price_per_ml || 800);
    } else {
      const pricePerMl = pricingConfig?.wholesale_price_per_ml || 400;
      return Math.round(totalMl * pricePerMl);
    }
  };
  
  const getPricePerMl = () => {
    return customerType === "wholesale" 
      ? (pricingConfig?.wholesale_price_per_ml || 400)
      : (pricingConfig?.retail_price_per_ml || 800);
  };

  // Check if any selected scent has insufficient stock
  const checkStockSufficiency = () => {
    const mlPerScent = getMlPerScent();
    const insufficientScents: string[] = [];
    
    selectedScents.forEach(s => {
      const scentInfo = getScentInfo(s.scent);
      if (scentInfo && mlPerScent > (scentInfo.stock_ml || 0)) {
        insufficientScents.push(`${s.scent} (need ${mlPerScent}ml, have ${scentInfo.stock_ml || 0}ml)`);
      }
    });
    
    return insufficientScents;
  };

  const handleAddToCart = async () => {
    if (selectedScents.length === 0) {
      toast.error("Please add at least one scent");
      return;
    }

    if (!selectedBottleSize) {
      toast.error("Please select a bottle size");
      return;
    }

    // Check stock sufficiency
    const insufficientScents = checkStockSufficiency();
    if (insufficientScents.length > 0) {
      toast.error(`Insufficient stock: ${insufficientScents.join(", ")}`);
      return;
    }

    const totalMl = parseInt(selectedBottleSize);
    const mlPerScent = getMlPerScent();
    const price = calculatePrice();
    const scentMixture = selectedScents.map(s => s.scent).join(" + ");
    const pricePerMl = getPricePerMl();
    const bottleCost = getBottleCostBySize(totalMl);
    const basePrice = totalMl * pricePerMl;
    
    // Update scents with calculated ML
    const scentsWithMl = selectedScents.map(s => ({
      scent: s.scent,
      scentId: s.scentId,
      ml: mlPerScent,
    }));
    
    onAddToCart({
      id: `perfume-${Date.now()}`,
      name: `${scentMixture} (${totalMl}ml)`,
      price,
      quantity: 1,
      type: "perfume",
      isService: true,
      trackingType: "ml",
      selectedScents: scentsWithMl,
      bottleSize: totalMl,
      customerType,
      pricePerMl,
      scentMixture,
      basePrice,
      totalMl,
      isPerfumeRefill: true,
      subtotal: price,
      bottleCost,
    });

    // Reset form
    setSelectedScents([]);
    setSelectedBottleSize("");
    setCustomerType("retail");
    setCurrentScent("");
    onOpenChange(false);
    
    toast.success("Added to cart!");
  };

  const updateShopProductQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      const newSelected = { ...selectedShopProducts };
      delete newSelected[productId];
      setSelectedShopProducts(newSelected);
    } else {
      setSelectedShopProducts({ ...selectedShopProducts, [productId]: quantity });
    }
  };

  const handleAddShopProductsToCart = () => {
    const selectedItems = Object.entries(selectedShopProducts);
    if (selectedItems.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    selectedItems.forEach(([productId, quantity]) => {
      const product = shopProducts.find(p => p.id === productId);
      if (!product) return;

      const price = product.price;
      
      onAddToCart({
        id: `shop-product-${productId}-${Date.now()}`,
        name: `${product.name}`,
        price,
        quantity,
        type: "shop_product",
        productId: product.id,
        customerType,
        subtotal: price * quantity,
      });
    });

    setSelectedShopProducts({});
    onOpenChange(false);
    toast.success("Products added to cart!");
  };

  // Get total stock available
  const getTotalAvailableStock = () => {
    return scentsWithStock.reduce((sum, s) => sum + (s.stock_ml || 0), 0);
  };

  const warningScents = getWarningScents();
  const lowStockScents = getLowStockScents();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Perfume Point of Sale
          </DialogTitle>
          <DialogDescription>
            Create custom perfume bottles with your choice of scents
          </DialogDescription>
          
          {/* Stock Summary */}
          <div className="mt-2 p-2 bg-muted/50 rounded-md flex items-center justify-between">
            <span className="text-sm font-medium">Total Available Stock:</span>
            <Badge variant={getTotalAvailableStock() < 500 ? "destructive" : "secondary"}>
              {getTotalAvailableStock().toLocaleString()} ml across {scentsWithStock.length} scents
            </Badge>
          </div>

          {/* Warning for frequently used low stock scents */}
          {warningScents.length > 0 && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Restock needed:</strong> {warningScents.map(s => `${s.name} (${s.stock_ml || 0}ml)`).join(", ")}
                {" "}are frequently used but running low!
              </AlertDescription>
            </Alert>
          )}

          {/* Frequently used scents indicator */}
          {frequentScents.length > 0 && (
            <div className="mt-2 p-2 bg-primary/5 rounded-md">
              <div className="flex items-center gap-1 text-sm font-medium mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                Popular Scents (Last 30 days):
              </div>
              <div className="flex flex-wrap gap-1">
                {frequentScents.map(s => {
                  const scentInfo = getScentInfo(s.name);
                  const isLowStock = scentInfo && (scentInfo.stock_ml || 0) < LOW_STOCK_THRESHOLD;
                  return (
                    <Badge 
                      key={s.name} 
                      variant={isLowStock ? "destructive" : "outline"}
                      className="text-xs"
                    >
                      {s.name} ({s.count}x)
                      {isLowStock && " ⚠️"}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </DialogHeader>

        <Tabs defaultValue="oil-perfume" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="oil-perfume" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Oil Perfume
            </TabsTrigger>
            <TabsTrigger value="shop-products" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Shop Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="oil-perfume" className="space-y-4 mt-4">
            {/* Customer Type Selection */}
            <div className="space-y-2">
              <Label>Customer Type</Label>
              <Select value={customerType} onValueChange={(v) => setCustomerType(v as "retail" | "wholesale")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bottle Size Selection */}
            <div className="space-y-2">
              <Label>Bottle Size</Label>
              <Select value={selectedBottleSize} onValueChange={setSelectedBottleSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bottle size" />
                </SelectTrigger>
                <SelectContent>
                  {BOTTLE_SIZES.map((size) => {
                    const pricing = pricingConfig?.retail_bottle_pricing?.sizes?.find((p: any) => p.ml === size);
                    const price = customerType === "retail" 
                      ? (pricing?.price || size * (pricingConfig?.retail_price_per_ml || 800))
                      : size * (pricingConfig?.wholesale_price_per_ml || 400);
                    return (
                      <SelectItem key={size} value={size.toString()}>
                        {size}ml - UGX {price.toLocaleString()}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Scent Selection */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <Label className="font-medium">Select Scents</Label>
                </div>
                
                <div className="flex gap-2">
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-start">
                        {currentScent || "Select scent..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Search scents..." />
                        <CommandList>
                          <CommandEmpty>No scent found.</CommandEmpty>
                          <CommandGroup>
                            {allScents.map((scent) => {
                              const scentInfo = getScentInfo(scent);
                              const hasStock = scentInfo && (scentInfo.stock_ml || 0) > 0;
                              const isLowStock = scentInfo && (scentInfo.stock_ml || 0) < LOW_STOCK_THRESHOLD;
                              const isFrequent = isFrequentScent(scent);
                              
                              return (
                                <CommandItem
                                  key={scent}
                                  value={scent}
                                  onSelect={() => {
                                    setCurrentScent(scent);
                                    setPopoverOpen(false);
                                  }}
                                  className="flex justify-between"
                                >
                                  <span className="flex items-center gap-1">
                                    {scent}
                                    {isFrequent && <TrendingUp className="w-3 h-3 text-primary" />}
                                  </span>
                                  {scentInfo && (
                                    <Badge 
                                      variant={isLowStock ? "destructive" : hasStock ? "secondary" : "outline"} 
                                      className="ml-2 text-xs"
                                    >
                                      {scentInfo.stock_ml || 0}ml
                                    </Badge>
                                  )}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button onClick={addScent} variant="secondary">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Selected Scents */}
                {selectedScents.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Selected Scents ({selectedScents.length})</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedScents.map((s) => {
                        const scentInfo = getScentInfo(s.scent);
                        const isLowStock = scentInfo && (scentInfo.stock_ml || 0) < LOW_STOCK_THRESHOLD;
                        return (
                          <Badge 
                            key={s.scent} 
                            variant={isLowStock ? "destructive" : "secondary"} 
                            className="flex items-center gap-1 py-1"
                          >
                            {s.scent}
                            {selectedBottleSize && (
                              <span className="text-xs opacity-70">({getMlPerScent()}ml)</span>
                            )}
                            {isLowStock && <AlertTriangle className="w-3 h-3" />}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 ml-1"
                              onClick={() => removeScent(s.scent)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
                    {selectedBottleSize && selectedScents.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Each scent: {getMlPerScent()}ml (equally divided)
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stock Warning for selected scents */}
            {selectedBottleSize && checkStockSufficiency().length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Insufficient stock: {checkStockSufficiency().join(", ")}
                </AlertDescription>
              </Alert>
            )}

            {/* Price Summary */}
            {selectedBottleSize && selectedScents.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Total Price</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedBottleSize}ml • {customerType} price
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      UGX {calculatePrice().toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button 
              onClick={handleAddToCart} 
              className="w-full"
              disabled={selectedScents.length === 0 || !selectedBottleSize || checkStockSufficiency().length > 0}
            >
              Add to Cart
            </Button>
          </TabsContent>

          <TabsContent value="shop-products" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Customer Type</Label>
              <Select value={customerType} onValueChange={(v) => setCustomerType(v as "retail" | "wholesale")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {shopProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No shop products available
              </div>
            ) : (
              <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {shopProducts.map((product) => {
                  const quantity = selectedShopProducts[product.id] || 0;
                  const stock = product.stock || product.current_stock || 0;
                  const unit = product.unit || "pcs";
                  
                  return (
                    <Card key={product.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            UGX {product.price?.toLocaleString()} • Stock: {stock} {unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateShopProductQuantity(product.id, quantity - 1)}
                            disabled={quantity <= 0}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateShopProductQuantity(product.id, quantity + 1)}
                            disabled={quantity >= stock}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Button 
              onClick={handleAddShopProductsToCart} 
              className="w-full"
              disabled={Object.keys(selectedShopProducts).length === 0}
            >
              Add Products to Cart
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
