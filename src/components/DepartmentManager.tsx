import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, Plus, Pencil, Trash2, Smartphone, Droplets, Package } from "lucide-react";
import { toast } from "sonner";

type DepartmentType = "other" | "perfume" | "mobile_money";

export function DepartmentManager() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [deletingDept, setDeletingDept] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    department_type: "other" as DepartmentType,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  // Helper to convert department_type to database fields
  const getDepartmentFields = (type: DepartmentType) => ({
    is_perfume_department: type === "perfume",
    is_mobile_money: type === "mobile_money",
  });

  // Helper to get department type from database fields
  const getDepartmentType = (dept: any): DepartmentType => {
    if (dept.is_perfume_department) return "perfume";
    if (dept.is_mobile_money) return "mobile_money";
    return "other";
  };

  const addDepartment = useMutation({
    mutationFn: async (dept: typeof formData) => {
      const { error } = await supabase.from("departments").insert({
        name: dept.name,
        description: dept.description,
        ...getDepartmentFields(dept.department_type),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department added successfully");
      setShowAddForm(false);
      setFormData({ name: "", description: "", department_type: "other" });
    },
    onError: () => {
      toast.error("Failed to add department");
    },
  });

  const updateDepartment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("departments").update({
        name: data.name,
        description: data.description,
        ...getDepartmentFields(data.department_type),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department updated successfully");
      setEditingDept(null);
    },
    onError: () => {
      toast.error("Failed to update department");
    },
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department deleted successfully");
      setDeletingDept(null);
    },
    onError: () => {
      toast.error("Failed to delete department");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Departments
        </CardTitle>
        <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
            <div>
              <Label>Department Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Electronics, Clothing, etc."
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Department description..."
              />
            </div>
            <div className="space-y-3">
              <Label>Department Type</Label>
              <RadioGroup 
                value={formData.department_type} 
                onValueChange={(value) => setFormData({ ...formData, department_type: value as DepartmentType })}
                className="grid grid-cols-3 gap-2"
              >
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="other" id="type_other" />
                  <Label htmlFor="type_other" className="cursor-pointer flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    General
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="perfume" id="type_perfume" />
                  <Label htmlFor="type_perfume" className="cursor-pointer flex items-center gap-2">
                    <Droplets className="w-4 h-4" />
                    Perfume
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="mobile_money" id="type_mobile_money" />
                  <Label htmlFor="type_mobile_money" className="cursor-pointer flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    Mobile Money
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addDepartment.mutate(formData)}>Add Department</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments?.map((dept) => (
            <div key={dept.id} className="p-4 border rounded-lg space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{dept.name}</h3>
                  {dept.description && (
                    <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {dept.is_mobile_money && (
                      <Badge variant="secondary" className="text-xs">Mobile Money</Badge>
                    )}
                    {dept.is_perfume_department && (
                      <Badge variant="outline" className="text-xs">Perfume</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingDept(dept);
                    setFormData({ 
                      name: dept.name, 
                      description: dept.description || "",
                      department_type: getDepartmentType(dept),
                    });
                  }}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeletingDept(dept)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {!departments?.length && !showAddForm && (
            <div className="col-span-full text-center text-muted-foreground py-8">
              No departments created yet. Add your first department.
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingDept} onOpenChange={() => setEditingDept(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
              <DialogDescription>
                Update department name, description, and settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Department Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Electronics, Clothing, etc."
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Department description..."
                />
              </div>
              <div className="space-y-3">
                <Label>Department Type</Label>
                <RadioGroup 
                  value={formData.department_type} 
                  onValueChange={(value) => setFormData({ ...formData, department_type: value as DepartmentType })}
                  className="grid grid-cols-3 gap-2"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="other" id="edit_type_other" />
                    <Label htmlFor="edit_type_other" className="cursor-pointer flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      General
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="perfume" id="edit_type_perfume" />
                    <Label htmlFor="edit_type_perfume" className="cursor-pointer flex items-center gap-2">
                      <Droplets className="w-4 h-4" />
                      Perfume
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="mobile_money" id="edit_type_mobile_money" />
                    <Label htmlFor="edit_type_mobile_money" className="cursor-pointer flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Mobile Money
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingDept(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editingDept) {
                      updateDepartment.mutate({ id: editingDept.id, data: formData });
                    }
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingDept} onOpenChange={() => setDeletingDept(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the department "{deletingDept?.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingDept) {
                    deleteDepartment.mutate(deletingDept.id);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
