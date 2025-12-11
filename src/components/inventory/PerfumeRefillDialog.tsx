import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles, Plus, Package, Scale, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PERFUME_SCENTS } from "@/constants/perfumeScents";
import { useDepartment } from "@/contexts/DepartmentContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PerfumeRefillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfumeProducts: any[];
  customerId?: string | null;
  onAddToCart: (item: any) => void;
}

interface ScentWithWeight {
  scent: string;
  scentId: string | null;
  weightBefore: number;
  weightAfter: number;
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

const DEFAULT_DENSITY = 0.9; // g/ml for perfume oils

export function PerfumeRefillDialog({
  open,
  onOpenChange,
  perfumeProducts,
  customerId,
  onAddToCart,
}: PerfumeRefillDialogProps) {
  const { selectedDepartmentId } = useDepartment();
  const [scentsWithWeight, setScentsWithWeight] = useState<ScentWithWeight[]>([]);
  const [currentScent, setCurrentScent] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customerType, setCustomerType] = useState<"retail" | "wholesale">("retail");
  const [selectedBottleSize, setSelectedBottleSize] = useState<string>("");
  const [selectedShopProducts, setSelectedShopProducts] = useState<Record<string, number>>({});
  
  // Weight measurement states
  const [emptyBottleWeight, setEmptyBottleWeight] = useState<string>("");
  const [currentWeight, setCurrentWeight] = useState<string>("");

