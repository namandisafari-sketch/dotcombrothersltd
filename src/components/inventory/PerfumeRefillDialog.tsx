import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Sparkles, Plus, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PERFUME_SCENTS } from "@/constants/perfumeScents";
import { useDepartment } from "@/contexts/DepartmentContext";

interface PerfumeRefillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfumeProducts: any[];
  customerId?: string | null;
  onAddToCart: (item: any) => void;
}

interface ScentWithMl {
  scent: string;
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

export function PerfumeRefillDialog({
  open,
  onOpenChange,
  perfumeProducts,
  customerId,
  onAddToCart,
}: PerfumeRefillDialogProps) {
  const { selectedDepartmentId } = useDepartment();
  const [scentsWithMl, setScentsWithMl] = useState<ScentWithMl[]>([]);
  const [currentScent, setCurrentScent] = useState("");
  const [currentMl, setCurrentMl] = useState<string>("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customerType, setCustomerType] = useState<"retail" | "wholesale">("retail");
  const [selectedBottleSize, setSelectedBottleSize] = useState<string>("");
  const [selectedShopProducts, setSelectedShopProducts] = useState<Record<string, number>>({});

  // Fetch Oil Perfume master stock (uses total_ml for ml tracking)
  const { data: masterPerfumeStock } = useQuery({
    queryKey: ["oil-perfume-stock", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return null;
      
      const { data, error } = await supabase
        .from("products")
        .select("id, total_ml, min_stock")
        .eq("name", "Oil Perfume")
        .eq("tracking_type", "ml")
        .eq("department_id", selectedDepartmentId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
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

  // Fetch shop products (all regular products from perfume department, excluding Oil Perfume capital stock)
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
      // Filter out the master stock (ml tracking type used for oil perfume refills)
      // and products with no stock
      return (data || []).filter(p => 
        p.tracking_type !== 'ml' && (p.stock > 0 || p.current_stock > 0)
      );
    },
    enabled: !!selectedDepartmentId,
  });

  // Fetch custom scents
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
  const allScents = [
    ...PERFUME_SCENTS,
    ...(customScents?.map(s => s.name) || [])
  ].sort();

  const addScent = () => {
    if (!currentScent) {
      toast.error("Please select a scent");
      return;
    }
    
    if (customerType === "wholesale") {
      if (!currentMl || isNaN(parseFloat(currentMl)) || parseFloat(currentMl) <= 0) {
        toast.error("Please enter a valid ml amount");
        return;
      }
    }
    
    if (scentsWithMl.length >= 10) {
      toast.error("Maximum 10 scents allowed");
      return;
    }
    if (scentsWithMl.some(s => s.scent === currentScent)) {
      toast.error("Scent already added");
      return;
    }
    
    const mlValue = customerType === "wholesale" ? parseFloat(currentMl) : 0;
    setScentsWithMl([...scentsWithMl, { scent: currentScent, ml: mlValue }]);
    setCurrentScent("");
    setCurrentMl("");
  };

  const removeScent = (scent: string) => {
    setScentsWithMl(scentsWithMl.filter(s => s.scent !== scent));
  };

  const updateScentMl = (scent: string, ml: string) => {
    const mlValue = parseFloat(ml);
    if (isNaN(mlValue) || mlValue < 0) return;
    
    setScentsWithMl(scentsWithMl.map(s => 
      s.scent === scent ? { ...s, ml: mlValue } : s
    ));
  };

  const getTotalMl = () => {
    if (customerType === "retail") {
      if (!selectedBottleSize) return 0;
      return Number(selectedBottleSize);
    } else {
      return scentsWithMl.reduce((sum, scent) => sum + scent.ml, 0);
    }
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
      
      const pricing = bottlePricing.find((p: any) => p.ml === totalMl);
      return pricing?.price || 0;
    } else {
      const pricePerMl = pricingConfig?.wholesale_price_per_ml || 400;
      const basePrice = totalMl * pricePerMl;
      return Math.round(basePrice);
    }
  };
  
  const getPricePerMl = () => {
    return customerType === "wholesale" 
      ? (pricingConfig?.wholesale_price_per_ml || 400)
      : (pricingConfig?.retail_price_per_ml || 800);
  };

  const handleAddToCart = async () => {
    if (scentsWithMl.length === 0) {
      toast.error("Please add at least one scent");
      return;
    }

    const totalMl = getTotalMl();
    if (totalMl <= 0) {
      toast.error(customerType === "retail" ? "Please select a bottle size" : "Total ml must be greater than 0");
      return;
    }

    // Check available stock
    const availableStock = masterPerfumeStock?.total_ml || 0;
    if (totalMl > availableStock) {
      toast.error(`Insufficient stock! Available: ${availableStock}ml, Required: ${totalMl}ml`);
      return;
    }

    const price = calculatePrice();
    const scentMixture = scentsWithMl.map(s => 
      `${s.scent}${customerType === "wholesale" ? ` (${s.ml}ml)` : ''}`
    ).join(" + ");
    const pricePerMl = getPricePerMl();
    const bottleCost = getBottleCostBySize(totalMl);
    
    const basePrice = totalMl * pricePerMl;
    
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
    setScentsWithMl([]);
    setSelectedBottleSize("");
    setCustomerType("retail");
    setCurrentScent("");
    setCurrentMl("");
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

  const bottleSizes = pricingConfig?.retail_bottle_pricing?.sizes || DEFAULT_PRICING_CONFIG.retail_bottle_pricing.sizes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Perfume Point of Sale
          </DialogTitle>
          <DialogDescription>
            Create custom perfume bottles with oil or alcohol-based fragrances
          </DialogDescription>
          {masterPerfumeStock && (
            <div className="mt-2 p-2 bg-muted/50 rounded-md flex items-center justify-between">
              <span className="text-sm font-medium">Available Oil Perfume Stock:</span>
              <Badge variant={
                (masterPerfumeStock.total_ml || 0) < (masterPerfumeStock.min_stock || 1000)
                  ? "destructive"
                  : "secondary"
              }>
                {(masterPerfumeStock.total_ml || 0).toLocaleString()} ml
              </Badge>
            </div>
          )}
          {!masterPerfumeStock && (
            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">⚠️ Oil Perfume stock not configured</p>
              <p className="text-xs text-muted-foreground">Contact admin to set up perfume inventory</p>
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

            {/* Bottle Size (Retail only) */}
            {customerType === "retail" && (
              <div className="space-y-2">
                <Label>Bottle Size</Label>
                <Select value={selectedBottleSize} onValueChange={setSelectedBottleSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bottle size" />
                  </SelectTrigger>
                  <SelectContent>
                    {bottleSizes.map((size: any) => (
                      <SelectItem key={size.ml} value={size.ml.toString()}>
                        {size.ml}ml - UGX {size.price.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Scent Selection */}
            <div className="space-y-2">
              <Label>Add Scents</Label>
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
                          {allScents.map((scent) => (
                            <CommandItem
                              key={scent}
                              value={scent}
                              onSelect={() => {
                                setCurrentScent(scent);
                                setPopoverOpen(false);
                              }}
                            >
                              {scent}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {customerType === "wholesale" && (
                  <Input
                    type="number"
                    placeholder="ml"
                    className="w-20"
                    value={currentMl}
                    onChange={(e) => setCurrentMl(e.target.value)}
                  />
                )}
                <Button onClick={addScent} size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Selected Scents */}
            {scentsWithMl.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Scents</Label>
                <div className="flex flex-wrap gap-2">
                  {scentsWithMl.map((s) => (
                    <Badge key={s.scent} variant="secondary" className="px-3 py-1 flex items-center gap-2">
                      {s.scent}
                      {customerType === "wholesale" && (
                        <Input
                          type="number"
                          className="w-16 h-6 text-xs"
                          value={s.ml}
                          onChange={(e) => updateScentMl(s.scent, e.target.value)}
                        />
                      )}
                      <button onClick={() => removeScent(s.scent)} className="ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Price Summary */}
            {scentsWithMl.length > 0 && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Total Volume:</span>
                    <span className="font-semibold">{getTotalMl()} ml</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price:</span>
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
              disabled={scentsWithMl.length === 0 || (customerType === "retail" && !selectedBottleSize)}
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
