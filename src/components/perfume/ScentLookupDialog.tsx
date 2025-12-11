import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Droplet, User, Phone, Receipt, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  department_id: string | null;
}

interface ScentLookupDialogProps {
  departmentId?: string;
  children?: React.ReactNode;
}

export function ScentLookupDialog({ departmentId, children }: ScentLookupDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [searchReceipt, setSearchReceipt] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [scentData, setScentData] = useState<any>(null);

  const resetState = () => {
    setSearchTerm("");
    setSearchPhone("");
    setSearchReceipt("");
    setCustomers([]);
    setSelectedCustomer(null);
    setScentData(null);
  };

  const searchCustomers = async () => {
    if (!searchTerm.trim() && !searchPhone.trim() && !searchReceipt.trim()) {
      toast.error("Please enter name, phone, or receipt number");
      return;
    }

    try {
      setLoading(true);
      setSelectedCustomer(null);
      setScentData(null);

      let query = supabase.from("customers").select("id, name, phone, department_id");

      if (searchTerm.trim()) {
        query = query.ilike("name", `%${searchTerm}%`);
      }

      if (searchPhone.trim()) {
        query = query.ilike("phone", `%${searchPhone}%`);
      }

      if (departmentId) {
        query = query.eq("department_id", departmentId);
      }

      const { data: results, error } = await query.limit(10);

      if (error) throw error;

      let finalResults = results || [];

      // Search by receipt if no results
      if (searchReceipt.trim() && finalResults.length === 0) {
        const { data: salesData, error: salesError } = await supabase
          .from("sales")
          .select("customer_id, customers(id, name, phone, department_id)")
          .ilike("receipt_number", `%${searchReceipt.trim()}%`)
          .limit(1)
          .maybeSingle();

        if (!salesError && salesData?.customers) {
          finalResults = [salesData.customers as any];
        }
      }

      setCustomers(finalResults);

      if (finalResults.length === 0) {
        toast.info("No customers found");
      } else if (finalResults.length === 1) {
        // Auto-select if only one result
        setSelectedCustomer(finalResults[0]);
        fetchScentHistory(finalResults[0]);
      }
    } catch (error) {
      console.error("Error searching:", error);
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchScentHistory = async (customer: Customer) => {
    try {
      setLoadingHistory(true);

      // First fetch sales for this customer
      const { data: customerSales, error: salesError } = await supabase
        .from("sales")
        .select("id, receipt_number, created_at")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (salesError) throw salesError;

      let purchases: any[] = [];

      if (customerSales && customerSales.length > 0) {
        const saleIds = customerSales.map(s => s.id);
        
        // Fetch sale_items with scent_mixture for these sales
        const { data: items, error: itemsError } = await supabase
          .from("sale_items")
          .select("id, item_name, name, scent_mixture, ml_amount, quantity, created_at, sale_id")
          .in("sale_id", saleIds)
          .not("scent_mixture", "is", null)
          .order("created_at", { ascending: false })
          .limit(10);

        if (itemsError) throw itemsError;

        // Map items with their sales data
        purchases = (items || []).map(item => ({
          ...item,
          sales: customerSales.find(s => s.id === item.sale_id)
        }));
      }

      // Also fetch preferences
      const { data: preferences } = await supabase
        .from("customer_preferences")
        .select("*")
        .eq("customer_id", customer.id)
        .maybeSingle();

      setScentData({
        purchases,
        preferences,
      });

      if (purchases.length === 0) {
        toast.info("No scent history found for this customer");
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      toast.error("Failed to fetch scent history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchScentHistory(customer);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Scent Lookup
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5 text-primary" />
            Customer Scent Lookup
          </DialogTitle>
          <DialogDescription>
            Search for a customer to see their previous scent mixtures
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Form */}
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="name" className="text-xs">
                  <User className="h-3 w-3 inline mr-1" />
                  Name
                </Label>
                <Input
                  id="name"
                  placeholder="Customer name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchCustomers()}
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs">
                  <Phone className="h-3 w-3 inline mr-1" />
                  Phone
                </Label>
                <Input
                  id="phone"
                  placeholder="Phone number..."
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchCustomers()}
                />
              </div>
              <div>
                <Label htmlFor="receipt" className="text-xs">
                  <Receipt className="h-3 w-3 inline mr-1" />
                  Receipt
                </Label>
                <Input
                  id="receipt"
                  placeholder="Receipt #..."
                  value={searchReceipt}
                  onChange={(e) => setSearchReceipt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchCustomers()}
                />
              </div>
            </div>
            <Button onClick={searchCustomers} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
          </div>

          {/* Customer Results */}
          {customers.length > 1 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Customer:</Label>
              <div className="grid gap-2 max-h-32 overflow-y-auto">
                {customers.map((customer) => (
                  <Button
                    key={customer.id}
                    variant={selectedCustomer?.id === customer.id ? "default" : "outline"}
                    size="sm"
                    className="justify-start"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <User className="h-3 w-3 mr-2" />
                    {customer.name}
                    {customer.phone && (
                      <span className="text-xs ml-2 opacity-70">({customer.phone})</span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Loading History */}
          {loadingHistory && (
            <div className="text-center py-6">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Loading scent history...</p>
            </div>
          )}

          {/* Scent History Results */}
          {scentData && !loadingHistory && selectedCustomer && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedCustomer.name}</span>
                {selectedCustomer.phone && (
                  <span className="text-sm text-muted-foreground">• {selectedCustomer.phone}</span>
                )}
              </div>

              {scentData.purchases.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-primary">Previous Scent Mixtures:</Label>
                  {scentData.purchases.map((purchase: any, index: number) => (
                    <Card key={purchase.id} className={index === 0 ? "border-primary bg-primary/5" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Droplet className={`h-4 w-4 ${index === 0 ? "text-primary" : "text-muted-foreground"}`} />
                            <span className="font-medium text-sm">
                              {purchase.item_name || purchase.name}
                            </span>
                            {index === 0 && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                Latest
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(purchase.sales?.created_at || purchase.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {purchase.scent_mixture && (
                          <div className="bg-background rounded p-2 border text-sm">
                            <span className="font-medium text-primary">Scent:</span>{" "}
                            {purchase.scent_mixture}
                          </div>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {purchase.ml_amount && <span>Amount: {purchase.ml_amount}ml</span>}
                          {purchase.sales?.receipt_number && (
                            <span>Receipt: {purchase.sales.receipt_number}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Droplet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No previous scent purchases found</p>
                </div>
              )}

              {/* Preferences */}
              {scentData.preferences?.preferred_scents?.length > 0 && (
                <div className="pt-2 border-t">
                  <Label className="text-sm font-medium">Preferred Scents:</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {scentData.preferences.preferred_scents.map((scent: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                        {scent}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
