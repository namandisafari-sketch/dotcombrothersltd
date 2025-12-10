import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useDepartment } from "@/contexts/DepartmentContext";
import { DepartmentSelector } from "@/components/DepartmentSelector";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, User } from "lucide-react";
import { toast } from "sonner";
import { customerSchema } from "@/lib/validation";

const Customers = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const { selectedDepartmentId, selectedDepartment } = useDepartment();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  const saveCustomerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const validated = customerSchema.parse(data);
      const customerData = {
        name: validated.name,
        email: validated.email ?? null,
        phone: validated.phone ?? null,
        address: validated.address ?? null,
        department_id: selectedDepartmentId,
      };
      
      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(customerData)
          .eq("id", editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customers")
          .insert(customerData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCustomer ? "Customer updated" : "Customer added");
      setIsDialogOpen(false);
      setEditingCustomer(null);
      setFormData({ name: "", phone: "", email: "", address: "" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save customer");
    },
  });

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 pt-24">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-2xl sm:text-3xl font-bold">
              {selectedDepartment?.name || "Customers"}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">Manage customer information and balances</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {isAdmin && <DepartmentSelector />}
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCustomer ? "Edit Customer" : "Add New Customer"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Customer Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+256..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Physical address"
                    />
                  </div>
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={() => saveCustomerMutation.mutate(formData)}
                  disabled={!formData.name}
                >
                  {editingCustomer ? "Update Customer" : "Add Customer"}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Customer List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {customers?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No customers yet. Add your first customer to get started.
                </p>
              ) : (
                customers?.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {customer.phone} {customer.email && `• ${customer.email}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Balance</p>
                        <p className="font-bold">
                          UGX {Number(customer.balance || 0).toLocaleString()}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(customer)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Customers;