import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { printReceipt } from "@/utils/receiptPrinter";
import { reduceStock } from "@/utils/stockManagement";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShoppingCart, Trash2, Plus, Sparkles, Barcode, UserPlus, Package, ShoppingBag, History, AlertTriangle, PauseCircle, Clock } from "lucide-react";
import { ScentLookupDialog } from "@/components/perfume/ScentLookupDialog";
import { toast } from "sonner";
import { ReceiptActionsDialog } from "@/components/ReceiptActionsDialog";
import { ReceiptEditDialog } from "@/components/ReceiptEditDialog";
import { PerfumeRefillDialog } from "@/components/inventory/PerfumeRefillDialog";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { CustomerPurchaseHistory } from "@/components/perfume/CustomerPurchaseHistory";
import { ParkedCartsPanel } from "@/components/pos/ParkedCartsPanel";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  type: "perfume" | "shop_product";
  productId?: string;
  customerType?: "retail" | "wholesale";
  scentMixture?: string;
  bottleCost?: number;
  totalMl?: number;
  trackingType?: string;
  subtotal: number;
  selectedScents?: Array<{ scent: string; ml: number; scentId?: string }>;
  pricePerMl?: number;
  isPerfumeRefill?: boolean;
}

const PerfumePOS = () => {
  const queryClient = useQueryClient();
  const { selectedDepartmentId } = useDepartment();
  const { isDemoMode, showDemoWarning } = useDemoMode();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [cashierName, setCashierName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("Walk-in");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentReceiptData, setCurrentReceiptData] = useState<any>(null);
  const [showPerfumeRefillDialog, setShowPerfumeRefillDialog] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [showNoCustomerWarning, setShowNoCustomerWarning] = useState(false);
  const [showParkDialog, setShowParkDialog] = useState(false);
  const [parkReason, setParkReason] = useState("");

  // Parked carts state with localStorage persistence
  const PARKED_CARTS_KEY = "perfume-pos-parked-carts";
  const [parkedCarts, setParkedCarts] = useState<Array<{
    id: string;
    name: string;
    items: CartItem[];
    customerName: string;
    customerId: string | null;
    parkedAt: Date;
    reason?: string;
  }>>(() => {
    const saved = localStorage.getItem(PARKED_CARTS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Save parked carts to localStorage
  useEffect(() => {
    localStorage.setItem(PARKED_CARTS_KEY, JSON.stringify(parkedCarts));
  }, [parkedCarts]);

  const parkCurrentCart = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    
    const parkedCart = {
      id: `parked-${Date.now()}`,
      name: customerName || "Walk-in",
      items: [...cart],
      customerName: customerName,
      customerId: selectedCustomerId,
      parkedAt: new Date(),
      reason: parkReason,
    };
    
    setParkedCarts(prev => [...prev, parkedCart]);
    setCart([]);
    setCustomerName("Walk-in");
    setSelectedCustomer("");
    setSelectedCustomerId(null);
    setCustomerEmail("");
    setParkReason("");
    setShowParkDialog(false);
    toast.success("Cart parked successfully");
  };

  const resumeParkedCart = (parkedCartId: string) => {
    const parked = parkedCarts.find(p => p.id === parkedCartId);
    if (!parked) return;

    // If current cart has items, ask to park it first
    if (cart.length > 0) {
      toast.error("Please complete or park current cart first");
      return;
    }

    setCart(parked.items);
    setCustomerName(parked.customerName);
    if (parked.customerId) {
      setSelectedCustomer(parked.customerId);
      setSelectedCustomerId(parked.customerId);
    }
    setParkedCarts(prev => prev.filter(p => p.id !== parkedCartId));
    toast.success("Cart resumed");
  };

  const deleteParkedCart = (parkedCartId: string) => {
    setParkedCarts(prev => prev.filter(p => p.id !== parkedCartId));
    toast.success("Parked cart deleted");
  };

  // Handle reorder from customer history
  const handleReorder = (items: CartItem[]) => {
    if (cart.length > 0) {
      // Ask if they want to add to existing cart
      setCart(prev => [...prev, ...items]);
      toast.success(`Added ${items.length} items to cart`);
    } else {
      setCart(items);
      toast.success("Previous order added to cart");
    }
  };

  const { data: perfumeProducts = [] } = useQuery({
    queryKey: ["perfume-products", selectedDepartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .eq("is_archived", false)
        .neq("name", "Oil Perfume"); // Exclude master stock - it's capital, not a product
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  // Handle barcode scanning to auto-add to cart
  const handleBarcodeSearch = async (scannedBarcode: string) => {
    if (!scannedBarcode || !selectedDepartmentId) return;
    
    const { data: matchedProducts, error } = await supabase
      .from("products")
      .select("*")
      .eq("department_id", selectedDepartmentId)
      .eq("is_archived", false)
      .neq("name", "Oil Perfume")
      .or(`barcode.eq.${scannedBarcode},internal_barcode.eq.${scannedBarcode}`);
    
    if (error) {
      toast.error("Error searching for product");
      setBarcode("");
      return;
    }
    
    if (!matchedProducts || matchedProducts.length === 0) {
      toast.error("No product found with this barcode");
      setBarcode("");
      return;
    }
    
    if (matchedProducts.length > 1) {
      toast.info(`Found ${matchedProducts.length} products. Please select one from the list.`);
      setBarcode("");
      return;
    }
    
    // Auto-add single matched product to cart
    const product = matchedProducts[0];
    const currentStock = product.current_stock || product.stock || 0;
    
    if (currentStock <= 0) {
      toast.error(`${product.name} is out of stock`);
      setBarcode("");
      return;
    }
    
    // Use direct retail_price field
    const retailPrice = product.retail_price || product.price;
    
    addToCart({
      id: `barcode-${product.id}-${Date.now()}`,
      name: product.name,
      price: retailPrice,
      quantity: 1,
      type: "shop_product",
      productId: product.id,
      customerType: "retail",
      subtotal: retailPrice,
      trackingType: product.tracking_type || "quantity",
    });
    
    toast.success(`${product.name} added to cart`);
    setBarcode("");
  };

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", selectedDepartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  // Fetch department settings
  const { data: departmentSettings } = useQuery({
    queryKey: ["department-settings", selectedDepartmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_settings")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!selectedDepartmentId,
  });

  // Fetch global settings as fallback
  const { data: globalSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch current user profile for cashier name
  const { data: userProfile } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Auto-set cashier name from user profile
  useEffect(() => {
    if (userProfile?.full_name && !cashierName) {
      setCashierName(userProfile.full_name);
    }
  }, [userProfile, cashierName]);

  // Create new customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: typeof newCustomerData) => {
      if (!customerData.name.trim()) {
        throw new Error("Customer name is required");
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: customerData.name.trim(),
          phone: customerData.phone.trim() || null,
          email: customerData.email.trim() || null,
          address: customerData.address.trim() || null,
          department_id: selectedDepartmentId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newCustomer) => {
      toast.success(`Customer "${newCustomer.name}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["customers", selectedDepartmentId] });
      
      // Auto-select the newly created customer
      setSelectedCustomer(newCustomer.id);
      setCustomerName(newCustomer.name);
      if (newCustomer.email) {
        setCustomerEmail(newCustomer.email);
      }
      
      // Close dialog and reset form
      setShowNewCustomerDialog(false);
      setNewCustomerData({
        name: "",
        phone: "",
        email: "",
        address: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create customer");
    },
  });

  const handleCreateCustomer = () => {
    createCustomerMutation.mutate(newCustomerData);
  };

  const addToCart = (item: CartItem) => {
    setCart(prev => [...prev, item]);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCart(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity, subtotal: item.price * newQuantity }
        : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal;

  // Handler to check if customer is selected before completing sale
  const handleCompleteSale = () => {
    if (!selectedCustomer && cart.some(item => item.type === "perfume" || item.scentMixture)) {
      setShowNoCustomerWarning(true);
      return;
    }
    completeSaleMutation.mutate();
  };

  const completeSaleMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) {
        throw new Error("Cart is empty");
      }

      // Use globalSettings for business info (department_settings doesn't have those fields)
      const settings = globalSettings;
      
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

      // Generate proper sequential receipt/invoice number
      const { data: receiptNumber, error: receiptError } = await supabase.rpc('generate_receipt_number');
      
      if (receiptError) {
        throw new Error("Failed to generate receipt number: " + receiptError.message);
      }
      
      // Check if it's a wholesale sale (invoice)
      const hasWholesaleItems = cart.some(item => item.customerType === "wholesale");
      const invoiceNumber = hasWholesaleItems ? receiptNumber.replace('RCP', 'INV') : null;

      // Transform cart items to match receipt format
      const receiptItems = cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        scentMixture: item.scentMixture,
        packingCost: item.bottleCost,
        isPerfumeRefill: item.type === "perfume",
        customerType: item.customerType,
        scentBreakdown: item.selectedScents,
        totalMl: item.totalMl,
        pricePerMl: item.pricePerMl,
      }));

      // Create properly formatted receipt data
      const receiptData = {
        receiptNumber: receiptNumber,
        invoiceNumber: invoiceNumber,
        items: receiptItems,
        subtotal: subtotal,
        tax: 0,
        total: total,
        paymentMethod: paymentMethod.toUpperCase(),
        date: new Date().toLocaleString(),
        cashierName: cashierName,
        customerName: customerName,
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
      };

      // Sale data for database
      const mockSaleData = {
        id: `sale_${Date.now()}`,
        department_id: selectedDepartmentId,
        cashier_name: cashierName,
        customer_id: selectedCustomerId || null,
        customer_name: customerName,
        payment_method: paymentMethod,
        subtotal: subtotal,
        total: total,
        amount_paid: subtotal,
        change: 0,
        notes: "",
        items: cart,
        created_at: new Date().toISOString(),
        receiptData: receiptData,
      };

      const stockResult = await reduceStock(cart, selectedDepartmentId, isDemoMode);
      if (!stockResult.success) {
        throw new Error("Failed to reduce stock: " + stockResult.error);
      }

      if (isDemoMode) {
        showDemoWarning();
        
        setCurrentReceiptData({
          ...mockSaleData.receiptData,
          isInvoice: hasWholesaleItems,
        });
        
        setShowReceiptDialog(true);
        setCart([]);
        return mockSaleData;
      }

      const { data: insertedSale, error: saleError } = await supabase
        .from("sales")
        .insert([{
          department_id: mockSaleData.department_id,
          cashier_name: mockSaleData.cashier_name,
          customer_id: mockSaleData.customer_id,
          payment_method: mockSaleData.payment_method as "cash" | "card" | "mobile_money" | "credit",
          subtotal: mockSaleData.subtotal,
          total: mockSaleData.total,
          amount_paid: mockSaleData.amount_paid,
          change_amount: mockSaleData.change,
          receipt_number: receiptNumber,
          invoice_number: invoiceNumber,
          is_invoice: hasWholesaleItems,
          remarks: mockSaleData.notes,
          sale_number: receiptNumber,
        }])
        .select()
        .single();

      if (saleError) {
        console.error("Failed to insert sale:", saleError);
        throw new Error("Failed to save sale: " + saleError.message);
      }

      // Get master perfume product ID for scent mixtures
      const { data: masterPerfumeId, error: masterError } = await supabase
        .rpc('get_or_create_master_perfume');
      
      if (masterError) {
        console.error("Failed to get master perfume product:", masterError);
        throw new Error("Failed to get master perfume product: " + masterError.message);
      }

      const saleItemsData = cart.map((item) => ({
        sale_id: insertedSale.id,
        product_id: item.scentMixture ? masterPerfumeId : (item.productId || null),
        service_id: null,
        item_name: item.name,
        name: item.name,
        quantity: item.type === "perfume" && item.totalMl ? item.totalMl : item.quantity,
        unit_price: item.price,
        total: item.subtotal,
        customer_type: item.customerType || null,
        scent_mixture: item.scentMixture || null,
        bottle_cost: item.bottleCost || null,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItemsData);

      if (itemsError) {
        console.error("Failed to insert sale items:", itemsError);
        throw new Error("Failed to save sale items: " + itemsError.message);
      }

      // Auto-save customer scent preferences
      if (mockSaleData.customer_id) {
        try {
          // Extract unique scents from cart items
          const newScents: string[] = [];
          const bottleSizes: string[] = [];
          
          cart.forEach(item => {
            if (item.selectedScents && item.selectedScents.length > 0) {
              item.selectedScents.forEach(s => {
                if (s.scent && !newScents.includes(s.scent)) {
                  newScents.push(s.scent);
                }
              });
            }
            if (item.totalMl) {
              const sizeStr = `${item.totalMl}ml`;
              if (!bottleSizes.includes(sizeStr)) {
                bottleSizes.push(sizeStr);
              }
            }
          });

          if (newScents.length > 0) {
            // Fetch existing preferences
            const { data: existingPrefs } = await supabase
              .from("customer_preferences")
              .select("*")
              .eq("customer_id", mockSaleData.customer_id)
              .maybeSingle();

            const existingScents = existingPrefs?.preferred_scents || [];
            const existingSizes = existingPrefs?.preferred_bottle_sizes || [];
            
            // Merge with existing, keeping unique values
            const mergedScents = [...new Set([...existingScents, ...newScents])];
            const mergedSizes = [...new Set([...existingSizes, ...bottleSizes])];

            if (existingPrefs) {
              // Update existing
              await supabase
                .from("customer_preferences")
                .update({
                  preferred_scents: mergedScents,
                  preferred_bottle_sizes: mergedSizes,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingPrefs.id);
            } else {
              // Insert new
              await supabase
                .from("customer_preferences")
                .insert({
                  customer_id: mockSaleData.customer_id,
                  department_id: selectedDepartmentId,
                  preferred_scents: newScents,
                  preferred_bottle_sizes: bottleSizes,
                });
            }
            console.log("Saved customer scent preferences:", mergedScents);
          }
        } catch (prefError) {
          console.error("Failed to save preferences (non-blocking):", prefError);
          // Don't throw - this is non-blocking
        }
      }

      // Update receipt data with actual receipt number
      mockSaleData.receiptData.receiptNumber = insertedSale.receipt_number;
      mockSaleData.receiptData.invoiceNumber = insertedSale.invoice_number;
      
      // Send invoice email if wholesale and email is provided
      if (hasWholesaleItems && customerEmail) {
        try {
          const { generateInvoiceHTML } = await import("@/utils/invoicePrinter");
          const invoiceData = {
            invoiceNumber: insertedSale.invoice_number || insertedSale.receipt_number,
            items: receiptItems,
            subtotal: subtotal,
            tax: 0,
            total: total,
            paymentMethod: paymentMethod.toUpperCase(),
            date: new Date().toLocaleString(),
            cashierName: cashierName,
            customerName: customerName,
            customerPhone: customerEmail,
            departmentName: "Perfume Department",
            businessInfo: mockSaleData.receiptData.businessInfo,
            paymentTerms: "Payment due within 30 days",
            qrCodeUrl,
          };
          
          const invoiceHTML = generateInvoiceHTML(invoiceData);

          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.functions.invoke("send-invoice-email", {
              body: {
                customerEmail: customerEmail,
                customerName: customerName,
                invoiceHTML: invoiceHTML,
                invoiceNumber: insertedSale.invoice_number || insertedSale.receipt_number,
                total: total,
              },
            });
            toast.success("Invoice sent to customer email!");
          }
        } catch (emailError) {
          console.error("Failed to send invoice email:", emailError);
          toast.error("Sale completed but invoice email failed to send");
        }
      }

      // Set receipt data based on sale type
      if (hasWholesaleItems) {
        setCurrentReceiptData({
          ...mockSaleData.receiptData,
          isInvoice: true,
        });
      } else {
        setCurrentReceiptData(mockSaleData.receiptData);
      }

      return mockSaleData;
    },
    onSuccess: async () => {
      // Invalidate all relevant queries to refresh stock display
      queryClient.invalidateQueries({ queryKey: ["perfume-today-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-today-sales-count"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-recent-sales"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-stock"] });
      queryClient.invalidateQueries({ queryKey: ["popular-scents"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-products"] });
      queryClient.invalidateQueries({ queryKey: ["master-perfume-stock"] });
      queryClient.invalidateQueries({ queryKey: ["scents-with-stock"] });
      queryClient.invalidateQueries({ queryKey: ["oil-perfume-stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["perfume-scents"] });
      queryClient.invalidateQueries({ queryKey: ["total-scent-stock"] });
      
      toast.success("Sale completed successfully!");
      setShowReceiptDialog(true);
      setCart([]);
      setPaymentMethod("cash");
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
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Perfume Point of Sale</h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Create custom perfume blends and process sales
              </p>
            </div>
            <ScentLookupDialog departmentId={selectedDepartmentId}>
              <Button variant="outline" className="gap-2">
                <History className="h-4 w-4" />
                Customer Scent Lookup
              </Button>
            </ScentLookupDialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Perfume Creation Area */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Create Perfume Blend
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Scan barcode to add product..."
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && barcode) {
                          handleBarcodeSearch(barcode);
                        }
                      }}
                      className="pl-10"
                      autoFocus
                    />
                  </div>
                  
                  <Button
                    onClick={() => {
                      setSelectedCustomerId(selectedCustomer);
                      setShowPerfumeRefillDialog(true);
                    }}
                    className="w-full"
                    size="lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Perfume to Cart
                  </Button>
                </CardContent>
              </Card>

              {/* Perfume Products */}
              {perfumeProducts.filter(p => p.tracking_type === 'quantity').length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Perfume Products
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                    {perfumeProducts.filter(p => p.tracking_type === 'quantity').map((product) => {
                      // Use direct retail_price and wholesale_price fields
                      const retailPrice = product.retail_price || product.price;
                      const wholesalePrice = product.wholesale_price || (product.retail_price ? product.retail_price * 0.8 : product.price * 0.8);
                      const currentStock = product.current_stock || product.stock || 0;
                      
                      return (
                        <div key={product.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                          <div className="flex-1">
                            <p className="font-medium">{product.name}</p>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {currentStock} in stock
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Retail: UGX {retailPrice?.toLocaleString()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Wholesale: UGX {wholesalePrice?.toLocaleString()}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (currentStock <= 0) {
                                  toast.error(`${product.name} is out of stock`);
                                  return;
                                }
                                addToCart({
                                  id: `branded-retail-${product.id}-${Date.now()}`,
                                  name: product.name,
                                  price: retailPrice,
                                  quantity: 1,
                                  type: "shop_product",
                                  productId: product.id,
                                  customerType: "retail",
                                  subtotal: retailPrice,
                                  trackingType: "quantity",
                                });
                                toast.success(`${product.name} (Retail) added to cart`);
                              }}
                              disabled={currentStock <= 0}
                            >
                              <ShoppingBag className="w-4 h-4 mr-1" />
                              Retail
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (currentStock <= 0) {
                                  toast.error(`${product.name} is out of stock`);
                                  return;
                                }
                                addToCart({
                                  id: `branded-wholesale-${product.id}-${Date.now()}`,
                                  name: product.name,
                                  price: wholesalePrice,
                                  quantity: 1,
                                  type: "shop_product",
                                  productId: product.id,
                                  customerType: "wholesale",
                                  subtotal: wholesalePrice,
                                  trackingType: "quantity",
                                });
                                toast.success(`${product.name} (Wholesale) added to cart`);
                              }}
                              disabled={currentStock <= 0}
                            >
                              <Package className="w-4 h-4 mr-1" />
                              Wholesale
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Shopping Cart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Shopping Cart ({cart.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {cart.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Cart is empty. Add perfume blends to get started.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            {item.scentMixture && (
                              <p className="text-sm text-muted-foreground">{item.scentMixture}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline">{item.customerType}</Badge>
                              {item.totalMl && (
                                <Badge variant="secondary">{item.totalMl}ml</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold">UGX {item.price.toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">
                                Qty: {item.quantity}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Park Cart Button */}
                  {cart.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowParkDialog(true)}
                      >
                        <PauseCircle className="w-4 h-4 mr-2" />
                        Park Cart
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payment Section */}
            <div className="space-y-4">
              {/* Parked Carts */}
              <ParkedCartsPanel
                parkedCarts={parkedCarts}
                onResume={resumeParkedCart}
                onDelete={deleteParkedCart}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Payment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Customer Name</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div>
                    <Label>Customer Email (for wholesale invoices)</Label>
                    <Input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@email.com"
                    />
                  </div>

                  <div>
                    <Label>Linked Customer (Optional)</Label>
                    <div className="flex gap-2">
                      <Select value={selectedCustomer} onValueChange={(value) => {
                        setSelectedCustomer(value);
                        setSelectedCustomerId(value);
                        const customer = customers.find(c => c.id === value);
                        if (customer) {
                          setCustomerName(customer.name);
                          if (customer.email) setCustomerEmail(customer.email);
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer to see scent history" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} {customer.phone ? `(${customer.phone})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon"
                        onClick={() => setShowNewCustomerDialog(true)}
                        title="Add New Customer"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Customer Purchase History */}
                  {selectedCustomer && selectedDepartmentId && (
                    <CustomerPurchaseHistory
                      customerId={selectedCustomer}
                      departmentId={selectedDepartmentId}
                      onReorder={handleReorder}
                    />
                  )}

                  <div>
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>UGX {total.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleCompleteSale}
                    disabled={cart.length === 0 || completeSaleMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {completeSaleMutation.isPending ? "Processing..." : "Complete Sale"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <PerfumeRefillDialog
        open={showPerfumeRefillDialog}
        onOpenChange={setShowPerfumeRefillDialog}
        perfumeProducts={perfumeProducts}
        customerId={selectedCustomerId}
        onAddToCart={addToCart}
      />

      <ReceiptActionsDialog
        isOpen={showReceiptDialog}
        onClose={() => setShowReceiptDialog(false)}
        receiptData={currentReceiptData}
        isInvoice={currentReceiptData?.isInvoice}
        onEdit={() => setShowEditDialog(true)}
      />

      <ReceiptEditDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        receiptData={currentReceiptData}
      />

      {/* New Customer Dialog */}
      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                placeholder="Enter customer name"
                value={newCustomerData.name}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone Number</Label>
              <Input
                id="customer-phone"
                placeholder="e.g., +256700000000"
                value={newCustomerData.phone}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="customer@email.com"
                value={newCustomerData.email}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-address">Address</Label>
              <Input
                id="customer-address"
                placeholder="Enter customer address"
                value={newCustomerData.address}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewCustomerDialog(false);
                setNewCustomerData({ name: "", phone: "", email: "", address: "" });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCustomer}
              disabled={!newCustomerData.name.trim() || createCustomerMutation.isPending}
            >
              {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No Customer Warning Dialog */}
      <AlertDialog open={showNoCustomerWarning} onOpenChange={setShowNoCustomerWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              No Customer Selected
            </AlertDialogTitle>
            <AlertDialogDescription>
              You haven't linked a customer to this sale. Without selecting a customer, 
              their scent preferences won't be saved and you won't be able to look up 
              their purchase history later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back & Select Customer</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowNoCustomerWarning(false);
              completeSaleMutation.mutate();
            }}>
              Continue Without Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Park Cart Dialog */}
      <Dialog open={showParkDialog} onOpenChange={setShowParkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5" />
              Park Cart
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Park this cart to serve another customer. You can resume it later.
            </p>
            <div>
              <Label>Reason (Optional)</Label>
              <Input
                value={parkReason}
                onChange={(e) => setParkReason(e.target.value)}
                placeholder="e.g., Customer went to get money"
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Cart Summary</p>
              <p className="text-sm text-muted-foreground">
                Customer: {customerName}
              </p>
              <p className="text-sm text-muted-foreground">
                Items: {cart.length} • Total: UGX {total.toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowParkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={parkCurrentCart}>
              <Clock className="h-4 w-4 mr-2" />
              Park Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PerfumePOS;