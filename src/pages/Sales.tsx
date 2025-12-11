import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { printReceipt } from "@/utils/receiptPrinter";
import { printInvoice } from "@/utils/invoicePrinter";
import { reduceStock, checkStockAvailability, checkVariantStockAvailability } from "@/utils/stockManagement";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Barcode, Plus, Trash2, ShoppingCart, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { ReceiptActionsDialog } from "@/components/ReceiptActionsDialog";
import { MobileMoneyDialog } from "@/components/pos/MobileMoneyDialog";
import { VariantSelectorDialog } from "@/components/pos/VariantSelectorDialog";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useDemoMode } from "@/contexts/DemoModeContext";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: "product" | "service" | "perfume" | "shop_product";
  productId?: string;
  serviceId?: string;
  variantId?: string;
  variantName?: string;
  allowCustomPrice?: boolean;
  minPrice?: number;
  maxPrice?: number;
  trackingType?: string;
  volumeUnit?: string;
  pricingTiers?: {
    retail?: number;
    wholesale?: number;
    individual?: number;
  };
  selectedTier?: string;
  mixedScents?: string[]; // For perfumes - track which scents are mixed
  scentCount?: number; // Number of scents mixed
  bottleSize?: number; // For perfume refills
  customerType?: "retail" | "wholesale"; // For perfume refills
  scentMixture?: string; // For perfume refills
  bottleCost?: number; // For perfume refills
  packingCost?: number; // Packing material cost
  basePrice?: number; // Base price (ml × rate)
  profitMargin?: number; // Profit margin
  pricePerMl?: number; // For perfume refills
  totalMl?: number; // Total milliliters for perfume refills
  isPerfumeRefill?: boolean; // Flag for perfume refill items
  subtotal: number;
}

