import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Trash2, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PERFUME_SCENTS } from "@/constants/perfumeScents";
import { useAuth } from "@/contexts/AuthContext";

export default function ScentManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newScentName, setNewScentName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch custom scents from database
  const { data: customScents } = useQuery({
    queryKey: ["custom-scents"],
    queryFn: async () => {
      const { data } = await supabase.from("perfume_scents").select("*").order("name");
      return data || [];
    },
  });

  const addScentMutation = useMutation({
    mutationFn: async (scentName: string) => {
      const trimmedName = scentName.trim().toUpperCase();
      
      if (!trimmedName) throw new Error("Scent name cannot be empty");
      if (PERFUME_SCENTS.includes(trimmedName)) throw new Error("This scent already exists in the default list");
      const exists = customScents?.some(s => s.name.toUpperCase() === trimmedName);
      if (exists) throw new Error("This scent already exists in custom scents");

      const { error } = await supabase.from("perfume_scents").insert({ name: trimmedName });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scent added successfully");
      setNewScentName("");
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["custom-scents"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add scent");
    },
  });

  const deleteScentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("perfume_scents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scent deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["custom-scents"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete scent");
    },
  });

  const toggleStockStatusMutation = useMutation({
    mutationFn: async ({ scentName, isOutOfStock, existingId }: { scentName: string; isOutOfStock: boolean; existingId?: string }) => {
      if (existingId) {
        const { error } = await supabase.from("perfume_scents").update({ is_active: !isOutOfStock }).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("perfume_scents").insert({ name: scentName, is_active: !isOutOfStock });
        if (error) throw error;
      }
    },
    onSuccess: (_, { isOutOfStock }) => {
      toast.success(isOutOfStock ? "Scent marked as out of stock" : "Scent marked as available");
      queryClient.invalidateQueries({ queryKey: ["custom-scents"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update scent status");
    },
  });

  const allScents = [
    ...PERFUME_SCENTS,
    ...(customScents?.map(s => s.name) || [])
  ].sort();

  const filteredScents = searchQuery
    ? allScents.filter(scent => scent.toLowerCase().includes(searchQuery.toLowerCase()))
    : allScents;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <main className="max-w-7xl mx-auto space-y-6">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            Scent Manager
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage perfume scent names and mark scents that are out of stock with red flags
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Scents ({allScents.length})</CardTitle>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Scent
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search scents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="flex flex-wrap gap-2 max-h-[600px] overflow-y-auto p-4 border rounded-lg bg-muted/20">
                {filteredScents.map((scent) => {
                  const customScent = customScents?.find(s => s.name === scent);
                  const isCustom = !!customScent;
                  const isOutOfStock = customScent ? !customScent.is_active : false;
                  
                  return (
                    <Badge
                      key={scent}
                      variant={isOutOfStock ? "destructive" : (isCustom ? "default" : "secondary")}
                      className="text-xs py-1.5 px-3 flex items-center gap-2"
                    >
                      {isOutOfStock && <AlertCircle className="w-3 h-3" />}
                      {scent}
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={() => {
                            toggleStockStatusMutation.mutate({
                              scentName: scent,
                              isOutOfStock: !isOutOfStock,
                              existingId: customScent?.id,
                            });
                          }}
                          className="hover:opacity-70"
                          title={isOutOfStock ? "Mark as available" : "Mark as out of stock"}
                        >
                          <AlertCircle className={`w-3 h-3 ${isOutOfStock ? '' : 'text-muted-foreground'}`} />
                        </button>
                        {isCustom && customScent && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${scent}"?`)) {
                                deleteScentMutation.mutate(customScent.id);
                              }
                            }}
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </Badge>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="destructive" className="h-5 w-5 flex items-center justify-center p-0">
                  <AlertCircle className="w-3 h-3" />
                </Badge>
                <span>Out of Stock</span>
                <Badge variant="default" className="h-5 w-5 ml-4" />
                <span>Custom Scents ({customScents?.length || 0})</span>
                <Badge variant="secondary" className="h-5 w-5 ml-4" />
                <span>Default Scents ({PERFUME_SCENTS.length})</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Scent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Scent Name</Label>
              <Input
                value={newScentName}
                onChange={(e) => setNewScentName(e.target.value)}
                placeholder="Enter scent name (e.g., JASMINE ROSE)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addScentMutation.mutate(newScentName);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Name will be automatically converted to uppercase
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => addScentMutation.mutate(newScentName)}
              disabled={!newScentName.trim() || addScentMutation.isPending}
            >
              {addScentMutation.isPending ? "Adding..." : "Add Scent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
