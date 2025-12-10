import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface DepartmentContextType {
  selectedDepartmentId: string | null;
  setSelectedDepartmentId: (id: string | null) => void;
  departments: any[];
  isLoading: boolean;
  selectedDepartment: any | null;
  isPerfumeDepartment: boolean;
  isMobileMoneyDepartment: boolean;
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { isAdmin, departmentId: userDepartmentId } = useUserRole();
  const [selectedDepartmentId, setSelectedDepartmentIdInternal] = useState<string | null>(null);

  // Wrapper to prevent non-admins from changing department
  const setSelectedDepartmentId = (deptId: string | null) => {
    if (!isAdmin && userDepartmentId) {
      // Non-admins are locked to their assigned department
      return;
    }
    setSelectedDepartmentIdInternal(deptId);
  };

  // Fetch all departments (excluding mobile money and perfume departments)
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).filter((d: any) => !d.is_mobile_money && !d.is_perfume_department);
    },
  });

  // Auto-assign department based on user's profile
  useEffect(() => {
    if (isAdmin && departments.length > 0 && !selectedDepartmentId) {
      // Admins can switch departments - only auto-assign if nothing is selected
      const savedDept = localStorage.getItem("selectedDepartmentId");
      
      // Validate saved department isn't mobile money or perfume
      const validDept = departments.find(d => d.id === savedDept);
      
      if (validDept) {
        setSelectedDepartmentIdInternal(savedDept);
      } else {
        // Clear invalid saved department
        localStorage.removeItem("selectedDepartmentId");
        setSelectedDepartmentIdInternal(departments[0].id);
      }
    } else if (userDepartmentId && !selectedDepartmentId) {
      // Non-admins are LOCKED to their assigned department
      // But only if it's not a mobile money or perfume department
      const userDept = departments.find(d => d.id === userDepartmentId);
      if (userDept) {
        setSelectedDepartmentIdInternal(userDepartmentId);
      }
    }
  }, [isAdmin, userDepartmentId, departments]);

  // Save admin's selection to localStorage
  useEffect(() => {
    if (isAdmin && selectedDepartmentId) {
      localStorage.setItem("selectedDepartmentId", selectedDepartmentId);
    }
  }, [isAdmin, selectedDepartmentId]);

  const selectedDepartment = departments.find(d => d.id === selectedDepartmentId) || null;
  const isPerfumeDepartment = selectedDepartment?.name?.toUpperCase().includes("PERFUME") || false;
  const isMobileMoneyDepartment = selectedDepartment?.is_mobile_money === true;

  return (
    <DepartmentContext.Provider
      value={{
        selectedDepartmentId,
        setSelectedDepartmentId,
        departments,
        isLoading,
        selectedDepartment,
        isPerfumeDepartment,
        isMobileMoneyDepartment,
      }}
    >
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment() {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    throw new Error("useDepartment must be used within a DepartmentProvider");
  }
  return context;
}