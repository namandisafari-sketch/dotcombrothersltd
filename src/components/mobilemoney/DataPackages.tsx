import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash, Wifi } from "lucide-react";
import { toast } from "sonner";

interface DataPackage {
  id: string;
  name: string;
  data_amount: number;
  data_unit: 'MB' | 'GB';
  price: number;
  validity_period: 'daily' | 'weekly' | 'monthly';
  is_active: boolean;
  department_id: string;
}

interface DataPackagesProps {
  departmentId: string;
}

export const DataPackages = ({ departmentId }: DataPackagesProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<DataPackage | null>(null);
  
  const [packageForm, setPackageForm] = useState({
    name: "",
    data_amount: 0,
    data_unit: "MB" as 'MB' | 'GB',
    price: 0,
    validity_period: "daily" as 'daily' | 'weekly' | 'monthly',
    is_active: true,
  });

  // Fetch data packages
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["data-packages", departmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_packages")
        .select("*")
        .eq("department_id", departmentId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as DataPackage[];
    },
    enabled: !!departmentId && departmentId.length > 0,
  });

  // Create/Update mutation
  const savePackageMutation = useMutation({
    mutationFn: async (packageData: typeof packageForm) => {
      if (!departmentId || departmentId.length === 0) {
        throw new Error("Department ID is required");
      }
      if (editingPackage) {
        const { error } = await supabase
          .from("data_packages")
          .update(packageData)
          .eq("id", editingPackage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("data_packages")
          .insert([{ ...packageData, department_id: departmentId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-packages"] });
      toast.success(editingPackage ? "Package updated successfully" : "Package created successfully");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete mutation
  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("data_packages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-packages"] });
      toast.success("Package deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const resetForm = () => {
    setPackageForm({
      name: "",
      data_amount: 0,
      data_unit: "MB",
      price: 0,
      validity_period: "daily",
      is_active: true,
    });
    setEditingPackage(null);
  };

  const handleEdit = (pkg: DataPackage) => {
    setEditingPackage(pkg);
    setPackageForm({
      name: pkg.name,
      data_amount: pkg.data_amount,
      data_unit: pkg.data_unit,
      price: pkg.price,
      validity_period: pkg.validity_period,
      is_active: pkg.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!packageForm.name || packageForm.data_amount <= 0 || packageForm.price <= 0) {
      toast.error("Please fill all required fields");
      return;
    }
    savePackageMutation.mutate(packageForm);
  };

  const formatDataAmount = (amount: number, unit: string) => {
    return `${amount}${unit}`;
  };

  const formatValidity = (period: string) => {
    return period.charAt(0).toUpperCase() + period.slice(1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            Data Packages
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Package
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingPackage ? "Edit" : "Add"} Data Package</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Package Name *</Label>
                  <Input
                    id="name"
                    value={packageForm.name}
                    onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                    placeholder="e.g., Daily Bundle"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="data_amount">Data Amount *</Label>
                    <Input
                      id="data_amount"
                      type="number"
                      value={packageForm.data_amount || ""}
                      onChange={(e) => setPackageForm({ ...packageForm, data_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="400"
                    />
                  </div>
                  <div>
                    <Label htmlFor="data_unit">Unit</Label>
                    <Select
                      value={packageForm.data_unit}
                      onValueChange={(value: 'MB' | 'GB') => setPackageForm({ ...packageForm, data_unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MB">MB</SelectItem>
                        <SelectItem value="GB">GB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="price">Price (UGX) *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={packageForm.price || ""}
                    onChange={(e) => setPackageForm({ ...packageForm, price: parseFloat(e.target.value) || 0 })}
                    placeholder="1000"
                  />
                </div>

                <div>
                  <Label htmlFor="validity_period">Validity Period</Label>
                  <Select
                    value={packageForm.validity_period}
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setPackageForm({ ...packageForm, validity_period: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={packageForm.is_active}
                    onChange={(e) => setPackageForm({ ...packageForm, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={savePackageMutation.isPending}>
                    {savePackageMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading packages...</p>
          ) : packages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No data packages yet. Click "Add Package" to create one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package Name</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
                    <TableCell>{formatDataAmount(pkg.data_amount, pkg.data_unit)}</TableCell>
                    <TableCell>{pkg.price.toLocaleString()} UGX</TableCell>
                    <TableCell>{formatValidity(pkg.validity_period)}</TableCell>
                    <TableCell>
                      <Badge variant={pkg.is_active ? "default" : "secondary"}>
                        {pkg.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(pkg)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this package?")) {
                              deletePackageMutation.mutate(pkg.id);
                            }
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
