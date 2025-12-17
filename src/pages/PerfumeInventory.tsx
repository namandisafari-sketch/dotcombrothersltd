import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartment } from "@/contexts/DepartmentContext";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, AlertCircle, Package, Plus, Edit, Trash2, Droplet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ScentStockManager } from "@/components/inventory/ScentStockManager";
import { StockReconciliation } from "@/components/inventory/StockReconciliation";

interface PerfumeProduct {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  sku: string | null;
  cost_price: number | null;
  price: number;
  stock: number | null;
  total_ml: number | null;
  min_stock: number | null;
  tracking_type: 'ml' | 'quantity' | null;
  department_id: string | null;
  is_active: boolean | null;
  retail_price_per_ml: number | null;
  wholesale_price_per_ml: number | null;
  brand: string | null;
  bottle_size_ml: number | null;
}

export default function PerfumeInventory() {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { selectedDepartmentId: contextDepartmentId, selectedDepartment: contextDepartment, isPerfumeDepartment } = useDepartment();
  
  const [selectedPerfumeDeptId, setSelectedPerfumeDeptId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scent-stock");
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PerfumeProduct | null>(null);
  
  // Bottle size pricing state
  const [bottleSizePricingDialogOpen, setBottleSizePricingDialogOpen] = useState(false);
  const [bottleSizePricing, setBottleSizePricing] = useState([
    { ml: 10, price: 8000 },
    { ml: 15, price: 12000 },
    { ml: 20, price: 16000 },
    { ml: 25, price: 20000 },
    { ml: 30, price: 24000 },
    { ml: 50, price: 40000 },
    { ml: 100, price: 80000 },
  ]);

  // Bottle cost configuration state
  const [bottleCostDialogOpen, setBottleCostDialogOpen] = useState(false);
  const [bottleCostRanges, setBottleCostRanges] = useState([
    { min: 0, max: 10, cost: 500 },
    { min: 11, max: 30, cost: 1000 },
    { min: 31, max: 50, cost: 1500 },
    { min: 51, max: 100, cost: 2000 },
    { min: 101, max: 200, cost: 2500 },
    { min: 201, max: 999999, cost: 3000 },
  ]);
  
  // Oil perfume pricing state
  const [oilPerfumePricing, setOilPerfumePricing] = useState({
    cost_price: 0,
    retail_price_per_ml: 0,
    wholesale_price_per_ml: 0,
    min_stock: 1000,
  });

  // Product form state
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    brand: "perfume" as string,
    bottle_size_ml: 0,
    barcode: "",
    cost_price: 0,
    price: 0,
    retail_price: 0,
    wholesale_price: 0,
    stock: 0,
    min_stock: 10,
    sku: "",
    unit: "pieces" as string,
    quantity_per_unit: 1,
  });

  // Fetch perfume departments
  const { data: perfumeDepartments = [] } = useQuery({
    queryKey: ["perfume-departments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("*")
        .or("is_perfume_department.eq.true,name.ilike.%perfume%")
        .order("name");
      return data || [];
    },
  });
  
  useEffect(() => {
    if (isPerfumeDepartment && contextDepartmentId) {
      setSelectedPerfumeDeptId(contextDepartmentId);
    } else if (perfumeDepartments.length > 0 && !selectedPerfumeDeptId) {
      setSelectedPerfumeDeptId(perfumeDepartments[0].id);
    }
  }, [isPerfumeDepartment, contextDepartmentId, perfumeDepartments, selectedPerfumeDeptId]);
  
  const selectedDepartmentId = selectedPerfumeDeptId;
  const selectedDepartment = perfumeDepartments.find(d => d.id === selectedPerfumeDeptId) || contextDepartment;

  // Fetch master perfume (tracking_type = 'ml')
  const { data: masterPerfume, refetch: refetchMasterPerfume } = useQuery({
    queryKey: ["master-perfume", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return null;
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("name", "Oil Perfume")
        .eq("tracking_type", "ml")
        .eq("department_id", selectedDepartmentId)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        setOilPerfumePricing({
          cost_price: data.cost_price || 0,
          retail_price_per_ml: data.retail_price_per_ml || data.price || 0,
          wholesale_price_per_ml: data.wholesale_price_per_ml || 0,
          min_stock: data.min_stock || 1000,
        });
      }
      return data;
    },
    enabled: !!selectedDepartmentId,
  });

  // Fetch total stock from all scents (sum of stock_ml) - ONLY department-specific
  const { data: totalScentStock = 0 } = useQuery({
    queryKey: ["total-scent-stock", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return 0;
      
      // Fetch ONLY department-specific scents - each department is independent
      const { data, error } = await supabase
        .from("perfume_scents")
        .select("stock_ml")
        .eq("department_id", selectedDepartmentId)
        .eq("is_active", true);
      
      if (error) throw error;
      return (data || []).reduce((sum, s) => sum + (s.stock_ml || 0), 0);
    },
    enabled: !!selectedDepartmentId,
    refetchInterval: 5000,
  });

  // Fetch bottle pricing config
  const { data: bottlePricingConfig, refetch: refetchBottlePricingConfig } = useQuery({
    queryKey: ["bottle-pricing-config", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return null;
      
      const { data, error } = await supabase
        .from("perfume_pricing_config")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.retail_bottle_pricing) {
        const config = data.retail_bottle_pricing as any;
        if (config.sizes && config.sizes.length > 0) {
          setBottleSizePricing(config.sizes);
        }
      }
      if (data?.bottle_cost_config) {
        const costConfig = data.bottle_cost_config as any;
        if (costConfig.ranges && costConfig.ranges.length > 0) {
          setBottleCostRanges(costConfig.ranges);
        }
      }
      return data;
    },
    enabled: !!selectedDepartmentId,
  });

  // Create master perfume mutation
  const createMasterPerfumeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDepartmentId) throw new Error("No department selected");
      
      const { data: existing } = await supabase
        .from("products")
        .select("*")
        .eq("name", "Oil Perfume")
        .eq("tracking_type", "ml")
        .eq("department_id", selectedDepartmentId)
        .maybeSingle();
      
      if (existing) {
        toast.info("Oil Perfume product already exists for this department");
        return existing;
      }

      const { data, error } = await supabase
        .from("products")
        .insert([{
          name: "Oil Perfume",
          cost_price: 0,
          price: 800,
          retail_price_per_ml: 800,
          wholesale_price_per_ml: 400,
          tracking_type: "ml" as const,
          total_ml: 0,
          min_stock: 1000,
          department_id: selectedDepartmentId,
          is_active: true,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Oil Perfume master product created");
      setOilPerfumePricing({
        cost_price: data.cost_price || 0,
        retail_price_per_ml: data.retail_price_per_ml || 800,
        wholesale_price_per_ml: data.wholesale_price_per_ml || 400,
        min_stock: data.min_stock || 1000,
      });
      refetchMasterPerfume();
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      console.error("Error creating master perfume:", error);
      toast.error("Failed to create Oil Perfume master product");
    },
  });

  // Fetch shop products (excluding Oil Perfume)
  const { data: shopProducts = [], refetch: refetchShopProducts, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["perfume-shop-products", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .neq("name", "Oil Perfume")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return (data || []) as PerfumeProduct[];
    },
    enabled: !!selectedDepartmentId,
  });



  // Oil perfume pricing mutation
  const updatePricingMutation = useMutation({
    mutationFn: async () => {
      if (!masterPerfume) throw new Error("Master perfume product not found");
      const { error } = await supabase
        .from("products")
        .update({
          cost_price: oilPerfumePricing.cost_price,
          price: oilPerfumePricing.retail_price_per_ml,
          retail_price_per_ml: oilPerfumePricing.retail_price_per_ml,
          wholesale_price_per_ml: oilPerfumePricing.wholesale_price_per_ml,
          min_stock: oilPerfumePricing.min_stock,
        })
        .eq("id", masterPerfume.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oil perfume pricing updated");
      refetchMasterPerfume();
      setPricingDialogOpen(false);
    },
  });

  // Bottle size pricing mutation
  const updateBottleSizePricingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDepartmentId) throw new Error("No department selected");
      
      const { error } = await supabase
        .from("perfume_pricing_config")
        .upsert({
          department_id: selectedDepartmentId,
          retail_bottle_pricing: { sizes: bottleSizePricing },
        }, { onConflict: 'department_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bottle size pricing updated successfully");
      refetchBottlePricingConfig();
      setBottleSizePricingDialogOpen(false);
    },
  });

  // Bottle cost configuration mutation
  const updateBottleCostMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDepartmentId) throw new Error("No department selected");
      
      const { error } = await supabase
        .from("perfume_pricing_config")
        .upsert({
          department_id: selectedDepartmentId,
          bottle_cost_config: { ranges: bottleCostRanges },
        }, { onConflict: 'department_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bottle cost configuration updated successfully");
      refetchBottlePricingConfig();
      setBottleCostDialogOpen(false);
    },
  });

  // Shop product mutations
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      // Validate retail and wholesale prices
      if (!productForm.retail_price || productForm.retail_price <= 0) {
        throw new Error("Retail price is required");
      }
      if (!productForm.wholesale_price || productForm.wholesale_price <= 0) {
        throw new Error("Wholesale price is required");
      }
      
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update({
            name: productForm.name,
            description: productForm.description,
            barcode: productForm.barcode,
            cost_price: productForm.cost_price,
            price: productForm.retail_price, // Use retail price as default price
            retail_price: productForm.retail_price,
            wholesale_price: productForm.wholesale_price,
            stock: productForm.stock,
            min_stock: productForm.min_stock,
            sku: productForm.sku,
            brand: productForm.brand,
            bottle_size_ml: productForm.bottle_size_ml,
            unit: productForm.unit,
            quantity_per_unit: productForm.quantity_per_unit,
          })
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert([{
            name: productForm.name,
            description: productForm.description,
            barcode: productForm.barcode,
            cost_price: productForm.cost_price,
            price: productForm.retail_price, // Use retail price as default price
            retail_price: productForm.retail_price,
            wholesale_price: productForm.wholesale_price,
            stock: productForm.stock,
            min_stock: productForm.min_stock,
            sku: productForm.sku,
            brand: productForm.brand,
            bottle_size_ml: productForm.bottle_size_ml,
            unit: productForm.unit,
            quantity_per_unit: productForm.quantity_per_unit,
            department_id: selectedDepartmentId,
            tracking_type: "quantity" as const,
            is_active: true,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingProduct ? "Product updated" : "Product added");
      refetchShopProducts();
      setProductDialogOpen(false);
      resetProductForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save product");
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      refetchShopProducts();
    },
  });

  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      brand: "bottle",
      bottle_size_ml: 0,
      barcode: "",
      cost_price: 0,
      price: 0,
      retail_price: 0,
      wholesale_price: 0,
      stock: 0,
      min_stock: 10,
      sku: "",
      unit: "pieces",
      quantity_per_unit: 1,
    });
    setEditingProduct(null);
  };

  const openEditProduct = (product: PerfumeProduct) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      brand: product.brand || "bottle",
      bottle_size_ml: product.bottle_size_ml || 0,
      barcode: product.barcode || "",
      cost_price: product.cost_price || 0,
      price: product.price,
      retail_price: (product as any).retail_price || product.price || 0,
      wholesale_price: (product as any).wholesale_price || 0,
      stock: product.stock || 0,
      min_stock: product.min_stock || 10,
      sku: product.sku || "",
      unit: (product as any).unit || "pieces",
      quantity_per_unit: (product as any).quantity_per_unit || 1,
    });
    setProductDialogOpen(true);
  };

  const isOilPerfumeLowStock = totalScentStock < (masterPerfume?.min_stock || 1000);
  const lowStockProducts = shopProducts.filter(p => (p.stock || 0) <= (p.min_stock || 5));

  return (
    <div className="min-h-screen bg-background pt-32 lg:pt-20">
      <Navigation />
      <main className="container mx-auto p-4 md:p-6 space-y-6 mt-16">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Perfume Shop Management</h1>
          </div>
          
          {isAdmin && perfumeDepartments.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border">
              <Package className="w-4 h-4 text-muted-foreground" />
              <Select 
                value={selectedPerfumeDeptId || ""} 
                onValueChange={setSelectedPerfumeDeptId}
              >
                <SelectTrigger className="w-[200px] border-0 focus:ring-0 h-8">
                  <SelectValue>
                    {selectedDepartment?.name || "Select Perfume Dept"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {perfumeDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scent-stock" className="flex items-center gap-1">
              <Droplet className="w-4 h-4" />
              Scent Stock
            </TabsTrigger>
            <TabsTrigger value="oil-perfume" className="relative">
              Oil Settings
              {isOilPerfumeLowStock && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs">
                  Low
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shop-products">Shop Products</TabsTrigger>
          </TabsList>

          {/* Scent Stock Tab */}
          <TabsContent value="scent-stock" className="space-y-6">
            {selectedDepartmentId ? (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ScentStockManager departmentId={selectedDepartmentId} />
                </div>
                <div>
                  <StockReconciliation departmentId={selectedDepartmentId} />
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Droplet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Please select a perfume department</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Oil Perfume Tab */}
          <TabsContent value="oil-perfume" className="space-y-6">
            {!masterPerfume ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-semibold mb-2">Oil Perfume Master Product Not Found</h3>
                  <p className="text-muted-foreground mb-6">
                    Create the master Oil Perfume product to start managing perfume inventory and sales.
                  </p>
                  <Button 
                    onClick={() => createMasterPerfumeMutation.mutate()}
                    disabled={createMasterPerfumeMutation.isPending}
                    size="lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    {createMasterPerfumeMutation.isPending ? "Creating..." : "Create Oil Perfume Product"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {isOilPerfumeLowStock && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Low Stock Alert</AlertTitle>
                    <AlertDescription>
                      Oil perfume stock is below reorder level ({masterPerfume.min_stock?.toLocaleString() || 0} ml)
                    </AlertDescription>
                  </Alert>
                )}

                <Card className={cn(
                  "border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10",
                  isOilPerfumeLowStock && "border-destructive/50"
                )}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-2xl">
                        <Sparkles className="w-7 h-7 text-primary" />
                        Oil Perfume - Master Stock
                      </span>
                      {isOilPerfumeLowStock && (
                        <AlertCircle className="w-6 h-6 text-destructive" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Stock Level (Sum of All Scents)</span>
                        <span className="text-sm font-semibold">
                          {totalScentStock.toLocaleString()} / {masterPerfume.min_stock?.toLocaleString() || 0} ml
                        </span>
                      </div>
                      <Progress 
                        value={Math.min((totalScentStock / (masterPerfume.min_stock || 1000)) * 100, 100)} 
                        className={cn(
                          "h-3",
                          isOilPerfumeLowStock && "[&>div]:bg-destructive"
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        {isOilPerfumeLowStock ? "⚠️ Stock is below reorder level" : "✓ Stock is healthy"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">Total Stock (All Scents)</span>
                        <div className="text-4xl font-bold text-primary">
                          {totalScentStock.toLocaleString()} ml
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-sm text-muted-foreground">Reorder Level</span>
                        <div className="text-2xl font-semibold">
                          {masterPerfume.min_stock?.toLocaleString() || 0} ml
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                      <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">Cost Price</span>
                        <div className="text-lg font-semibold">
                          {masterPerfume.cost_price?.toLocaleString() || 0} UGX/ml
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">Retail Price</span>
                        <div className="text-lg font-semibold">
                          {(masterPerfume.retail_price_per_ml || masterPerfume.price)?.toLocaleString() || 0} UGX/ml
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-sm text-muted-foreground">Wholesale Price</span>
                        <div className="text-lg font-semibold">
                          {masterPerfume.wholesale_price_per_ml?.toLocaleString() || 0} UGX/ml
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground text-center">
                        Stock is managed through individual scents. Go to the <strong>Scents</strong> tab to add or update stock.
                      </p>
                    </div>

                    <div className="pt-4 flex gap-3 flex-wrap">
                      <Button 
                        onClick={() => setActiveTab("scents")}
                        className="flex-1"
                        size="lg"
                        variant={isOilPerfumeLowStock ? "default" : "outline"}
                      >
                        <Package className="w-5 h-5 mr-2" />
                        Manage Scent Stock
                      </Button>
                      <Button 
                        onClick={() => setPricingDialogOpen(true)}
                        className="flex-1"
                        size="lg"
                        variant="secondary"
                      >
                        <Edit className="w-5 h-5 mr-2" />
                        Configure Pricing
                      </Button>
                      <Button 
                        onClick={() => setBottleSizePricingDialogOpen(true)}
                        className="flex-1"
                        size="lg"
                        variant="outline"
                      >
                        <Package className="w-5 h-5 mr-2" />
                        Bottle Sizes & Prices
                      </Button>
                      <Button 
                        onClick={() => setBottleCostDialogOpen(true)}
                        className="flex-1"
                        size="lg"
                        variant="outline"
                      >
                        <Edit className="w-5 h-5 mr-2" />
                        Bottle Costs
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Shop Products Tab */}
          <TabsContent value="shop-products" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Manage all perfume shop products - body sprays, lotions, accessories, bottles, and more
              </p>
              <Button onClick={() => { resetProductForm(); setProductDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>

            {lowStockProducts.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Low Stock Items</AlertTitle>
                <AlertDescription>
                  {lowStockProducts.length} product(s) are running low on stock
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shopProducts.map((product) => (
                <Card key={product.id} className={cn(
                  (product.stock || 0) <= (product.min_stock || 5) && "border-destructive/50"
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        {product.bottle_size_ml && product.bottle_size_ml > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">{product.bottle_size_ml} ml</p>
                        )}
                        <Badge variant="secondary" className="mt-2 capitalize">
                          {product.brand || "other"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {product.description && (
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cost:</span>
                        <p className="font-semibold">{product.cost_price?.toLocaleString() || 0} UGX</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Selling Price:</span>
                        <p className="font-semibold">{product.price?.toLocaleString() || 0} UGX</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stock:</span>
                        <p className={cn(
                          "font-semibold",
                          (product.stock || 0) <= (product.min_stock || 5) && "text-destructive"
                        )}>
                          {product.stock || 0} {(product as any).unit || "pieces"}
                          {(product as any).quantity_per_unit > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({((product.stock || 0) * ((product as any).quantity_per_unit || 1)).toLocaleString()} total items)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => openEditProduct(product)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => {
                          if (confirm(`Delete ${product.name}?`)) {
                            deleteProductMutation.mutate(product.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {shopProducts.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No products yet. Add perfumes, body sprays, lotions, bottles, accessories, and more.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>


        {/* Pricing Dialog */}
        <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Oil Perfume Pricing</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Cost Price (per ml)</Label>
                <Input
                  type="number"
                  value={oilPerfumePricing.cost_price}
                  onChange={(e) => setOilPerfumePricing({...oilPerfumePricing, cost_price: Number(e.target.value)})}
                  placeholder="Cost price"
                />
              </div>
              <div>
                <Label>Retail Price (per ml)</Label>
                <Input
                  type="number"
                  value={oilPerfumePricing.retail_price_per_ml}
                  onChange={(e) => setOilPerfumePricing({...oilPerfumePricing, retail_price_per_ml: Number(e.target.value)})}
                  placeholder="Retail price"
                />
              </div>
              <div>
                <Label>Wholesale Price (per ml)</Label>
                <Input
                  type="number"
                  value={oilPerfumePricing.wholesale_price_per_ml}
                  onChange={(e) => setOilPerfumePricing({...oilPerfumePricing, wholesale_price_per_ml: Number(e.target.value)})}
                  placeholder="Wholesale price"
                />
              </div>
              <div>
                <Label>Reorder Level (ml)</Label>
                <Input
                  type="number"
                  value={oilPerfumePricing.min_stock}
                  onChange={(e) => setOilPerfumePricing({...oilPerfumePricing, min_stock: Number(e.target.value)})}
                  placeholder="Reorder level"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPricingDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => updatePricingMutation.mutate()}>Save Pricing</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Product Dialog */}
        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edit' : 'Add'} Shop Product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Product Name *</Label>
                  <Input
                    value={productForm.name}
                    onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                    placeholder="e.g., 50ml Round Bottle"
                  />
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={productForm.brand}
                    onValueChange={(value) => setProductForm({...productForm, brand: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="perfume">Branded Perfume</SelectItem>
                      <SelectItem value="body_spray">Body Spray</SelectItem>
                      <SelectItem value="body_lotion">Body Lotion</SelectItem>
                      <SelectItem value="roll_on">Roll-On</SelectItem>
                      <SelectItem value="air_freshener">Air Freshener</SelectItem>
                      <SelectItem value="diffuser">Diffuser / Oil Burner</SelectItem>
                      <SelectItem value="bottle">Empty Bottle</SelectItem>
                      <SelectItem value="tester">Tester / Sample</SelectItem>
                      <SelectItem value="gift_set">Gift Set</SelectItem>
                      <SelectItem value="bag">Bag / Pouch</SelectItem>
                      <SelectItem value="packaging">Packaging Material</SelectItem>
                      <SelectItem value="accessory">Accessory</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Size (ml)</Label>
                  <Input
                    type="number"
                    value={productForm.bottle_size_ml || ""}
                    onChange={(e) => setProductForm({...productForm, bottle_size_ml: Number(e.target.value)})}
                    placeholder="For bottles"
                  />
                </div>
                <div>
                  <Label>Cost Price (UGX) *</Label>
                  <Input
                    type="number"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({...productForm, cost_price: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>Retail Price (UGX) *</Label>
                  <Input
                    type="number"
                    value={productForm.retail_price || ""}
                    onChange={(e) => setProductForm({...productForm, retail_price: Number(e.target.value)})}
                    placeholder="Price for retail customers"
                  />
                </div>
                <div>
                  <Label>Wholesale Price (UGX) *</Label>
                  <Input
                    type="number"
                    value={productForm.wholesale_price || ""}
                    onChange={(e) => setProductForm({...productForm, wholesale_price: Number(e.target.value)})}
                    placeholder="Price for wholesale customers"
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={productForm.sku}
                    onChange={(e) => setProductForm({...productForm, sku: e.target.value})}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label>Barcode</Label>
                  <Input
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({...productForm, barcode: e.target.value})}
                    placeholder="For barcode scanning"
                  />
                </div>
                <div>
                  <Label>Unit Type *</Label>
                  <Select
                    value={productForm.unit}
                    onValueChange={(value) => setProductForm({...productForm, unit: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="dozen">Dozen (12)</SelectItem>
                      <SelectItem value="half_dozen">Half Dozen (6)</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="carton">Carton</SelectItem>
                      <SelectItem value="set">Set</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Qty per Unit</Label>
                  <Input
                    type="number"
                    value={productForm.quantity_per_unit}
                    onChange={(e) => setProductForm({...productForm, quantity_per_unit: Number(e.target.value)})}
                    placeholder="Items per unit"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {productForm.unit === "dozen" ? "12 items" : productForm.unit === "half_dozen" ? "6 items" : `${productForm.quantity_per_unit} items per ${productForm.unit}`}
                  </p>
                </div>
                <div>
                  <Label>Current Stock *</Label>
                  <Input
                    type="number"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({...productForm, stock: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>Reorder Level *</Label>
                  <Input
                    type="number"
                    value={productForm.min_stock}
                    onChange={(e) => setProductForm({...productForm, min_stock: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setProductDialogOpen(false); resetProductForm(); }}>
                Cancel
              </Button>
              <Button 
                onClick={() => saveProductMutation.mutate()}
                disabled={!productForm.name || productForm.cost_price < 0 || !productForm.retail_price || !productForm.wholesale_price}
              >
                {editingProduct ? 'Update' : 'Add'} Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bottle Size Pricing Dialog */}
        <Dialog open={bottleSizePricingDialogOpen} onOpenChange={setBottleSizePricingDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure Retail Bottle Size Pricing</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set the selling price for each bottle size for retail customers.
              </p>
              <div className="space-y-3">
                {bottleSizePricing.map((size, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div>
                          <Label className="text-sm text-muted-foreground">Bottle Size (ml)</Label>
                          <Input
                            type="number"
                            value={size.ml}
                            onChange={(e) => {
                              const updated = [...bottleSizePricing];
                              updated[index].ml = Number(e.target.value);
                              setBottleSizePricing(updated);
                            }}
                            placeholder="ml"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Selling Price (UGX)</Label>
                          <Input
                            type="number"
                            value={size.price}
                            onChange={(e) => {
                              const updated = [...bottleSizePricing];
                              updated[index].price = Number(e.target.value);
                              setBottleSizePricing(updated);
                            }}
                            placeholder="Price"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (bottleSizePricing.length > 1) {
                                setBottleSizePricing(bottleSizePricing.filter((_, i) => i !== index));
                              }
                            }}
                            disabled={bottleSizePricing.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setBottleSizePricing([...bottleSizePricing, { ml: 0, price: 0 }])}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bottle Size
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBottleSizePricingDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => updateBottleSizePricingMutation.mutate()}>
                Save Pricing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bottle Cost Configuration Dialog */}
        <Dialog open={bottleCostDialogOpen} onOpenChange={setBottleCostDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configure Bottle Costs for Retail Sales</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set the cost of bottles based on size ranges. These costs will be deducted from revenue.
              </p>
              <div className="space-y-3">
                {bottleCostRanges.map((range, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-4 gap-4 items-center">
                        <div>
                          <Label className="text-sm text-muted-foreground">Min Size (ml)</Label>
                          <Input
                            type="number"
                            value={range.min}
                            onChange={(e) => {
                              const updated = [...bottleCostRanges];
                              updated[index].min = Number(e.target.value);
                              setBottleCostRanges(updated);
                            }}
                            placeholder="Min ml"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Max Size (ml)</Label>
                          <Input
                            type="number"
                            value={range.max}
                            onChange={(e) => {
                              const updated = [...bottleCostRanges];
                              updated[index].max = Number(e.target.value);
                              setBottleCostRanges(updated);
                            }}
                            placeholder="Max ml"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Bottle Cost (UGX)</Label>
                          <Input
                            type="number"
                            value={range.cost}
                            onChange={(e) => {
                              const updated = [...bottleCostRanges];
                              updated[index].cost = Number(e.target.value);
                              setBottleCostRanges(updated);
                            }}
                            placeholder="Cost"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (bottleCostRanges.length > 1) {
                                setBottleCostRanges(bottleCostRanges.filter((_, i) => i !== index));
                              }
                            }}
                            disabled={bottleCostRanges.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setBottleCostRanges([...bottleCostRanges, { min: 0, max: 0, cost: 0 }])}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Cost Range
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBottleCostDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => updateBottleCostMutation.mutate()}>
                Save Bottle Costs
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
