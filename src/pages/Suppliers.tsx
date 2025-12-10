import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Building2, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const Suppliers = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const saveSupplierMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingSupplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(data)
          .eq("id", editingSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingSupplier ? "Supplier updated" : "Supplier added");
      setIsDialogOpen(false);
      setEditingSupplier(null);
      setFormData({ name: "", contact_person: "", phone: "", email: "", address: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to save supplier: ${error.message}`);
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier deleted");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to delete supplier: ${error.message}`);
    },
  });

  const handleEdit = (supplier: any) => {
    if (!isAdmin) {
      toast.error("Only admins can edit suppliers");
      return;
    }
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (supplierId: string) => {
    if (!isAdmin) {
      toast.error("Only admins can delete suppliers");
      return;
    }
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      deleteSupplierMutation.mutate(supplierId);
    }
  };

  const handleAddNew = () => {
    if (!isAdmin) {
      toast.error("Only admins can add suppliers");
      return;
    }
    setEditingSupplier(null);
    setFormData({ name: "", contact_person: "", phone: "", email: "", address: "", notes: "" });
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 pt-24">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Suppliers</h1>
            <p className="text-muted-foreground">Manage your product suppliers and vendors</p>
          </div>
          {isAdmin && (
            <Button onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Loading suppliers...
            </CardContent>
          </Card>
        ) : suppliers && suppliers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((supplier: any) => (
              <Card key={supplier.id}>
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <span>{supplier.name}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(supplier)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(supplier.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {supplier.contact_person && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Contact:</span>
                      <span className="text-muted-foreground">{supplier.contact_person}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">{supplier.address}</span>
                    </div>
                  )}
                  {supplier.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">{supplier.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No suppliers found</p>
              {isAdmin && (
                <Button onClick={handleAddNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Supplier
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., ABC Wholesale"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="e.g., John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +256 700 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g., supplier@example.com"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., 123 Main St, Kampala"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional information about the supplier"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveSupplierMutation.mutate(formData)} disabled={!formData.name}>
                {editingSupplier ? "Update Supplier" : "Add Supplier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Suppliers;