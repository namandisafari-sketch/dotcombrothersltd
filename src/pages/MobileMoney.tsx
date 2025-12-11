import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash, ShoppingCart, AlertTriangle, TrendingUp, Package } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { printReceipt } from "@/utils/receiptPrinter";
import { ReceiptActionsDialog } from "@/components/ReceiptActionsDialog";
import { MobileMoneyDialog } from "@/components/pos/MobileMoneyDialog";
import { reduceStock, checkStockAvailability } from "@/utils/stockManagement";
import { CustomerRegistration } from "@/components/mobilemoney/CustomerRegistrationNew";
import { MobileMoneyHistory } from "@/components/mobilemoney/MobileMoneyHistoryNew";
import { SimCardSettings } from "@/components/mobilemoney/SimCardSettingsNew";
import { DataPackages } from "@/components/mobilemoney/DataPackages";
import { DataPackageAnalytics } from "@/components/mobilemoney/DataPackageAnalytics";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MobileMoney = () => {
  const queryClient = useQueryClient();
  
  // Fetch current user's profile for cashier name using Supabase
  const { data: userProfile } = useQuery({
    queryKey: ["current-user-profile-supabase"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const cashierName = userProfile?.full_name || "Cashier";
  
  const [serviceForm, setServiceForm] = useState({
    service_name: "",
    service_price: 0,
    description: "",
  });

  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  
  const [productForm, setProductForm] = useState({
    name: "",
    unit: "",
    cost_price: 0,
    selling_price: 0,
    current_stock: 0,
    reorder_level: 10,
    barcode: "",
    imei: "",
    serial_number: "",
    allow_custom_price: true,
    min_price: 0,
    max_price: 0,
  });
  
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [posCart, setPosCart] = useState<Array<{ item: any; itemType: 'service' | 'product' | 'data_package'; quantity: number; customPrice?: number }>>([]);
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [currentReceiptData, setCurrentReceiptData] = useState<any>(null);
  const [showMobileMoneyDialog, setShowMobileMoneyDialog] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [customPriceDialog, setCustomPriceDialog] = useState<{ open: boolean; index: number; currentPrice: number }>({ open: false, index: -1, currentPrice: 0 });
  const [customPriceValue, setCustomPriceValue] = useState("");

  // Get user's role and department using Supabase
  const { data: userDepartment } = useQuery({
    queryKey: ["user-department-supabase"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { departmentId: null, isAdmin: false };
      
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role, department_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      return {
        departmentId: userRole?.department_id || null,
        isAdmin: userRole?.role === "admin"
      };
    },
  });

  // Get all mobile money departments using Supabase
  const { data: mobileMoneyDepts } = useQuery({
    queryKey: ["mobile-money-departments-supabase", userDepartment?.departmentId, userDepartment?.isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("departments")
        .select("*")
        .eq("is_mobile_money", true)
        .eq("is_active", true);
      
      // Non-admin users can only see their own department
      if (!userDepartment?.isAdmin && userDepartment?.departmentId) {
        query = query.eq("id", userDepartment.departmentId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: userDepartment !== undefined,
  });

  // Selected department state
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");

  // Set default department when departments load
  useEffect(() => {
    if (mobileMoneyDepts && mobileMoneyDepts.length > 0 && !selectedDeptId) {
      setSelectedDeptId(mobileMoneyDepts[0].id);
    }
  }, [mobileMoneyDepts, selectedDeptId]);

  const mobileMoneyDept = mobileMoneyDepts?.find(d => d.id === selectedDeptId);

  // Fetch department settings for receipt using Supabase
  const { data: deptSettings } = useQuery({
    queryKey: ["department-settings-supabase", selectedDeptId],
    queryFn: async () => {
      if (!selectedDeptId) return null;
      
      // Try department-specific settings first
      const { data: deptSpecific } = await supabase
        .from("settings")
        .select("*")
        .eq("department_id", selectedDeptId)
        .maybeSingle();
      
      if (deptSpecific) return deptSpecific;
      
      // Fallback to global settings
      const { data: globalSettings } = await supabase
        .from("settings")
        .select("*")
        .is("department_id", null)
        .maybeSingle();
      
      return globalSettings;
    },
    enabled: !!selectedDeptId,
  });

  // Fetch services for selected department using Supabase
  const { data: services } = useQuery({
    queryKey: ["mobile-money-services-supabase", selectedDeptId],
    queryFn: async () => {
      if (!selectedDeptId) return [];
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("department_id", selectedDeptId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDeptId,
  });

  // Fetch products for selected department using Supabase
  const { data: products } = useQuery({
    queryKey: ["mobile-money-products-supabase", selectedDeptId],
    queryFn: async () => {
      if (!selectedDeptId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("department_id", selectedDeptId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDeptId,
  });

  // Fetch sales data for reports using Supabase
  const { data: salesData } = useQuery({
    queryKey: ["mobile-money-sales-supabase", selectedDeptId],
    queryFn: async () => {
      if (!selectedDeptId) return [];
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*)")
        .eq("department_id", selectedDeptId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDeptId,
  });

  // Fetch credits for reports using Supabase
  const { data: creditsData } = useQuery({
    queryKey: ["mobile-money-credits-supabase", selectedDeptId],
    queryFn: async () => {
      if (!selectedDeptId) return [];
      const { data, error } = await supabase
        .from("credits")
        .select("*")
        .eq("department_id", selectedDeptId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDeptId,
  });

  // Fetch data packages for selected department
  const { data: dataPackages } = useQuery({
    queryKey: ["mobile-money-data-packages-supabase", selectedDeptId],
    queryFn: async () => {
      if (!selectedDeptId) return [];
      const { data, error } = await supabase
        .from("data_packages")
        .select("*")
        .eq("department_id", selectedDeptId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDeptId,
  });

  // Create/Update service mutation using Supabase
  const serviceMutation = useMutation({
    mutationFn: async (service: any) => {
      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update({
            name: service.service_name,
            base_price: service.service_price,
            price: service.service_price,
            description: service.description,
          })
          .eq("id", editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("services")
          .insert({
            name: service.service_name,
            base_price: service.service_price,
            price: service.service_price,
            description: service.description,
            department_id: selectedDeptId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-money-services-supabase"] });
      toast.success(editingService ? "Service updated" : "Service created");
      setServiceDialogOpen(false);
      setServiceForm({ service_name: "", service_price: 0, description: "" });
      setEditingService(null);
    },
    onError: (error) => {
      toast.error("Failed to save service");
      console.error(error);
    },
  });

  // Delete service mutation using Supabase
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-money-services-supabase"] });
      toast.success("Service deleted");
    },
    onError: () => {
      toast.error("Failed to delete service");
    },
  });

  // Product mutation using Supabase
  const productMutation = useMutation({
    mutationFn: async (product: any) => {
      const cleanedProduct = {
        name: product.name,
        unit: product.unit,
        cost_price: product.cost_price,
        selling_price: product.selling_price,
        price: product.selling_price,
        stock: product.current_stock,
        min_stock: product.reorder_level,
        barcode: product.barcode?.trim() || null,
        imei: product.imei?.trim() || null,
        serial_number: product.serial_number?.trim() || null,
        allow_custom_price: product.allow_custom_price,
        min_price: product.min_price || null,
        max_price: product.max_price || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(cleanedProduct)
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .insert({
            ...cleanedProduct,
            department_id: selectedDeptId,
            tracking_type: "quantity",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-money-products-supabase"] });
      toast.success(editingProduct ? "Product updated" : "Product added");
      setProductDialogOpen(false);
      setProductForm({ name: "", unit: "", cost_price: 0, selling_price: 0, current_stock: 0, reorder_level: 10, barcode: "", imei: "", serial_number: "", allow_custom_price: true, min_price: 0, max_price: 0 });
      setEditingProduct(null);
    },
    onError: (error: any) => {
      console.error(error);
      if (error?.code === '23505') {
        if (error?.message?.includes('imei')) {
          toast.error("This IMEI already exists in this department. Please use a different IMEI.");
        } else if (error?.message?.includes('barcode')) {
          toast.error("This barcode already exists in this department. Please use a different barcode.");
        } else if (error?.message?.includes('serial')) {
          toast.error("This serial number already exists in this department. Please use a different serial number.");
        } else {
          toast.error("A product with these details already exists.");
        }
      } else {
        toast.error("Failed to save product");
      }
    },
  });

  // Delete product mutation using Supabase
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-money-products-supabase"] });
      toast.success("Product deleted");
    },
    onError: () => {
      toast.error("Failed to delete product");
    },
  });

  // Process POS sale using Supabase
  const processSale = async () => {
    if (posCart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    try {
      // Check stock availability for all products
      for (const cartItem of posCart) {
        if (cartItem.itemType === 'product') {
          const stockCheck = await checkStockAvailability(
            cartItem.item.id,
            cartItem.quantity
          );
          
          if (!stockCheck.available) {
            toast.error(stockCheck.message || "Insufficient stock for " + cartItem.item.name);
            return;
          }
        }
      }

      const total = posCart.reduce((sum, item) => {
        const price = item.customPrice || (item.itemType === 'service' 
          ? item.item.base_price 
          : item.itemType === 'data_package'
          ? item.item.price
          : item.item.selling_price || item.item.price || 0);
        return sum + (price * item.quantity);
      }, 0);

      // Generate receipt number using Supabase function
      const { data: receiptNumber, error: rcpError } = await supabase.rpc('generate_receipt_number');
      const finalReceiptNumber = rcpError ? `RCP${Date.now()}` : receiptNumber;

      // Create sale record
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          department_id: selectedDeptId,
          subtotal: total,
          total: total,
          amount_paid: total,
          payment_method: paymentMethod as "cash" | "card" | "mobile_money" | "credit",
          receipt_number: finalReceiptNumber,
          sale_number: finalReceiptNumber,
          customer_id: null,
          cashier_name: cashierName,
          remarks: posCustomerPhone || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      const saleItems = posCart.map(cartItem => {
        const unitPrice = cartItem.customPrice || (cartItem.itemType === 'service' 
          ? cartItem.item.base_price 
          : cartItem.itemType === 'data_package'
          ? cartItem.item.price
          : cartItem.item.selling_price || cartItem.item.price);
        
        return {
          sale_id: sale.id,
          name: cartItem.item.name,
          item_name: cartItem.item.name,
          service_id: cartItem.itemType === 'service' ? cartItem.item.id : null,
          product_id: cartItem.itemType === 'product' ? cartItem.item.id : null,
          quantity: cartItem.quantity,
          unit_price: unitPrice,
          total: unitPrice * cartItem.quantity,
        };
      });

      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) console.error("Failed to insert sale items:", itemsError);

      // Prepare stock reduction for products
      const cartForStock: any[] = posCart
        .filter(cartItem => cartItem.itemType === 'product')
        .map(cartItem => ({
          id: cartItem.item.id,
          productId: cartItem.item.id,
          name: cartItem.item.name,
          quantity: cartItem.quantity,
          trackingType: cartItem.item.tracking_type || 'unit',
        }));

      // Reduce stock from main products table
      if (cartForStock.length > 0) {
        const stockResult = await reduceStock(cartForStock, selectedDeptId || "");
        if (!stockResult.success) {
          toast.warning("Sale completed but stock reduction failed: " + stockResult.error);
        }
      }

      // Prepare receipt data matching receiptPrinter interface
      const receiptData = {
        receiptNumber: finalReceiptNumber,
        items: posCart.map(item => {
          const price = item.customPrice || (item.itemType === 'service' 
            ? item.item.base_price 
            : item.itemType === 'data_package'
            ? item.item.price
            : item.item.selling_price || item.item.price);
          return {
            name: item.item.name,
            quantity: item.quantity,
            price: price,
            subtotal: price * item.quantity,
          };
        }),
        subtotal: total,
        tax: 0,
        total: total,
        paymentMethod: paymentMethod,
        date: new Date().toISOString(),
        departmentName: mobileMoneyDept?.name || "Mobile Money",
        customerPhone: posCustomerPhone || undefined,
        businessInfo: {
          name: deptSettings?.business_name || mobileMoneyDept?.name || "Mobile Money",
          address: deptSettings?.business_address || "Kasangati opp Kasangati Police Station",
          phone: deptSettings?.business_phone || "+256745368426",
          email: deptSettings?.business_email || undefined,
          logo: (deptSettings as any)?.receipt_logo_url || deptSettings?.logo_url || undefined,
          whatsapp: deptSettings?.whatsapp_number || "+256745368426",
          website: deptSettings?.website || undefined,
        },
        seasonalRemark: deptSettings?.seasonal_remark || undefined,
        showBackPage: (deptSettings as any)?.show_back_page !== false,
      };

      // Handle mobile money payment
      if (paymentMethod === "mobile_money") {
        setCompletedSaleId(sale.id);
        setCurrentReceiptData(receiptData);
        setShowMobileMoneyDialog(true);
      } else {
        // Show receipt dialog for other payment methods
        setCurrentReceiptData(receiptData);
        setShowReceiptDialog(true);
      }

      toast.success("Sale completed successfully");
      setPosCart([]);
      setPosCustomerPhone("");
      setPaymentMethod("cash");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error) {
      console.error("Sale error:", error);
      toast.error("Failed to process sale");
    }
  };

  const handleEditService = (service: any) => {
    setEditingService(service);
    setServiceForm({
      service_name: service.name,
      service_price: service.base_price,
      description: service.description || "",
    });
    setServiceDialogOpen(true);
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      unit: product.unit,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      current_stock: product.stock ?? product.current_stock ?? 0,
      reorder_level: product.min_stock ?? product.reorder_level ?? 10,
      barcode: product.barcode || "",
      imei: product.imei || "",
      serial_number: product.serial_number || "",
      allow_custom_price: product.allow_custom_price ?? true,
      min_price: product.min_price || 0,
      max_price: product.max_price || 0,
    });
    setProductDialogOpen(true);
  };

  const addToCart = async (item: any, type: 'service' | 'product' | 'data_package') => {
    if (type === 'product') {
      const stockValue = item.stock ?? item.current_stock ?? 0;
      if (stockValue <= 0) {
        toast.error("Product out of stock");
        return;
      }

      // Check main inventory stock
      const stockCheck = await checkStockAvailability(item.id, 1);
      if (!stockCheck.available) {
        toast.error(stockCheck.message || "Insufficient stock");
        return;
      }
    }

    const existingIndex = posCart.findIndex(
      (cartItem) => cartItem.item.id === item.id && cartItem.itemType === type
    );

    if (existingIndex >= 0) {
      const newCart = [...posCart];
      const stockValue = item.stock ?? item.current_stock ?? 999;
      const maxQty = type === 'product' ? stockValue : 999;
      
      if (newCart[existingIndex].quantity < maxQty) {
        newCart[existingIndex].quantity += 1;
        setPosCart(newCart);
        toast.success("Quantity increased");
      } else {
        toast.error("Maximum quantity reached");
      }
    } else {
      setPosCart([...posCart, { item, itemType: type, quantity: 1 }]);
      const typeLabel = type === 'service' ? 'Service' : type === 'product' ? 'Product' : 'Data Package';
      toast.success(`${typeLabel} added to cart`);
    }
  };

  const removeFromCart = (index: number) => {
    setPosCart(posCart.filter((_, i) => i !== index));
    toast.success("Item removed from cart");
  };

  const updateCartQuantity = (index: number, newQuantity: number) => {
    const item = posCart[index];
    const stockValue = item.item.stock ?? item.item.current_stock ?? 999;
    const maxQty = item.itemType === 'product' ? stockValue : 999;

    if (newQuantity < 1 || newQuantity > maxQty) {
      toast.error(`Quantity must be between 1 and ${maxQty}`);
      return;
    }

    const newCart = [...posCart];
    newCart[index].quantity = newQuantity;
    setPosCart(newCart);
  };

  const cartTotal = posCart.reduce((sum, item) => {
    const price = item.customPrice || (item.itemType === 'service' 
      ? item.item.base_price 
      : item.itemType === 'data_package'
      ? item.item.price
      : item.item.selling_price);
    return sum + (price * item.quantity);
  }, 0);

  // Barcode scanning handler
  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;
    
    const product = products?.find(p => 
      p.barcode?.toLowerCase() === barcodeInput.toLowerCase() ||
      p.internal_barcode?.toLowerCase() === barcodeInput.toLowerCase()
    );

    if (product) {
      await addToCart(product, 'product');
      setBarcodeInput("");
      toast.success(`${product.name} added to cart`);
    } else {
      toast.error("Product not found with this barcode");
    }
  };

  // Custom price handler
  const handleSetCustomPrice = (index: number) => {
    const item = posCart[index];
    const currentPrice = item.customPrice || (item.itemType === 'service' ? item.item.base_price : item.item.selling_price);
    setCustomPriceDialog({ open: true, index, currentPrice });
    setCustomPriceValue(currentPrice.toString());
  };

  const applyCustomPrice = () => {
    const price = parseFloat(customPriceValue);
    const item = posCart[customPriceDialog.index];
    
    if (isNaN(price) || price <= 0) {
      toast.error("Invalid price");
      return;
    }

    // Check min/max for products with custom pricing enabled
    if (item.itemType === 'product' && item.item.allow_custom_price) {
      if (item.item.min_price && price < item.item.min_price) {
        toast.error(`Price cannot be less than UGX ${item.item.min_price.toLocaleString()}`);
        return;
      }
      if (item.item.max_price && price > item.item.max_price) {
        toast.error(`Price cannot be more than UGX ${item.item.max_price.toLocaleString()}`);
        return;
      }
    }

    // Check for services with is_negotiable
    if (item.itemType === 'service' && !item.item.is_negotiable) {
      toast.error("This service price is not negotiable");
      return;
    }

    const newCart = [...posCart];
    newCart[customPriceDialog.index].customPrice = price;
    setPosCart(newCart);
    setCustomPriceDialog({ open: false, index: -1, currentPrice: 0 });
    setCustomPriceValue("");
    toast.success("Custom price applied");
  };

  // Show message if no mobile money department exists
  if (!mobileMoneyDepts || mobileMoneyDepts.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No Mobile Money Department</h2>
              <p className="text-muted-foreground">
                No mobile money department has been set up yet. Please contact an administrator to create one.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Mobile Money Department</h1>
          {mobileMoneyDepts && mobileMoneyDepts.length > 1 && (
            <div className="w-full sm:w-64">
              <Label>Select Department</Label>
              <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose department" />
                </SelectTrigger>
                <SelectContent>
                  {mobileMoneyDepts.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Tabs defaultValue="pos" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="pos">Point of Sale</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="data-packages">Data Packages</TabsTrigger>
            <TabsTrigger value="registrations">Customer Registration</TabsTrigger>
            <TabsTrigger value="history">Sales History</TabsTrigger>
            <TabsTrigger value="reports">Daily Reports</TabsTrigger>
            <TabsTrigger value="card-settings">Card Settings</TabsTrigger>
          </TabsList>

          {/* POS Tab */}
          <TabsContent value="pos" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Available Services */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Available Services & Products</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Services</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {services?.map((service: any) => (
                        <Button
                          key={service.id}
                          variant="outline"
                          className="h-auto py-4 flex flex-col items-start"
                          onClick={() => addToCart(service, 'service')}
                        >
                          <span className="font-semibold">{service.name}</span>
                          <span className="text-sm text-muted-foreground">
                            UGX {service.base_price?.toLocaleString()}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Products</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {products?.map((product: any) => {
                        const stockValue = product.stock ?? product.current_stock ?? 0;
                        const isOutOfStock = stockValue <= 0;
                        const isLowStock = stockValue > 0 && stockValue <= (product.min_stock ?? product.reorder_level ?? 10);
                        
                        return (
                          <Button
                            key={product.id}
                            variant="outline"
                            className="h-auto py-4 flex flex-col items-start"
                            onClick={() => addToCart(product, 'product')}
                            disabled={isOutOfStock}
                          >
                            <span className="font-semibold">{product.name}</span>
                            <span className="text-sm text-muted-foreground">
                              UGX {product.selling_price?.toLocaleString()}
                            </span>
                            <div className="flex gap-1 mt-1">
                              <Badge variant={isOutOfStock ? "destructive" : isLowStock ? "secondary" : "default"} className="text-xs">
                                {isOutOfStock ? "Out of Stock" : `Stock: ${stockValue}`}
                              </Badge>
                              {isLowStock && !isOutOfStock && (
                                <Badge variant="secondary" className="text-xs">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Low
                                </Badge>
                              )}
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Data Packages */}
                  <div>
                    <h3 className="font-semibold mb-3">Data Packages</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {dataPackages?.map((pkg: any) => (
                        <Button
                          key={pkg.id}
                          variant="outline"
                          className="h-auto py-4 flex flex-col items-start"
                          onClick={() => addToCart(pkg, 'data_package')}
                        >
                          <span className="font-semibold">{pkg.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {pkg.data_amount}{pkg.data_unit}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            UGX {pkg.price?.toLocaleString()}
                          </span>
                        </Button>
                      ))}
                      {(!dataPackages || dataPackages.length === 0) && (
                        <p className="text-sm text-muted-foreground col-span-3">
                          No data packages available. Add them in the Data Packages tab.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Cart
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Barcode Scanner</Label>
                    <div className="flex gap-2">
                      <Input
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSearch()}
                        placeholder="Scan or enter barcode"
                      />
                      <Button onClick={handleBarcodeSearch} size="sm">
                        Search
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Customer Phone (Optional)</Label>
                    <Input
                      value={posCustomerPhone}
                      onChange={(e) => setPosCustomerPhone(e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    {posCart.map((item, index) => {
                      const basePrice = item.itemType === 'service' 
                        ? item.item.base_price 
                        : item.itemType === 'data_package' 
                        ? item.item.price 
                        : item.item.selling_price || item.item.price;
                      const displayPrice = item.customPrice || basePrice;
                      const canCustomize = true; // Allow custom prices for all mobile money services and products
                      
                      return (
                        <div key={index} className="p-3 border rounded-lg space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold">
                                {item.item.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.itemType === 'service' ? 'Service' : item.itemType === 'product' ? 'Product' : 'Data Package'}
                                {item.customPrice && <span className="text-primary ml-2">(Custom Price)</span>}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {canCustomize && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSetCustomPrice(index)}
                                  title="Set custom price"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromCart(index)}
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              max={item.itemType === 'product' ? (item.item.stock ?? item.item.current_stock ?? 999) : 999}
                              value={item.quantity}
                              onChange={(e) => updateCartQuantity(index, parseInt(e.target.value) || 1)}
                              className="w-20"
                            />
                            <span className="text-sm">×</span>
                            <span className="text-sm font-medium">
                              UGX {displayPrice.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-right font-semibold">
                            UGX {(displayPrice * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {posCart.length > 0 && (
                    <>
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total:</span>
                          <span>UGX {cartTotal.toLocaleString()}</span>
                        </div>
                      </div>
                      <Button
                        onClick={processSale}
                        className="w-full"
                        size="lg"
                      >
                        Complete Sale
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Services</CardTitle>
                <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingService(null);
                      setServiceForm({ service_name: "", service_price: 0, description: "" });
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Service Name</Label>
                        <Input
                          value={serviceForm.service_name}
                          onChange={(e) => setServiceForm({ ...serviceForm, service_name: e.target.value })}
                          placeholder="e.g., Hair Cut, Manicure"
                        />
                      </div>
                      <div>
                        <Label>Service Price (UGX)</Label>
                        <Input
                          type="number"
                          value={serviceForm.service_price}
                          onChange={(e) => setServiceForm({ ...serviceForm, service_price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={serviceForm.description}
                          onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                          placeholder="Service description..."
                        />
                      </div>
                      <Button
                        onClick={() => serviceMutation.mutate(serviceForm)}
                        disabled={!serviceForm.service_name || serviceForm.service_price <= 0}
                        className="w-full"
                      >
                        {editingService ? "Update" : "Create"} Service
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {services?.map((service: any) => (
                    <div key={service.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                        <p className="text-sm font-medium mt-1">
                          UGX {service.base_price?.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditService(service)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteServiceMutation.mutate(service.id)}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!services || services.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No services found. Add one to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Products</CardTitle>
                <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingProduct(null);
                      setProductForm({ name: "", unit: "", cost_price: 0, selling_price: 0, current_stock: 0, reorder_level: 10, barcode: "", imei: "", serial_number: "", allow_custom_price: true, min_price: 0, max_price: 0 });
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Product Name</Label>
                        <Input
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          placeholder="e.g., Airtime Bundle"
                        />
                      </div>
                      <div>
                        <Label>Unit</Label>
                        <Select
                          value={productForm.unit}
                          onValueChange={(value) => setProductForm({ ...productForm, unit: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="piece">Piece</SelectItem>
                            <SelectItem value="bundle">Bundle</SelectItem>
                            <SelectItem value="unit">Unit</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Barcode</Label>
                        <Input
                          value={productForm.barcode}
                          onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                          placeholder="Scan or enter barcode"
                        />
                      </div>
                      <div>
                        <Label>IMEI Number</Label>
                        <Input
                          value={productForm.imei}
                          onChange={(e) => setProductForm({ ...productForm, imei: e.target.value })}
                          placeholder="For phones only (optional)"
                        />
                      </div>
                      <div>
                        <Label>Serial Number</Label>
                        <Input
                          value={productForm.serial_number}
                          onChange={(e) => setProductForm({ ...productForm, serial_number: e.target.value })}
                          placeholder="For tracking (optional)"
                        />
                      </div>
                      <div>
                        <Label>Cost Price</Label>
                        <Input
                          type="number"
                          value={productForm.cost_price}
                          onChange={(e) => setProductForm({ ...productForm, cost_price: parseFloat(e.target.value) || 0 })}
                          placeholder="Cost per unit"
                        />
                      </div>
                      <div>
                        <Label>Selling Price</Label>
                        <Input
                          type="number"
                          value={productForm.selling_price}
                          onChange={(e) => setProductForm({ ...productForm, selling_price: parseFloat(e.target.value) || 0 })}
                          placeholder="Selling price per unit"
                        />
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg">
                        <input
                          type="checkbox"
                          id="allow_custom_price"
                          checked={productForm.allow_custom_price}
                          onChange={(e) => setProductForm({ ...productForm, allow_custom_price: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="allow_custom_price" className="cursor-pointer">Allow Custom Price</Label>
                      </div>
                      {productForm.allow_custom_price && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Min Price</Label>
                            <Input
                              type="number"
                              value={productForm.min_price}
                              onChange={(e) => setProductForm({ ...productForm, min_price: parseFloat(e.target.value) || 0 })}
                              placeholder="Minimum price"
                            />
                          </div>
                          <div>
                            <Label>Max Price</Label>
                            <Input
                              type="number"
                              value={productForm.max_price}
                              onChange={(e) => setProductForm({ ...productForm, max_price: parseFloat(e.target.value) || 0 })}
                              placeholder="Maximum price"
                            />
                          </div>
                        </div>
                      )}
                      <div>
                        <Label>Initial Stock</Label>
                        <Input
                          type="number"
                          value={productForm.current_stock}
                          onChange={(e) => setProductForm({ ...productForm, current_stock: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Reorder Level</Label>
                        <Input
                          type="number"
                          value={productForm.reorder_level}
                          onChange={(e) => setProductForm({ ...productForm, reorder_level: parseInt(e.target.value) || 10 })}
                        />
                      </div>
                      <Button
                        onClick={() => productMutation.mutate(productForm)}
                        disabled={!productForm.name || !productForm.unit || productForm.cost_price <= 0 || productForm.selling_price <= 0}
                        className="w-full"
                      >
                        {editingProduct ? "Update" : "Add"} Product
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {products?.map((product: any) => {
                    const stockValue = product.stock ?? product.current_stock ?? 0;
                    const minStockValue = product.min_stock ?? product.reorder_level ?? 10;
                    const isOutOfStock = stockValue <= 0;
                    const isLowStock = stockValue > 0 && stockValue <= minStockValue;
                    
                    return (
                      <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{product.name}</h3>
                            {isOutOfStock && (
                              <Badge variant="destructive">Out of Stock</Badge>
                            )}
                            {isLowStock && !isOutOfStock && (
                              <Badge variant="secondary">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Low Stock
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Stock: {stockValue}</span>
                            <span>Reorder at: {minStockValue}</span>
                            <span className="font-medium text-primary">UGX {product.selling_price?.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProductMutation.mutate(product.id)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {(!products || products.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No products found. Add one to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Packages Tab */}
          <TabsContent value="data-packages">
            {selectedDeptId ? (
              <div className="space-y-6">
                <DataPackages departmentId={selectedDeptId} />
                <DataPackageAnalytics departmentId={selectedDeptId} dateFilter="daily" />
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Please select a Mobile Money department to manage data packages.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Customer Registration Tab */}
          <TabsContent value="registrations">
            {selectedDeptId ? (
              <CustomerRegistration departmentId={selectedDeptId} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Please select a Mobile Money department to manage customer registrations.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Sales History Tab */}
          <TabsContent value="history">
            {selectedDeptId ? (
              <MobileMoneyHistory departmentId={selectedDeptId} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Please select a Mobile Money department to view sales history.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Daily Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Daily Mobile Money Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Daily Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Today's Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {salesData?.filter((s: any) => 
                          new Date(s.created_at).toDateString() === new Date().toDateString()
                        ).length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Total transactions today</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        UGX {(salesData?.filter((s: any) => 
                          new Date(s.created_at).toDateString() === new Date().toDateString()
                        ).reduce((sum: number, s: any) => sum + Number(s.total), 0) || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">Gross revenue</p>
                    </CardContent>
                  </Card>

                </div>

                {/* Service Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Service Sales Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const todaySales = salesData?.filter((s: any) => 
                            new Date(s.created_at).toDateString() === new Date().toDateString()
                          ) || [];
                          
                          const serviceStats: Record<string, { count: number; revenue: number }> = {};
                          todaySales.forEach((sale: any) => {
                            sale.sale_items?.forEach((item: any) => {
                              // Only include items that have a service_id (services)
                              if (item.service_id) {
                                const name = item.item_name;
                                if (!serviceStats[name]) {
                                  serviceStats[name] = { count: 0, revenue: 0 };
                                }
                                serviceStats[name].count += item.quantity;
                                serviceStats[name].revenue += Number(item.total);
                              }
                            });
                          });

                          const sortedServices = Object.entries(serviceStats)
                            .sort((a, b) => b[1].revenue - a[1].revenue);

                          return sortedServices.length > 0 ? (
                            sortedServices.map(([name, stats]) => (
                              <TableRow key={name}>
                                <TableCell className="font-medium">{name}</TableCell>
                                <TableCell className="text-right">{stats.count}</TableCell>
                                <TableCell className="text-right">UGX {stats.revenue.toLocaleString()}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                No service sales today
                              </TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Product Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Product Sales Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const todaySales = salesData?.filter((s: any) => 
                            new Date(s.created_at).toDateString() === new Date().toDateString()
                          ) || [];
                          
                          const productStats: Record<string, { count: number; revenue: number }> = {};
                          todaySales.forEach((sale: any) => {
                            sale.sale_items?.forEach((item: any) => {
                              // Only include items that have a product_id (products)
                              if (item.product_id) {
                                const name = item.item_name;
                                if (!productStats[name]) {
                                  productStats[name] = { count: 0, revenue: 0 };
                                }
                                productStats[name].count += item.quantity;
                                productStats[name].revenue += Number(item.total);
                              }
                            });
                          });

                          const sortedProducts = Object.entries(productStats)
                            .sort((a, b) => b[1].revenue - a[1].revenue);

                          return sortedProducts.length > 0 ? (
                            sortedProducts.map(([name, stats]) => (
                              <TableRow key={name}>
                                <TableCell className="font-medium">{name}</TableCell>
                                <TableCell className="text-right">{stats.count}</TableCell>
                                <TableCell className="text-right">UGX {stats.revenue.toLocaleString()}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                No product sales today
                              </TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Credits Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Credits & Money Transfers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Today's Credits Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <Card className="bg-muted/30">
                          <CardContent className="pt-4">
                            <div className="text-sm font-medium text-muted-foreground">Pending Approval</div>
                            <div className="text-2xl font-bold mt-1">
                              {creditsData?.filter((c: any) => 
                                c.status === "pending" && 
                                new Date(c.created_at).toDateString() === new Date().toDateString()
                              ).length || 0}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-success/10">
                          <CardContent className="pt-4">
                            <div className="text-sm font-medium text-muted-foreground">Approved Today</div>
                            <div className="text-2xl font-bold mt-1">
                              {creditsData?.filter((c: any) => 
                                c.status === "approved" && 
                                new Date(c.created_at).toDateString() === new Date().toDateString()
                              ).length || 0}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-primary/10">
                          <CardContent className="pt-4">
                            <div className="text-sm font-medium text-muted-foreground">Total Amount Today</div>
                            <div className="text-2xl font-bold mt-1">
                              UGX {(creditsData?.filter((c: any) => 
                                new Date(c.created_at).toDateString() === new Date().toDateString()
                              ).reduce((sum: number, c: any) => sum + Number(c.amount), 0) || 0).toLocaleString()}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Recent Credits Table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>From/To</TableHead>
                            <TableHead>Purpose</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {creditsData && creditsData.length > 0 ? (
                            creditsData.slice(0, 10).map((credit: any) => (
                              <TableRow key={credit.id}>
                                <TableCell className="text-sm">
                                  {new Date(credit.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {credit.transaction_type === "interdepartmental" 
                                      ? "Interdept" 
                                      : credit.transaction_type === "external_in"
                                      ? "Received"
                                      : "Sent"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {credit.from_department?.name || credit.from_person || "—"} → {credit.to_department?.name || credit.to_person || "—"}
                                </TableCell>
                                <TableCell className="text-sm max-w-[200px] truncate">{credit.purpose}</TableCell>
                                <TableCell className="text-right font-medium">
                                  UGX {Number(credit.amount).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  {credit.status === "approved" ? (
                                    <Badge className="bg-success">Approved</Badge>
                                  ) : credit.status === "rejected" ? (
                                    <Badge variant="destructive">Rejected</Badge>
                                  ) : (
                                    <Badge variant="secondary">Pending</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground">
                                No credits found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Agent Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle>Agent Performance Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent/Cashier</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                          <TableHead className="text-right">Total Sales</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const todaySales = salesData?.filter((s: any) => 
                            new Date(s.created_at).toDateString() === new Date().toDateString()
                          ) || [];
                          
                          const agentStats: Record<string, { count: number; total: number }> = {};
                          todaySales.forEach((sale: any) => {
                            const agent = sale.cashier_name || "Unknown";
                            if (!agentStats[agent]) {
                              agentStats[agent] = { count: 0, total: 0 };
                            }
                            agentStats[agent].count += 1;
                            agentStats[agent].total += Number(sale.total);
                          });

                          const sortedAgents = Object.entries(agentStats)
                            .sort((a, b) => b[1].total - a[1].total);

                          return sortedAgents.length > 0 ? (
                            sortedAgents.map(([agent, stats]) => (
                              <TableRow key={agent}>
                                <TableCell className="font-medium">{agent}</TableCell>
                                <TableCell className="text-right">{stats.count}</TableCell>
                                <TableCell className="text-right">UGX {stats.total.toLocaleString()}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground">
                                No activity today
                              </TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Low Stock Alerts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Low Stock Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Current Stock</TableHead>
                          <TableHead className="text-right">Reorder Level</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const lowStockProducts = products?.filter((p: any) => {
                            const stockVal = p.stock ?? p.current_stock ?? 0;
                            const minStock = p.min_stock ?? p.reorder_level ?? 10;
                            return stockVal <= minStock;
                          }) || [];

                          return lowStockProducts.length > 0 ? (
                            lowStockProducts.map((product: any) => {
                              const stockVal = product.stock ?? product.current_stock ?? 0;
                              const minStock = product.min_stock ?? product.reorder_level ?? 10;
                              const isOutOfStock = stockVal === 0;
                              return (
                                <TableRow key={product.id}>
                                  <TableCell className="font-medium">{product.name}</TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant={isOutOfStock ? "destructive" : "secondary"}>
                                      {stockVal} {product.unit}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {minStock} {product.unit}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isOutOfStock ? (
                                      <Badge variant="destructive">Out of Stock</Badge>
                                    ) : (
                                      <Badge variant="secondary">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        Low Stock
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                All products are well stocked!
                              </TableCell>
                            </TableRow>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Card Settings Tab */}
          <TabsContent value="card-settings">
            {selectedDeptId ? (
              <SimCardSettings departmentId={selectedDeptId} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Please select a Mobile Money department to configure SIM card settings.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Dialog */}
      <ReceiptActionsDialog
        isOpen={showReceiptDialog}
        onClose={() => setShowReceiptDialog(false)}
        receiptData={currentReceiptData}
      />

      {/* Mobile Money Dialog */}
      <MobileMoneyDialog
        open={showMobileMoneyDialog}
        onOpenChange={setShowMobileMoneyDialog}
        amount={currentReceiptData?.total || 0}
        departmentId={selectedDeptId || ""}
        saleId={completedSaleId}
        onSuccess={() => {
          setShowMobileMoneyDialog(false);
          setCurrentReceiptData(null);
          setCompletedSaleId(null);
        }}
      />

      {/* Custom Price Dialog */}
      <Dialog open={customPriceDialog.open} onOpenChange={(open) => !open && setCustomPriceDialog({ open: false, index: -1, currentPrice: 0 })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Custom Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Price: UGX {customPriceDialog.currentPrice.toLocaleString()}</Label>
            </div>
            <div>
              <Label>New Price (UGX)</Label>
              <Input
                type="number"
                value={customPriceValue}
                onChange={(e) => setCustomPriceValue(e.target.value)}
                placeholder="Enter custom price"
              />
            </div>
            <Button onClick={applyCustomPrice} className="w-full">
              Apply Price
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MobileMoney;
