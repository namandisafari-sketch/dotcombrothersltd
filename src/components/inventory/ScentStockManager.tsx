import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplet, Scale, Plus, Edit, AlertCircle, RefreshCw, Check, ChevronsUpDown, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PERFUME_SCENTS } from "@/constants/perfumeScents";
import { useUserRole } from "@/hooks/useUserRole";

interface ScentStockManagerProps {
  departmentId: string;
}

interface Scent {
  id: string;
  name: string;
  description: string | null;
  stock_ml: number | null;
  empty_bottle_weight_g: number | null;
  current_weight_g: number | null;
  density: number | null;
  is_active: boolean | null;
  department_id: string | null;
}

export function ScentStockManager({ departmentId }: ScentStockManagerProps) {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [selectedScent, setSelectedScent] = useState<Scent | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [addScentDialogOpen, setAddScentDialogOpen] = useState(false);
  const [scentSelectorOpen, setScentSelectorOpen] = useState(false);
  
  // Form states for updating stock
  const [emptyBottleWeight, setEmptyBottleWeight] = useState<string>("");
  const [currentWeight, setCurrentWeight] = useState<string>("");
  const [density, setDensity] = useState<string>("0.9");
  
  // Form states for new scent - now using dropdown selection
  const [newScentName, setNewScentName] = useState("");
  const [newScentDescription, setNewScentDescription] = useState("");
  const [newScentDepartmentId, setNewScentDepartmentId] = useState<string>(departmentId);

  const { data: scents = [], isLoading } = useQuery({
    queryKey: ["scent-stock", departmentId],
    queryFn: async () => {
      // Fetch department-specific scents
      const { data: deptScents, error: deptError } = await supabase
        .from("perfume_scents")
        .select("*")
        .eq("department_id", departmentId)
        .eq("is_active", true);
      
      if (deptError) throw deptError;
      
      // Fetch global scents (null department)
      const { data: globalScents, error: globalError } = await supabase
        .from("perfume_scents")
        .select("*")
        .is("department_id", null)
        .eq("is_active", true);
      
      if (globalError) throw globalError;
      
      const allScents = [...(deptScents || []), ...(globalScents || [])];
      return allScents.sort((a, b) => a.name.localeCompare(b.name)) as Scent[];
    },
    enabled: !!departmentId,
    refetchInterval: 5000,
  });

  // Fetch departments for admin dropdown
  const { data: departments = [] } = useQuery({
    queryKey: ["perfume-departments-for-scents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .or("is_perfume_department.eq.true,name.ilike.%perfume%")
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Calculate ML from weight
  const calculateMl = (emptyWeight: number, currentWeight: number, density: number) => {
    if (currentWeight <= emptyWeight) return 0;
    const weightDifference = currentWeight - emptyWeight; // grams of perfume
    const ml = weightDifference / density; // convert to ml
    return Math.round(ml * 10) / 10; // round to 1 decimal
  };

  const calculatedMl = emptyBottleWeight && currentWeight && density
    ? calculateMl(parseFloat(emptyBottleWeight), parseFloat(currentWeight), parseFloat(density))
    : 0;

  // Update scent stock mutation
  const updateStockMutation = useMutation({
    mutationFn: async ({ scentId, stockMl, emptyWeight, currWeight, dens }: {
      scentId: string;
      stockMl: number;
      emptyWeight: number;
      currWeight: number;
      dens: number;
    }) => {
      const { error } = await supabase
        .from("perfume_scents")
        .update({
          stock_ml: stockMl,
          empty_bottle_weight_g: emptyWeight,
          current_weight_g: currWeight,
          density: dens,
        })
        .eq("id", scentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scent stock updated successfully");
      queryClient.invalidateQueries({ queryKey: ["scent-stock", departmentId] });
      setUpdateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      console.error("Error updating stock:", error);
      toast.error("Failed to update stock");
    },
  });

  // Add new scent mutation
  const addScentMutation = useMutation({
    mutationFn: async () => {
      // Use null for global scent if "global" is selected
      const targetDepartmentId = newScentDepartmentId === "global" ? null : newScentDepartmentId;
      
      const { error } = await supabase
        .from("perfume_scents")
        .insert({
          name: newScentName,
          description: newScentDescription || null,
          department_id: targetDepartmentId,
          stock_ml: 0,
          empty_bottle_weight_g: 0,
          current_weight_g: 0,
          density: 0.9,
          is_active: true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scent added successfully");
      queryClient.invalidateQueries({ queryKey: ["scent-stock", departmentId] });
      setAddScentDialogOpen(false);
      setNewScentName("");
      setNewScentDescription("");
      setNewScentDepartmentId(departmentId);
    },
    onError: (error) => {
      console.error("Error adding scent:", error);
      toast.error("Failed to add scent");
    },
  });

  const resetForm = () => {
    setSelectedScent(null);
    setEmptyBottleWeight("");
    setCurrentWeight("");
    setDensity("0.9");
  };

  const openUpdateDialog = (scent: Scent) => {
    setSelectedScent(scent);
    setEmptyBottleWeight(scent.empty_bottle_weight_g?.toString() || "");
    setCurrentWeight(scent.current_weight_g?.toString() || "");
    setDensity(scent.density?.toString() || "0.9");
    setUpdateDialogOpen(true);
  };

  const handleUpdateStock = () => {
    if (!selectedScent) return;
    
    const emptyWeight = parseFloat(emptyBottleWeight) || 0;
    const currWeight = parseFloat(currentWeight) || 0;
    const dens = parseFloat(density) || 0.9;
    
    if (emptyWeight <= 0) {
      toast.error("Please enter a valid empty bottle weight");
      return;
    }
    
    if (currWeight < emptyWeight) {
      toast.error("Current weight must be greater than empty bottle weight");
      return;
    }
    
    const stockMl = calculateMl(emptyWeight, currWeight, dens);
    
    updateStockMutation.mutate({
      scentId: selectedScent.id,
      stockMl,
      emptyWeight,
      currWeight,
      dens,
    });
  };

  const totalStockMl = scents.reduce((sum, s) => sum + (s.stock_ml || 0), 0);
  const lowStockScents = scents.filter(s => (s.stock_ml || 0) < 100);

  if (isLoading) {
    return <div className="animate-pulse h-48 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplet className="w-5 h-5 text-primary" />
              Scent Stock Overview
            </CardTitle>
            <Button size="sm" onClick={() => setAddScentDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Scent
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{scents.length}</p>
              <p className="text-xs text-muted-foreground">Total Scents</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{totalStockMl.toLocaleString()} ml</p>
              <p className="text-xs text-muted-foreground">Total Stock</p>
            </div>
            <div className="text-center p-3 bg-destructive/10 rounded-lg">
              <p className="text-2xl font-bold text-destructive">{lowStockScents.length}</p>
              <p className="text-xs text-muted-foreground">Low Stock (&lt;100ml)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      {lowStockScents.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="font-medium text-destructive">Low Stock Scents</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockScents.map(s => (
                <Badge key={s.id} variant="destructive">
                  {s.name}: {s.stock_ml || 0}ml
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scent Stock List */}
      <ScrollArea className="h-[400px]">
        <div className="grid gap-3">
          {scents.map((scent) => {
            const stockPercent = Math.min(100, ((scent.stock_ml || 0) / 500) * 100);
            const isLowStock = (scent.stock_ml || 0) < 100;
            
            return (
              <Card 
                key={scent.id} 
                className={cn(
                  "transition-colors",
                  isLowStock && "border-destructive/50"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{scent.name}</h4>
                        {!scent.department_id && (
                          <Badge variant="outline" className="text-xs">
                            <Globe className="w-3 h-3 mr-1" />
                            Global
                          </Badge>
                        )}
                      </div>
                      {scent.description && (
                        <p className="text-xs text-muted-foreground">{scent.description}</p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => openUpdateDialog(scent)}
                    >
                      <Scale className="w-4 h-4 mr-1" />
                      Update
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className={cn(isLowStock && "text-destructive font-medium")}>
                        {(scent.stock_ml || 0).toLocaleString()} ml
                      </span>
                      {scent.empty_bottle_weight_g && scent.current_weight_g && (
                        <span className="text-xs text-muted-foreground">
                          Bottle: {scent.empty_bottle_weight_g}g → {scent.current_weight_g}g
                        </span>
                      )}
                    </div>
                    <Progress 
                      value={stockPercent} 
                      className={cn(
                        "h-2",
                        isLowStock && "[&>div]:bg-destructive"
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {scents.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Droplet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No scents configured yet</p>
                <Button className="mt-4" onClick={() => setAddScentDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Add First Scent
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Update Stock Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Update Stock for {selectedScent?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Empty Bottle Weight (grams)</Label>
              <Input
                type="number"
                placeholder="e.g., 250"
                value={emptyBottleWeight}
                onChange={(e) => setEmptyBottleWeight(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Weight of the storage container when empty
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Current Weight (grams)</Label>
              <Input
                type="number"
                placeholder="e.g., 850"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Current weight of container with perfume
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Density (g/ml)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.9"
                value={density}
                onChange={(e) => setDensity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Perfume oil density (typically 0.85-0.95)
              </p>
            </div>
            
            {calculatedMl > 0 && (
              <Card className="bg-primary/10 border-primary/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Calculated Stock</p>
                  <p className="text-3xl font-bold text-primary">{calculatedMl} ml</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ({parseFloat(currentWeight) - parseFloat(emptyBottleWeight)}g ÷ {density} = {calculatedMl}ml)
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateStock}
              disabled={updateStockMutation.isPending || calculatedMl <= 0}
            >
              {updateStockMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : null}
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Scent Dialog */}
      <Dialog open={addScentDialogOpen} onOpenChange={setAddScentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Scent to Inventory</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Scent *</Label>
              <Popover open={scentSelectorOpen} onOpenChange={setScentSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={scentSelectorOpen}
                    className="w-full justify-between"
                  >
                    {newScentName || "Search and select a scent..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search scents..." />
                    <CommandList>
                      <CommandEmpty>No scent found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-y-auto">
                        {PERFUME_SCENTS
                          .filter(scent => !scents.some(s => s.name.toLowerCase() === scent.toLowerCase()))
                          .map((scent) => (
                            <CommandItem
                              key={scent}
                              value={scent}
                              onSelect={() => {
                                setNewScentName(scent);
                                setScentSelectorOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newScentName === scent ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {scent}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                {PERFUME_SCENTS.length - scents.length} scents available to add
              </p>
            </div>

            {/* Department selector for admins */}
            {isAdmin && (
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={newScentDepartmentId} onValueChange={setNewScentDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Global (All Departments)
                      </div>
                    </SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Global scents are available to all perfume departments
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g., Woody, smoky notes"
                value={newScentDescription}
                onChange={(e) => setNewScentDescription(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddScentDialogOpen(false); setNewScentName(""); setNewScentDepartmentId(departmentId); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => addScentMutation.mutate()}
              disabled={addScentMutation.isPending || !newScentName.trim()}
            >
              Add Scent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