const Sales = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { selectedDepartmentId, isPerfumeDepartment } = useDepartment();
  const { isDemoMode, showDemoWarning } = useDemoMode();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [cashierName, setCashierName] = useState("");
  const [autoPrint, setAutoPrint] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [currentReceiptData, setCurrentReceiptData] = useState<any>(null);
  const [showMobileMoneyDialog, setShowMobileMoneyDialog] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);
  const [showVariantSelector, setShowVariantSelector] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<any>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Fetch department settings for receipt
  const { data: departmentSettings } = useQuery({
    queryKey: ["department-settings", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return null;
      const { data } = await supabase
        .from("settings")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedDepartmentId,
  });

  // Fallback to global settings if no department settings
  const { data: globalSettings } = useQuery({
    queryKey: ["global-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").maybeSingle();
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products", searchQuery, barcode, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { data: allProducts } = await supabase
        .from("products")
        .select("*")
        .eq("department_id", selectedDepartmentId);
      
      if (!allProducts) return [];
      
      let filteredProducts = allProducts.filter((p: any) => !p.is_archived);
      
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter((p: any) => 
          p.name?.toLowerCase().includes(lowerSearch) ||
          p.barcode?.toLowerCase().includes(lowerSearch) ||
          p.internal_barcode?.toLowerCase().includes(lowerSearch)
        );
      }
      
      if (barcode) {
        filteredProducts = filteredProducts.filter((p: any) => 
          p.barcode === barcode || p.internal_barcode === barcode
        );
      }
      
      // Get variants for products
      const productIds = filteredProducts.map((p: any) => p.id);
      const { data: allVariants } = await supabase.from("product_variants").select("*");
      const variantsForProducts = (allVariants || []).filter((v: any) => productIds.includes(v.product_id));
      
      const productsWithVariants = new Set(
        variantsForProducts.map((v: any) => v.product_id)
      );
      
      // Filter out perfume products and filter by stock
      const finalFiltered = filteredProducts.filter((product: any) => {
        if (product.tracking_type === 'ml') return false;
        if (product.name === "Oil Perfume") return false;
        if (productsWithVariants.has(product.id)) return true;
        // Check both stock fields (some products use stock, others use current_stock)
        return (product.current_stock > 0 || product.stock > 0);
      });
      
      return finalFiltered.slice(0, 10);
    },
    enabled: !!selectedDepartmentId,
  });

  // Fetch variant counts for all products in the list
  const { data: variantCounts = {} } = useQuery({
    queryKey: ["product-variant-counts", products?.map((p: any) => p.id)],
    queryFn: async () => {
      if (!products || products.length === 0) return {};
      
      const productIds = products.map((p: any) => p.id);
      const { data: allVariants } = await supabase.from("product_variants").select("*");
      const relevantVariants = (allVariants || []).filter((v: any) => productIds.includes(v.product_id));
      
      const counts: Record<string, number> = {};
      relevantVariants.forEach((variant: any) => {
        counts[variant.product_id] = (counts[variant.product_id] || 0) + 1;
      });
      
      return counts;
    },
    enabled: !!products && products.length > 0,
  });

  // Fetch variants for the selected product
  const { data: productVariants = [] } = useQuery({
    queryKey: ["product-variants-pos", selectedProductForVariant?.id],
    queryFn: async () => {
      if (!selectedProductForVariant?.id) return [];
      
      const { data: variants } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", selectedProductForVariant.id);
      return (variants || []).sort((a: any, b: any) => a.variant_name?.localeCompare(b.variant_name || '') || 0);
    },
    enabled: !!selectedProductForVariant?.id,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      const { data: allCustomers } = await supabase
        .from("customers")
        .select("*")
        .eq("department_id", selectedDepartmentId);
      return (allCustomers || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: !!selectedDepartmentId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*");
      return data || [];
    },
  });

  // Fetch current user profile for cashier name
  useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (profile?.full_name) {
          setCashierName(profile.full_name);
        }
        return profile;
      }
      return null;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services", searchQuery, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      
      // Check if current department is mobile money or perfume
      const { data: currentDept } = await supabase
        .from("departments")
        .select("*")
        .eq("id", selectedDepartmentId)
        .maybeSingle();
      
      // Don't show services if department is mobile money or perfume
      if (currentDept?.is_mobile_money || currentDept?.is_perfume_department) {
        return [];
      }
      
      // Show services from the current department only
      const { data: allServices } = await supabase
        .from("services")
        .select("*")
        .eq("department_id", selectedDepartmentId);
      
      let filtered = allServices || [];
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        filtered = filtered.filter((s: any) => s.name?.toLowerCase().includes(lowerSearch));
      }
      
      return filtered.slice(0, 10);
    },
    enabled: !!selectedDepartmentId,
  });

  const handleProductClick = async (product: any) => {
    // Check if product has variants
    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id)
      .limit(1);
    
    if (variants && variants.length > 0) {
      // Show variant selector
      setSelectedProductForVariant(product);
      setShowVariantSelector(true);
    } else {
      // No variants, add directly to cart
      addToCart(product, "product");
    }
  };

  const handleVariantSelect = async (variant: any) => {
    if (!selectedProductForVariant) return;
    
    const product = selectedProductForVariant;
    
    // Use addToCart to maintain consistency and stock checking
    await addToCart(
      product,
      "product",
      variant.id,
      variant.variant_name,
      variant.price_adjustment || 0
    );
    
    setSelectedProductForVariant(null);
  };

  const addToCart = async (
    item: any,
    type: "product" | "service",
    variantId?: string,
    variantName?: string,
    variantPriceAdjustment?: number
  ) => {
    // Prevent duplicate rapid clicks
    if (isAddingToCart) return;
    setIsAddingToCart(true);
    
    try {
      // Create unique cart ID for variants
      const cartItemId = variantId ? `${item.id}-${variantId}` : item.id;
    
    // Check stock availability for products before adding
    if (type === "product") {
      const defaultQty = item.tracking_type === "milliliter" ? 100 : 1;
      
      // Check variant stock if variantId is provided
      if (variantId) {
        const stockCheck = await checkVariantStockAvailability(variantId, defaultQty);
        if (!stockCheck.available) {
          toast.error(stockCheck.message || "Insufficient stock");
          return;
        }
      } else {
        // Check product stock
        const stockCheck = await checkStockAvailability(
          item.id,
          defaultQty,
          item.tracking_type,
          item.tracking_type === "milliliter" ? defaultQty : undefined
        );
        
        if (!stockCheck.available) {
          toast.error(stockCheck.message || "Insufficient stock");
          return;
        }
      }
    }

    const existingItem = cart.find((i) => i.id === cartItemId);
    
    let price = type === "product" ? item.selling_price : item.base_price;
    let selectedTier = "default";
    let defaultQuantity = 1;
    
    if (type === "product" && item.tracking_type === "milliliter") {
      defaultQuantity = 100;
      if (item.retail_price_per_ml && item.retail_price_per_ml > 0) {
        price = item.retail_price_per_ml;
        selectedTier = "retail";
      } else if (item.wholesale_price_per_ml && item.wholesale_price_per_ml > 0) {
        price = item.wholesale_price_per_ml;
        selectedTier = "wholesale";
      }
    } else if (type === "product" && item.pricing_tiers) {
      if (item.pricing_tiers.retail && item.pricing_tiers.retail > 0) {
        price = item.pricing_tiers.retail;
        selectedTier = "retail";
      } else if (item.pricing_tiers.wholesale && item.pricing_tiers.wholesale > 0) {
        price = item.pricing_tiers.wholesale;
        selectedTier = "wholesale";
      } else if (item.pricing_tiers.individual && item.pricing_tiers.individual > 0) {
        price = item.pricing_tiers.individual;
        selectedTier = "individual";
      }
    }
    
    // Apply variant price adjustment AFTER all other pricing logic
    if (variantPriceAdjustment !== undefined) {
      price = price + variantPriceAdjustment;
    }
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + (item.tracking_type === "milliliter" ? 100 : 1);
      
      // Re-check stock for the new quantity
      if (type === "product") {
        // Check variant stock if variantId is provided
        if (variantId) {
          const stockCheck = await checkVariantStockAvailability(variantId, newQuantity);
          if (!stockCheck.available) {
            toast.error(stockCheck.message || "Insufficient stock");
            return;
          }
        } else {
          // Check product stock
          const stockCheck = await checkStockAvailability(
            item.id,
            newQuantity,
            item.tracking_type,
            item.tracking_type === "milliliter" ? newQuantity : undefined
          );
          
          if (!stockCheck.available) {
            toast.error(stockCheck.message || "Insufficient stock");
            return;
          }
        }
      }
      
      setCart(cart.map((i) =>
        i.id === cartItemId ? { ...i, quantity: newQuantity, subtotal: i.price * newQuantity } : i
      ));
    } else {
      setCart([
        ...cart,
        {
          id: cartItemId,
          name: `${item.name}${variantName ? ` - ${variantName}` : ''}`,
          price: Number(price),
          quantity: defaultQuantity,
          type,
          productId: type === "product" ? item.id : undefined,
          serviceId: type === "service" ? item.id : undefined,
          variantId,
          variantName,
          allowCustomPrice: type === "product" ? item.allow_custom_price : item.is_negotiable,
          minPrice: item.min_price ? Number(item.min_price) : undefined,
          maxPrice: item.max_price ? Number(item.max_price) : undefined,
          trackingType: item.tracking_type,
          volumeUnit: item.volume_unit,
          pricingTiers: item.pricing_tiers,
          selectedTier: selectedTier,
          subtotal: Number(price) * defaultQuantity,
        },
    ]);
    }
    setSearchQuery("");
    setBarcode("");
    toast.success(`${item.name} added to cart`);
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Handle barcode scanning with variant support
  const handleBarcodeSearch = async (scannedBarcode: string) => {
    if (!scannedBarcode.trim()) return;

    console.log('Scanning barcode:', scannedBarcode);
    
    // First, check if barcode matches a variant
    const { data: allVariants } = await supabase.from("product_variants").select("*");
    const matchingVariants = (allVariants || []).filter((v: any) => v.barcode === scannedBarcode);
    
    if (matchingVariants.length > 0) {
      const variant = matchingVariants[0];
      const { data: allProducts } = await supabase
        .from("products")
        .select("*")
        .eq("department_id", selectedDepartmentId);
      const product = (allProducts || []).find((p: any) => p.id === variant.product_id);
      
      if (product) {
        // Add variant directly to cart with variant price
        addToCart(product, "product", variant.id, variant.variant_name, variant.price || 0);
        
        toast.success(`${product.name} - ${variant.variant_name} added!`);
        setBarcode('');
        return;
      }
    }

    // If no variant found, search for product by barcode or internal_barcode
    const { data: allProducts } = await supabase
      .from("products")
      .select("*")
      .eq("department_id", selectedDepartmentId);
    const matchedProducts = (allProducts || []).filter((p: any) => 
      p.barcode === scannedBarcode || p.internal_barcode === scannedBarcode
    ).slice(0, 1);

    if (matchedProducts && matchedProducts.length > 0) {
      const product = matchedProducts[0];
      const productVars = (allVariants || []).filter((v: any) => v.product_id === product.id);
      
      if (productVars.length > 0) {
        // Show variant selector if product has variants
        setSelectedProductForVariant({
          id: product.id,
          name: product.name,
          price: product.selling_price,
          variants: productVars
        });
        setShowVariantSelector(true);
      } else {
        // Add product directly if no variants
        addToCart(product, "product");
      }
      
      toast.success(`${product.name} found!`);
      setBarcode('');
    } else {
      toast.error('Product not found');
      console.log('No product found with barcode:', scannedBarcode);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(cart.map((item) => (item.id === id ? { ...item, quantity, subtotal: item.price * quantity } : item)));
  };

  const updatePrice = (id: string, price: number) => {
    const item = cart.find((i) => i.id === id);
    if (item && !item.allowCustomPrice && !isAdmin) {
      toast.error("Custom pricing not allowed for this item");
      return;
    }
    if (item?.minPrice && price < item.minPrice) {
      toast.error(`Price cannot be below ${item.minPrice}`);
      return;
    }
    if (item?.maxPrice && price > item.maxPrice) {
      toast.error(`Price cannot exceed ${item.maxPrice}`);
      return;
    }
    setCart(cart.map((i) => (i.id === id ? { ...i, price, subtotal: price * i.quantity } : i)));
  };

  const updatePriceTier = (id: string, tier: string) => {
    const item = cart.find((i) => i.id === id);
    if (!item || !item.pricingTiers) return;
    
    let newPrice = item.price;
    if (tier === "retail" && item.pricingTiers.retail) {
      newPrice = item.pricingTiers.retail;
    } else if (tier === "wholesale" && item.pricingTiers.wholesale) {
      newPrice = item.pricingTiers.wholesale;
    } else if (tier === "individual" && item.pricingTiers.individual) {
      newPrice = item.pricingTiers.individual;
    } else if (tier === "default") {
      const product = products?.find((p) => p.id === item.productId);
      if (product) newPrice = product.selling_price;
    }
    
    setCart(cart.map((i) => (i.id === id ? { ...i, price: newPrice, selectedTier: tier, subtotal: newPrice * i.quantity } : i)));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal; // Total equals subtotal (no taxes/discounts)

  const completeSaleMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) {
        throw new Error("Cart is empty");
      }

      if (!paymentMethod || paymentMethod.trim() === "") {
        throw new Error("Please select a payment method");
      }

      // Check stock availability first
      for (const item of cart) {
        if (item.productId) {
          // Check variant stock if item has a variantId
          if (item.variantId) {
            const stockCheck = await checkVariantStockAvailability(
              item.variantId,
              item.quantity
            );
            if (!stockCheck.available) {
              throw new Error(stockCheck.message || "Insufficient stock");
            }
          } else {
            // Check product stock for non-variant items
            const stockCheck = await checkStockAvailability(
              item.productId,
              item.quantity,
              item.trackingType,
              item.totalMl
            );
            if (!stockCheck.available) {
              throw new Error(stockCheck.message || "Insufficient stock");
            }
          }
        }
      }

      // Use department settings or fallback to global settings
      const settings = departmentSettings || globalSettings;
      
      // Generate QR code if WhatsApp number is available
      let qrCodeUrl;
      if (settings?.whatsapp_number) {
        try {
          const QRCode = (await import('qrcode')).default;
          const message = "Hello! I'd like to connect.";
          const whatsappUrl = `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
          qrCodeUrl = await QRCode.toDataURL(whatsappUrl, { width: 200, margin: 1 });
        } catch (err) {
          console.error('Failed to generate QR code:', err);
        }
      }
      
      // Create sale data with business info for receipt
      const mockSaleData = {
        id: `sale_${Date.now()}`, // Generate a temporary ID
        department_id: selectedDepartmentId,
        cashier_name: cashierName,
        customer_id: selectedCustomerId || null,
        payment_method: paymentMethod,
        subtotal: subtotal,
        total: total,
        amount_paid: subtotal,
        change: 0,
        notes: "",
        items: cart,
        created_at: new Date().toISOString(),
        receiptNumber: `REC-${Date.now()}`,
        businessInfo: {
          name: settings?.business_name || "Business Name",
          address: settings?.business_address || "Kasangati opp Kasangati Police Station",
          phone: settings?.business_phone || "+256745368426",
          email: settings?.business_email || "",
          logo: settings?.logo_url || "",
          whatsapp: settings?.whatsapp_number || "+256745368426",
          website: settings?.website || "",
        },
        seasonalRemark: settings?.seasonal_remark || "",
        qrCodeUrl,
        date: new Date().toLocaleString(),
      };

      // Reduce stock for all items
      const stockResult = await reduceStock(cart, selectedDepartmentId, isDemoMode);
      if (!stockResult.success) {
        throw new Error("Failed to reduce stock: " + stockResult.error);
      }

      // In demo mode, skip database operations
      if (isDemoMode) {
        // Generate a mock receipt for demo purposes
        const mockReceipt = {
          ...mockSaleData,
          id: `demo_${Date.now()}`,
          receipt_number: `DEMO-${Date.now()}`,
        };
        
        showDemoWarning();
        setCurrentReceiptData(mockReceipt);
        setShowReceiptDialog(true);
        setCart([]);
        return mockReceipt;
      }

      // Insert sale into database (only if not demo mode)
      const salePayload = {
        sale: {
          department_id: mockSaleData.department_id,
          cashier_name: mockSaleData.cashier_name,
          customer_id: mockSaleData.customer_id,
          payment_method: mockSaleData.payment_method as "cash" | "card" | "mobile_money" | "credit",
          subtotal: mockSaleData.subtotal,
          total: mockSaleData.total,
          amount_paid: mockSaleData.amount_paid,
          change_amount: mockSaleData.change,
          receipt_number: `RCP${String(Date.now()).slice(-6)}`,
          sale_number: `SALE${String(Date.now()).slice(-8)}`,
          status: 'completed' as const,
        },
        items: cart.map((item) => ({
          product_id: item.productId || null,
          service_id: item.serviceId || null,
          variant_id: item.variantId || null,
          item_name: item.variantName ? `${item.name} - ${item.variantName}` : item.name,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.subtotal,
          customer_type: item.customerType || null,
          scent_mixture: item.scentMixture || null,
          bottle_cost: item.bottleCost || null,
        }))
      };
      
      // Insert sale
      const { data: insertedSale, error: saleError } = await supabase
        .from("sales")
        .insert([salePayload.sale])
        .select()
        .single();

      if (saleError || !insertedSale) {
        throw new Error("Failed to save sale");
      }

      // Insert sale items
      const itemsWithSaleId = salePayload.items.map((item: any) => ({
        ...item,
        sale_id: insertedSale.id,
        name: item.item_name,
        total: item.subtotal,
      }));
      
      await supabase.from("sale_items").insert(itemsWithSaleId);

      // Update mock sale data with actual sale ID and receipt number
      mockSaleData.id = insertedSale.id;
      mockSaleData.receiptNumber = insertedSale.receipt_number;

      // Check if payment method is mobile money - pause completion
      if (paymentMethod === "mobile_money") {
        // Store the sale ID to use in mobile money dialog
        setCompletedSaleId(mockSaleData.id);
        setShowMobileMoneyDialog(true);
        return mockSaleData;
      }

      return mockSaleData;
    },
    onSuccess: async (sale) => {
      // Invalidate all queries to ensure dashboard updates
      queryClient.invalidateQueries();
      
      toast.success("Sale completed successfully!");
      
      // Only show receipt if NOT mobile money
      if (paymentMethod !== "mobile_money") {
        setCurrentReceiptData(sale);
        setShowReceiptDialog(true);
        setCart([]);
        setPaymentMethod("cash");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to complete sale");
    },
  });

  return (
    <>
      <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
        <Navigation />

        <main className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold">Point of Sale</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Process sales and manage transactions
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Product/Service Search */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Search Products & Services</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Scan barcode..."
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleBarcodeSearch(barcode);
                          }
                        }}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Tabs defaultValue="products">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="products">Products</TabsTrigger>
                      <TabsTrigger value="services">Services</TabsTrigger>
                    </TabsList>

                    <TabsContent value="products" className="space-y-2 mt-4 max-h-96 overflow-y-auto">
                      {products?.map((product) => {
                        // Calculate display price for perfume products
                        const displayPrice = product.tracking_type === "ml"
                          ? (product.retail_price_per_ml || product.wholesale_price_per_ml || 0)
                          : product.selling_price;
                      
                        const priceLabel = product.tracking_type === "ml" 
                          ? "per ml" 
                          : "";
                      
                        const stockDisplay = product.tracking_type === "ml"
                          ? `${product.total_ml || 0} ml`
                          : product.current_stock;
                      
                        return (
                          <div
                            key={product.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors gap-2"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{product.name}</p>
                                {variantCounts[product.id] > 0 && (
                                  <Badge variant="default" className="text-xs">
                                    {variantCounts[product.id]} Variants
                                  </Badge>
                                )}
                                {product.is_bundle && (
                                  <Badge variant="secondary" className="text-xs">Bundle</Badge>
                                )}
                                {product.allow_custom_price && (
                                  <Badge variant="outline" className="text-xs">Custom Price</Badge>
                                )}
                                {product.tracking_type === "ml" && (
                                  <Badge variant="outline" className="text-xs">Refill</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {product.brand && `${product.brand} • `}
                                {variantCounts[product.id] > 0 ? (
                                  <span>Click to select variant</span>
                                ) : (
                                  <span>Stock: {stockDisplay}</span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                              <span className="font-bold">UGX {Number(displayPrice).toLocaleString()} {priceLabel}</span>
                              <Button
                                size="sm"
                                onClick={() => handleProductClick(product)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {(!products || products.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          No products found
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="services" className="space-y-2 mt-4 max-h-96 overflow-y-auto">
                      {services?.map((service) => (
                        <div
                          key={service.id}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors gap-2"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{service.name}</p>
                              {service.is_negotiable && (
                                <Badge variant="outline" className="text-xs">Negotiable</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                            <span className="font-bold">UGX {Number(service.base_price).toLocaleString()}</span>
                            <Button size="sm" onClick={() => addToCart(service, "service")}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!services || services.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          No services found
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Cart */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Cart ({cart.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-h-64 lg:max-h-80 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                         <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            {item.variantName && (
                              <p className="text-xs text-muted-foreground">Variant: {item.variantName}</p>
                            )}
                            {item.trackingType === "volume" && item.volumeUnit && (
                              <p className="text-xs text-muted-foreground">{item.volumeUnit}</p>
                            )}
                            {item.scentMixture && (
                              <p className="text-xs text-muted-foreground">
                                {item.scentMixture}
                              </p>
                            )}
                            {item.customerType && (
                              <p className="text-xs text-muted-foreground">
                                Type: {item.customerType}
                              </p>
                            )}
                            {item.allowCustomPrice && (
                              <Badge variant="outline" className="text-xs mt-1">
                                Custom Price
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        
                        {item.pricingTiers && (item.pricingTiers.retail || item.pricingTiers.wholesale || item.pricingTiers.individual) && (
                          <div className="space-y-1">
                            <Label className="text-xs">Price Tier</Label>
                            <Select 
                              value={item.selectedTier || "default"} 
                              onValueChange={(tier) => {
                                let newPrice = item.price;
                                if (tier === "retail" && item.pricingTiers?.retail) newPrice = item.pricingTiers.retail;
                                if (tier === "wholesale" && item.pricingTiers?.wholesale) newPrice = item.pricingTiers.wholesale;
                                if (tier === "individual" && item.pricingTiers?.individual) newPrice = item.pricingTiers.individual;
                                setCart(cart.map((i) => i.id === item.id ? { ...i, selectedTier: tier, price: newPrice, subtotal: newPrice * i.quantity } : i));
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {item.pricingTiers.retail && (
                                  <SelectItem value="retail">
                                    Retail - UGX {item.pricingTiers.retail.toLocaleString()}
                                  </SelectItem>
                                )}
                                {item.pricingTiers.wholesale && (
                                  <SelectItem value="wholesale">
                                    Wholesale - UGX {item.pricingTiers.wholesale.toLocaleString()}
                                  </SelectItem>
                                )}
                                {item.pricingTiers.individual && (
                                  <SelectItem value="individual">
                                    Individual - UGX {item.pricingTiers.individual.toLocaleString()}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">
                              {item.trackingType === "milliliter" ? "ml" : "Qty"}
                            </Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                              className="h-8 text-sm"
                              min="1"
                              step={item.trackingType === "volume" || item.trackingType === "milliliter" ? "1" : "1"}
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Price</Label>
                            <Input
                              type="number"
                              value={item.price}
                              onChange={(e) => updatePrice(item.id, Number(e.target.value))}
                              className="h-8 text-sm"
                              disabled={!item.allowCustomPrice && !isAdmin}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold">
                            UGX {item.subtotal.toLocaleString()}
                          </p>
                          {item.minPrice && item.maxPrice && (
                            <p className="text-xs text-muted-foreground">
                              Range: {item.minPrice}-{item.maxPrice}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        Cart is empty. Add items to begin.
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex justify-between text-base sm:text-lg font-bold">
                      <span>Total:</span>
                      <span>UGX {subtotal.toLocaleString()}</span>
                    </div>

                    <div className="space-y-2">
                      <Label>Customer Name (Optional)</Label>
                      <Input
                        type="text"
                        placeholder="Walk-in Customer"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty for "Walk-in Customer" or enter customer name
                      </p>
                    </div>

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

                    <div className="space-y-2">
                      <Label>Cashier Name (Optional)</Label>
                      <Input
                        value={cashierName}
                        onChange={(e) => setCashierName(e.target.value)}
                        placeholder="Enter cashier name"
                      />
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => completeSaleMutation.mutate()}
                      disabled={cart.length === 0 || !paymentMethod || completeSaleMutation.isPending}
                    >
                      {completeSaleMutation.isPending ? "Processing..." : "Complete Sale"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <ReceiptActionsDialog
          isOpen={showReceiptDialog}
          onClose={() => setShowReceiptDialog(false)}
          receiptData={currentReceiptData}
          customerPhone={null}
          isInvoice={currentReceiptData?.invoiceNumber ? true : false}
        />

        <MobileMoneyDialog
          open={showMobileMoneyDialog}
          onOpenChange={setShowMobileMoneyDialog}
          amount={subtotal}
          departmentId={selectedDepartmentId}
          saleId={completedSaleId}
          onSuccess={() => {
            // After successful payment
            setCurrentReceiptData({
              id: completedSaleId,
              subtotal: subtotal,
              total: total,
              payment_method: "mobile_money",
            });
            setShowReceiptDialog(true);
            setCart([]);
            setPaymentMethod("cash");
            setShowMobileMoneyDialog(false);
            setCompletedSaleId(null);
            queryClient.invalidateQueries();
          }}
        />

        <VariantSelectorDialog
          open={showVariantSelector}
          onOpenChange={setShowVariantSelector}
          productName={selectedProductForVariant?.name || ""}
          basePrice={selectedProductForVariant?.selling_price || 0}
          variants={productVariants as any[]}
          onSelectVariant={handleVariantSelect}
        />
      </div>
    </>
  );
};

export default Sales;