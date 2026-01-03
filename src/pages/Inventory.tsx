import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DepartmentSelector } from "@/components/DepartmentSelector";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartment } from "@/contexts/DepartmentContext";
import { ProductFormDialog } from "@/components/inventory/ProductFormDialog";
import { ProductList } from "@/components/inventory/ProductList";
import { LowStockAlerts } from "@/components/inventory/LowStockAlerts";

const Inventory = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { selectedDepartmentId, selectedDepartment, setSelectedDepartmentId } = useDepartment();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    category_id: "",
    department_id: "",
    brand: "",
    unit: "",
    quantity_per_unit: 1,
    current_stock: 0,
    reorder_level: 10,
    cost_price: 0,
    selling_price: 0,
    is_bundle: false,
    tracking_type: "quantity",
    volume_unit: "",
    allow_custom_price: false,
    min_price: 0,
    max_price: 0,
    supplier_id: "",
    pricing_tiers: {
      retail: 0,
      wholesale: 0,
      individual: 0,
    },
    bottle_size_ml: 0,
    total_ml: 0,
    cost_per_ml: 0,
    wholesale_price_per_ml: 0,
    retail_price_per_ml: 0,
    imei: "",
    serial_number: "",
  });

  // Prevent adding perfume products from regular inventory
  useEffect(() => {
    if (isDialogOpen && !editingProduct) {
      setFormData(prev => ({
        ...prev,
        tracking_type: "quantity", // Always quantity for regular inventory
      }));
    }
  }, [isDialogOpen, editingProduct]);

  const { data: products } = useQuery({
    queryKey: ["products", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('department_id', selectedDepartmentId)
        .neq('tracking_type', 'ml')
        .order('name');
      if (error) throw error;
      return (data || []).filter((p: any) => !p.is_archived);
    },
    enabled: !!selectedDepartmentId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const addStockMutation = useMutation({
    mutationFn: async ({ productId, stockToAdd }: { productId: string; stockToAdd: number }) => {
      const product = products?.find((p: any) => p.id === productId);
      if (!product) throw new Error("Product not found");
      
      const { error } = await supabase
        .from('products')
        .update({ stock: (product.stock || 0) + stockToAdd })
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock added successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to add stock: ${error.message}`);
    },
  });

  const archiveProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .update({ is_archived: true })
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product archived successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to archive product: ${error.message}`);
    },
  });

  const saveProductMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Convert empty strings to null for UUID fields
      const { reorder_level, current_stock, selling_price, tracking_type, ...rest } = data;
      const dataToSave: any = { 
        ...rest,
        stock: current_stock,
        min_stock: reorder_level,
        price: selling_price,
        // Always use 'quantity' for regular inventory (not 'unit' which is invalid enum value)
        tracking_type: 'quantity',
      };
      // Ensure UUID fields are null, not empty strings
      dataToSave.category_id = dataToSave.category_id && dataToSave.category_id.length > 0 ? dataToSave.category_id : null;
      dataToSave.department_id = dataToSave.department_id && dataToSave.department_id.length > 0 ? dataToSave.department_id : null;
      dataToSave.supplier_id = dataToSave.supplier_id && dataToSave.supplier_id.length > 0 ? dataToSave.supplier_id : null;
      dataToSave.barcode = dataToSave.barcode && dataToSave.barcode.length > 0 ? dataToSave.barcode : null;
      dataToSave.brand = dataToSave.brand && dataToSave.brand.length > 0 ? dataToSave.brand : null;
      
      // Require department_id for new products
      if (!editingProduct && !dataToSave.department_id) {
        throw new Error("Please select a department before adding a product");
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(dataToSave)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(editingProduct ? "Product updated" : "Product added");
      
      setIsDialogOpen(false);
      setEditingProduct(null);
      setFormData({
        name: "",
        barcode: "",
        category_id: "",
        department_id: "",
        brand: "",
        unit: "",
        quantity_per_unit: 1,
        current_stock: 0,
        reorder_level: 10,
        cost_price: 0,
        selling_price: 0,
        is_bundle: false,
        tracking_type: "quantity",
        volume_unit: "",
        allow_custom_price: false,
        min_price: 0,
        max_price: 0,
        supplier_id: "",
        pricing_tiers: {
          retail: 0,
          wholesale: 0,
          individual: 0,
        },
        bottle_size_ml: 0,
        total_ml: 0,
        cost_per_ml: 0,
        wholesale_price_per_ml: 0,
        retail_price_per_ml: 0,
        imei: "",
        serial_number: "",
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      console.error("Product save error:", error);
      toast.error(`Failed to save product: ${error.message || 'Unknown error'}`);
    },
  });

  const handleEdit = (product: any) => {
    if (!isAdmin) {
      toast.error("Only admins can edit products");
      return;
    }
    
    setEditingProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode || "",
      category_id: product.category_id || "",
      department_id: product.department_id || "",
      brand: product.brand || "",
      unit: product.unit,
      quantity_per_unit: product.quantity_per_unit,
      current_stock: product.stock || product.current_stock,
      reorder_level: product.min_stock || product.reorder_level,
      cost_price: product.cost_price,
      selling_price: product.price || product.selling_price,
      is_bundle: product.is_bundle || false,
      tracking_type: product.tracking_type || "quantity",
      volume_unit: product.volume_unit || "",
      allow_custom_price: product.allow_custom_price || false,
      min_price: product.min_price || 0,
      max_price: product.max_price || 0,
      supplier_id: product.supplier_id || "",
      pricing_tiers: product.pricing_tiers || {
        retail: 0,
        wholesale: 0,
        individual: 0,
      },
      bottle_size_ml: product.bottle_size_ml || 0,
      total_ml: product.total_ml || 0,
      cost_per_ml: product.cost_per_ml || 0,
      wholesale_price_per_ml: product.wholesale_price_per_ml || 0,
      retail_price_per_ml: product.retail_price_per_ml || 0,
      imei: product.imei || "",
      serial_number: product.serial_number || "",
    });
    setIsDialogOpen(true);
  };

  // Check if current department is a perfume department
  const isPerfumeDept = selectedDepartment?.name?.toLowerCase().includes('perfume');

  if (isPerfumeDept) {
    return (
      <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Perfume Department</h2>
            <p className="text-muted-foreground mb-6">
              Regular inventory is not available for perfume departments.
              <br />
              Please use the dedicated Perfume Inventory page to manage perfume products.
            </p>
            <Button onClick={() => window.location.href = '/perfume-inventory'}>
              Go to Perfume Inventory
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 pt-24 pb-8">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold">
              {selectedDepartment?.name || "Inventory"}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage regular products, bundles, and stock levels (Non-perfume products only)
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {isAdmin && <DepartmentSelector />}
            
            <Button
              onClick={() => {
                if (!selectedDepartmentId) {
                  toast.error("Please select a department first");
                  return;
                }
                setEditingProduct(null);
                setFormData({
                  name: "",
                  barcode: "",
                  category_id: "",
                  department_id: selectedDepartmentId,
                  brand: "",
                  unit: "",
                  quantity_per_unit: 1,
                  current_stock: 0,
                  reorder_level: 10,
                  cost_price: 0,
                  selling_price: 0,
                  is_bundle: false,
                  tracking_type: "quantity",
                  volume_unit: "",
                  allow_custom_price: false,
                  min_price: 0,
                  max_price: 0,
                  supplier_id: "",
                  pricing_tiers: {
                    retail: 0,
                    wholesale: 0,
                    individual: 0,
                  },
                  bottle_size_ml: 0,
                  total_ml: 0,
                  cost_per_ml: 0,
                  wholesale_price_per_ml: 0,
                  retail_price_per_ml: 0,
                  imei: "",
                  serial_number: "",
                });
                setIsDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by product name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <ProductList 
              products={(products || []).filter((product: any) => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                  product.name?.toLowerCase().includes(query) ||
                  product.barcode?.toLowerCase().includes(query) ||
                  product.internal_barcode?.toLowerCase().includes(query)
                );
              })} 
              onEdit={handleEdit} 
              onAddStock={(productId, quantity) => addStockMutation.mutate({ productId, stockToAdd: quantity })}
              onArchive={(productId) => archiveProductMutation.mutate(productId)}
              isAdmin={isAdmin} 
            />
          </div>
          <div>
            <LowStockAlerts />
          </div>
        </div>
      </main>

      <ProductFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSave={() => saveProductMutation.mutate(formData)}
        editingProduct={editingProduct}
        categories={categories || []}
        departments={departments}
        suppliers={suppliers || []}
        isAdmin={isAdmin}
        isPerfumeDepartment={false}
      />
    </div>
  );
};

export default Inventory;