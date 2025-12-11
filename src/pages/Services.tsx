import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useUserRole } from "@/hooks/useUserRole";
import { DepartmentSelector } from "@/components/DepartmentSelector";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const Services = () => {
  const queryClient = useQueryClient();
  const { selectedDepartmentId, selectedDepartment } = useDepartment();
  const { isAdmin } = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    base_price: 0,
    material_cost: 0,
    is_negotiable: true,
    description: "",
    department_id: selectedDepartmentId,
  });

  const { data: services } = useQuery({
    queryKey: ["services", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('department_id', selectedDepartmentId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  const { data: categories } = useQuery({
    queryKey: ["service-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'service')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const saveServiceMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate department is selected
      if (!selectedDepartmentId || selectedDepartmentId.length === 0) {
        throw new Error("Please select a department first");
      }

      const dataWithDepartment = {
        ...data,
        department_id: selectedDepartmentId,
        // Convert empty string to null for UUID field
        category_id: data.category_id && data.category_id.length > 0 ? data.category_id : null,
        price: data.base_price, // Ensure price field is set
      };

      if (editingService) {
        const { data: result, error } = await supabase
          .from('services')
          .update(dataWithDepartment)
          .eq('id', editingService.id)
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from('services')
          .insert(dataWithDepartment)
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      toast.success(editingService ? "Service updated" : "Service added");
      setIsDialogOpen(false);
      setEditingService(null);
      setFormData({
        name: "",
        category_id: "",
        base_price: 0,
        material_cost: 0,
        is_negotiable: true,
        description: "",
        department_id: selectedDepartmentId || "",
      });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save service");
    },
  });

  const handleEdit = (service: any) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category_id: service.category_id || "",
      material_cost: service.material_cost || 0,
      base_price: service.base_price,
      is_negotiable: service.is_negotiable,
      description: service.description || "",
      department_id: service.department_id || selectedDepartmentId,
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
              {selectedDepartment?.name || "Services"} - Services
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage printing, design, and other services
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && <DepartmentSelector />}
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    if (!selectedDepartmentId) {
                      toast.error("Please select a department first");
                      return;
                    }
                    setEditingService(null);
                    setFormData({
                      name: "",
                      category_id: "",
                      base_price: 0,
                      material_cost: 0,
                      is_negotiable: true,
                      description: "",
                      department_id: selectedDepartmentId,
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Edit Service" : "Add New Service"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Service Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., A4 Color Printing"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Base Price (UGX) *</Label>
                  <Input
                    type="number"
                    value={formData.base_price}
                    onChange={(e) =>
                      setFormData({ ...formData, base_price: Number(e.target.value) })
                    }
                    placeholder="Starting price"
                  />
                </div>

                {!selectedDepartment?.is_perfume_department && !selectedDepartment?.is_mobile_money && (
                  <div className="space-y-2">
                    <Label>Material Cost (COSO) (UGX)</Label>
                    <Input
                      type="number"
                      value={formData.material_cost}
                      onChange={(e) =>
                        setFormData({ ...formData, material_cost: Number(e.target.value) })
                      }
                      placeholder="Cost of materials used"
                    />
                    <p className="text-xs text-muted-foreground">
                      Cost of Service Offered - total material cost for this service
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between space-y-2">
                  <div className="space-y-0.5">
                    <Label>Price is Negotiable</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow custom pricing during sale
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_negotiable}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_negotiable: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Service details..."
                    rows={3}
                  />
                </div>
              </div>

              <Button
                className="w-full mt-4"
                onClick={() => saveServiceMutation.mutate(formData)}
                disabled={!formData.name || !formData.base_price}
              >
                {editingService ? "Update Service" : "Add Service"}
              </Button>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Available Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {services?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No services added yet. Click "Add Service" to get started.
                </p>
              ) : (
                services?.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{service.name}</p>
                        {service.is_negotiable && (
                          <span className="text-xs px-2 py-1 bg-accent/10 text-accent rounded">
                            Negotiable
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold">
                          UGX {Number(service.base_price).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Base price</p>
                      </div>
                      {!selectedDepartment?.is_perfume_department && !selectedDepartment?.is_mobile_money && service.material_cost > 0 && (
                        <div className="text-right border-l pl-4">
                          <p className="font-medium text-amber-600">
                            UGX {Number(service.material_cost).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Material cost</p>
                        </div>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleEdit(service)}>
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

export default Services;