  // Fetch scents with stock information
  const { data: scentsWithStock = [] } = useQuery({
    queryKey: ["scents-with-stock", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data, error } = await supabase
        .from("perfume_scents")
        .select("id, name, description, stock_ml, density")
        .eq("department_id", selectedDepartmentId)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data || [];
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

  // Combine default and custom scents, prefer ones with stock data
  const allScents = [...new Set([
    ...scentsWithStock.map(s => s.name),
    ...PERFUME_SCENTS,
    ...(customScents?.map(s => s.name) || [])
  ])].sort();

  // Get scent stock info
  const getScentInfo = (scentName: string) => {
    return scentsWithStock.find(s => s.name === scentName);
  };

  // Calculate ML from weight difference
  const calculateMlFromWeight = (weightBefore: number, weightAfter: number, density: number = DEFAULT_DENSITY) => {
    if (weightAfter <= weightBefore) return 0;
    const weightDiff = weightAfter - weightBefore;
    return Math.round((weightDiff / density) * 10) / 10;
  };

  // Get current bottle weight (empty + all scents added so far)
  const getCurrentBottleWeight = () => {
    if (scentsWithWeight.length === 0) {
      return parseFloat(emptyBottleWeight) || 0;
    }
    return scentsWithWeight[scentsWithWeight.length - 1].weightAfter;
  };

  const addScent = () => {
    if (!currentScent) {
      toast.error("Please select a scent");
      return;
    }
    
    if (!emptyBottleWeight || parseFloat(emptyBottleWeight) <= 0) {
      toast.error("Please enter the empty bottle weight first");
      return;
    }

    if (!currentWeight || parseFloat(currentWeight) <= 0) {
      toast.error("Please enter the current weight after adding the scent");
      return;
    }
    
    if (scentsWithWeight.length >= 10) {
      toast.error("Maximum 10 scents allowed");
      return;
    }
    
    if (scentsWithWeight.some(s => s.scent === currentScent)) {
      toast.error("Scent already added");
      return;
    }

    const scentInfo = getScentInfo(currentScent);
    const weightBefore = getCurrentBottleWeight();
    const weightAfter = parseFloat(currentWeight);
    const density = scentInfo?.density || DEFAULT_DENSITY;
    const mlUsed = calculateMlFromWeight(weightBefore, weightAfter, density);

    if (mlUsed <= 0) {
      toast.error("Current weight must be greater than previous weight");
      return;
    }

    // Check stock availability
    if (scentInfo && scentInfo.stock_ml !== null && mlUsed > scentInfo.stock_ml) {
      toast.error(`Insufficient stock for ${currentScent}! Available: ${scentInfo.stock_ml}ml, Required: ${mlUsed}ml`);
      return;
    }

    setScentsWithWeight([...scentsWithWeight, {
      scent: currentScent,
      scentId: scentInfo?.id || null,
      weightBefore,
      weightAfter,
      ml: mlUsed,
    }]);
    
    setCurrentScent("");
    setCurrentWeight("");
  };

  const removeScent = (scent: string) => {
    const index = scentsWithWeight.findIndex(s => s.scent === scent);
    if (index === -1) return;
    
    // Remove this scent and recalculate subsequent weights
    const newScents = [...scentsWithWeight];
    newScents.splice(index, 1);
    
    // Recalculate weights for subsequent scents
    for (let i = index; i < newScents.length; i++) {
      const prevWeight = i === 0 ? parseFloat(emptyBottleWeight) : newScents[i - 1].weightAfter;
      const scentInfo = getScentInfo(newScents[i].scent);
      const density = scentInfo?.density || DEFAULT_DENSITY;
      newScents[i].weightBefore = prevWeight;
      newScents[i].ml = calculateMlFromWeight(prevWeight, newScents[i].weightAfter, density);
    }
    
    setScentsWithWeight(newScents);
  };

  const getTotalMl = () => {
    return scentsWithWeight.reduce((sum, s) => sum + s.ml, 0);
  };

  const getBottleCostBySize = (totalMl: number) => {
    const config = pricingConfig?.bottle_cost_config as any;
    if (!config?.ranges) return 1000;
    
    const ranges = config.ranges;
    const range = ranges.find((r: any) => totalMl >= r.min && totalMl <= r.max);
    return range?.cost || 1000;
  };

  const calculatePrice = () => {
    const totalMl = getTotalMl();
    if (totalMl <= 0) return 0;

    if (customerType === "retail") {
      const bottlePricing = pricingConfig?.retail_bottle_pricing?.sizes;
      if (!bottlePricing || !Array.isArray(bottlePricing)) return 0;
      
      // Find closest bottle size pricing
      const pricing = bottlePricing.find((p: any) => p.ml >= totalMl) || bottlePricing[bottlePricing.length - 1];
      return pricing?.price || (totalMl * (pricingConfig?.retail_price_per_ml || 800));
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

  const handleAddToCart = async () => {
    if (scentsWithWeight.length === 0) {
      toast.error("Please add at least one scent");
      return;
    }

    const totalMl = getTotalMl();
    if (totalMl <= 0) {
      toast.error("Total ml must be greater than 0");
      return;
    }

    const price = calculatePrice();
    const scentMixture = scentsWithWeight.map(s => `${s.scent} (${s.ml}ml)`).join(" + ");
    const pricePerMl = getPricePerMl();
    const bottleCost = getBottleCostBySize(totalMl);
    const basePrice = totalMl * pricePerMl;
    
    onAddToCart({
      id: `perfume-${Date.now()}`,
      name: `${scentMixture}`,
      price,
      quantity: 1,
      type: "perfume",
      isService: true,
      trackingType: "ml",
      selectedScents: scentsWithWeight.map(s => ({
        scent: s.scent,
        scentId: s.scentId,
        ml: s.ml,
      })),
      bottleSize: totalMl,
      customerType,
      pricePerMl,
      scentMixture,
      basePrice,
      totalMl,
      isPerfumeRefill: true,
      subtotal: price,
      bottleCost,
      emptyBottleWeight: parseFloat(emptyBottleWeight),
    });

    // Reset form
    setScentsWithWeight([]);
    setSelectedBottleSize("");
    setCustomerType("retail");
    setCurrentScent("");
    setCurrentWeight("");
    setEmptyBottleWeight("");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Perfume Point of Sale
          </DialogTitle>
          <DialogDescription>
            Create custom perfume bottles - measure by weight for accurate stock tracking
          </DialogDescription>
          
          {/* Stock Summary */}
          <div className="mt-2 p-2 bg-muted/50 rounded-md flex items-center justify-between">
            <span className="text-sm font-medium">Total Available Stock:</span>
            <Badge variant={getTotalAvailableStock() < 500 ? "destructive" : "secondary"}>
              {getTotalAvailableStock().toLocaleString()} ml across {scentsWithStock.length} scents
            </Badge>
          </div>
          
          {scentsWithStock.length === 0 && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No scent stock configured. Please set up scent inventory first.
              </AlertDescription>
            </Alert>
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

            {/* Empty Bottle Weight */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4 text-primary" />
                  <Label className="font-medium">Step 1: Empty Bottle Weight</Label>
                </div>
                <Input
                  type="number"
                  placeholder="Enter empty bottle weight in grams"
                  value={emptyBottleWeight}
                  onChange={(e) => setEmptyBottleWeight(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Weigh the empty bottle before adding any perfume
                </p>
              </CardContent>
            </Card>

            {/* Scent Selection with Weight */}
            {emptyBottleWeight && parseFloat(emptyBottleWeight) > 0 && (
              <Card className="bg-muted/30">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <Label className="font-medium">Step 2: Add Scents</Label>
                  </div>
                  
                  <div className="grid gap-2">
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
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
                                    <span>{scent}</span>
                                    {scentInfo && (
                                      <Badge variant={hasStock ? "secondary" : "destructive"} className="text-xs">
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
                    
                    {currentScent && (
                      <div className="space-y-2">
                        <Label className="text-sm">
                          Weight after adding {currentScent} (grams)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder={`Current weight (must be > ${getCurrentBottleWeight()}g)`}
                            value={currentWeight}
                            onChange={(e) => setCurrentWeight(e.target.value)}
                          />
                          <Button onClick={addScent}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        {currentWeight && parseFloat(currentWeight) > getCurrentBottleWeight() && (
                          <p className="text-xs text-primary">
                            ≈ {calculateMlFromWeight(getCurrentBottleWeight(), parseFloat(currentWeight))}ml of {currentScent}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Scents */}
            {scentsWithWeight.length > 0 && (
              <div className="space-y-2">
                <Label>Added Scents</Label>
                <div className="space-y-2">
                  {scentsWithWeight.map((s, index) => {
                    const scentInfo = getScentInfo(s.scent);
                    
                    return (
                      <div key={s.scent} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.scent}</span>
                            <Badge variant="secondary">{s.ml}ml</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {s.weightBefore}g → {s.weightAfter}g
                            {scentInfo && ` | Stock remaining: ${Math.max(0, (scentInfo.stock_ml || 0) - s.ml)}ml`}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => removeScent(s.scent)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price Summary */}
            {scentsWithWeight.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Total Volume:</span>
                    <span className="font-semibold">{getTotalMl()} ml</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Type:</span>
                    <Badge variant="outline" className="capitalize">{customerType}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Bottle Cost:</span>
                    <span>UGX {getBottleCostBySize(getTotalMl()).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Total Price:</span>
                    <span className="font-bold text-lg text-primary">
                      UGX {calculatePrice().toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button 
              onClick={handleAddToCart} 
              className="w-full"
              disabled={scentsWithWeight.length === 0}
            >
              Add to Cart
            </Button>
          </TabsContent>

          <TabsContent value="shop-products" className="space-y-4 mt-4">
            {shopProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No shop products available</p>
            ) : (
              <div className="space-y-2">
                {shopProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        UGX {(product.price || 0).toLocaleString()} | Stock: {product.total_ml || product.stock || 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateShopProductQuantity(product.id, (selectedShopProducts[product.id] || 0) - 1)}
                      >
                        -
                      </Button>
                      <span className="w-8 text-center">{selectedShopProducts[product.id] || 0}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateShopProductQuantity(product.id, (selectedShopProducts[product.id] || 0) + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button 
              onClick={handleAddShopProductsToCart} 
              className="w-full"
              disabled={Object.keys(selectedShopProducts).length === 0}
            >
              Add Selected Products to Cart
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
