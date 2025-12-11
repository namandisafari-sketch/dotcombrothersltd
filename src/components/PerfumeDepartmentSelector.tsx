import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useState, useEffect } from "react";

interface PerfumeDepartmentSelectorProps {
  value: string | null;
  onChange: (departmentId: string) => void;
}

export function PerfumeDepartmentSelector({ value, onChange }: PerfumeDepartmentSelectorProps) {
  const { isAdmin, departmentId: userDepartmentId } = useUserRole();

  // Fetch departments that are perfume departments
  const { data: perfumeDepartments = [], isLoading } = useQuery({
    queryKey: ["perfume-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .or("is_perfume_department.eq.true,name.ilike.%perfume%")
        .order("name");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select department for non-admins
  useEffect(() => {
    if (!isAdmin && userDepartmentId && !value) {
      const userDept = perfumeDepartments.find(d => d.id === userDepartmentId);
      if (userDept) {
        onChange(userDepartmentId);
      }
    } else if (isAdmin && perfumeDepartments.length > 0 && !value) {
      // Auto-select first perfume department for admins
      onChange(perfumeDepartments[0].id);
    }
  }, [isAdmin, userDepartmentId, perfumeDepartments, value, onChange]);

  // Only show selector to admins if there are multiple departments
  if (!isAdmin || isLoading || perfumeDepartments.length === 0) return null;
  if (perfumeDepartments.length === 1) {
    // Auto-select the only department
    if (value !== perfumeDepartments[0].id) {
      onChange(perfumeDepartments[0].id);
    }
    return null;
  }

  const selectedDept = perfumeDepartments.find(d => d.id === value);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border">
      <Building2 className="w-4 h-4 text-muted-foreground" />
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="w-[200px] border-0 focus:ring-0 h-8 bg-background">
          <SelectValue>
            {selectedDept?.name || "Select Perfume Department"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="z-50 bg-background">
          {perfumeDepartments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
