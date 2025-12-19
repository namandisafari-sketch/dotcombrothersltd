import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseClient as supabase } from "@/lib/supabase";
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

  // Fetch all departments (admins can see all, others see filtered)
  const { data: allDepartments = [], isLoading } = useQuery({
    queryKey: ["all-departments-context"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Filter departments for non-admin usage (exclude mobile money and perfume)
  const departments = allDepartments.filter((d: any) => !d.is_mobile_money && !d.is_perfume_department);

  // Auto-assign department based on user's profile
  useEffect(() => {
    if (isAdmin && allDepartments.length > 0 && !selectedDepartmentId) {
      // Admins can switch departments - only auto-assign if nothing is selected
      const savedDept = localStorage.getItem("selectedDepartmentId");
      
      // Validate saved department exists
      const validDept = allDepartments.find(d => d.id === savedDept);
      
      if (validDept) {
        setSelectedDepartmentIdInternal(savedDept);
      } else {
        // Clear invalid saved department and use first regular department
        localStorage.removeItem("selectedDepartmentId");
        const firstRegularDept = departments[0] || allDepartments[0];
        if (firstRegularDept) {
          setSelectedDepartmentIdInternal(firstRegularDept.id);
        }
      }
    } else if (userDepartmentId && !selectedDepartmentId) {
      // Non-admins are LOCKED to their assigned department
      setSelectedDepartmentIdInternal(userDepartmentId);
    }
  }, [isAdmin, userDepartmentId, allDepartments, departments]);

  // Save admin's selection to localStorage
  useEffect(() => {
    if (isAdmin && selectedDepartmentId) {
      localStorage.setItem("selectedDepartmentId", selectedDepartmentId);
    }
  }, [isAdmin, selectedDepartmentId]);

  const selectedDepartment = allDepartments.find(d => d.id === selectedDepartmentId) || null;
  // Use database flags only - don't rely on name matching
  const isPerfumeDepartment = selectedDepartment?.is_perfume_department === true;
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