import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, ShoppingCart, Package, Wrench, FileText, Settings, Users, LogOut, Shield, Smartphone, BarChart, UserCog, PackagePlus, Calculator, AlertTriangle, Receipt, Package2, History, BookOpen, Barcode, TrendingUp, Sparkles, DollarSign, Droplet, BarChart3, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import logo from "@/assets/logo.png";
import { useUserRole } from "@/hooks/useUserRole";
import { ThemeToggle } from "./ThemeToggle";
import { useDepartment } from "@/contexts/DepartmentContext";

type NavItem = {
  path: string;
  icon: any;
  label: string;
  adminOnly?: boolean;
  departments?: string[];
};

const Navigation = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin, departmentId } = useUserRole();
  const { isPerfumeDepartment } = useDepartment();

  // Fetch user's navigation permissions
  const { data: userNavPermissions = [] } = useQuery({
    queryKey: ["user-nav-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("nav_permissions")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;
        return data?.nav_permissions || [];
      } catch (error) {
        console.error("Error fetching nav permissions:", error);
        return [];
      }
    },
    enabled: !!user?.id
  });

  // Get department info  
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const currentDepartment = departments?.find(d => d.id === departmentId);
  const departmentName = currentDepartment?.name?.toLowerCase() || "";

  // Define all possible navigation items with department restrictions
  const allNavItems: NavItem[] = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", adminOnly: true },
    { path: "/appointments", icon: Calendar, label: "Appointments", departments: ["general"] },
    { path: "/sales", icon: ShoppingCart, label: "Sales", departments: ["general"] },
    { path: "/sales-history", icon: History, label: "Sales History", departments: ["general"] },
    { path: "/inventory", icon: Package, label: "Inventory", departments: ["general"] },
    { path: "/bundle-guide", icon: BookOpen, label: "Bundle Guide", departments: ["general"] },
    { path: "/barcode-generator", icon: Barcode, label: "Barcode Gen", departments: ["general"] },
    { path: "/services", icon: Wrench, label: "Services", departments: ["general"] },
    { path: "/customers", icon: Users, label: "Customers", departments: ["general"] },
    { path: "/reconcile", icon: Calculator, label: "Reconcile", departments: ["general"] },
    { path: "/internal-usage", icon: Package2, label: "Internal Usage", departments: ["general", "mobile money", "perfume"] },
    { path: "/expenses", icon: Receipt, label: "Expenses", departments: ["general"] },
    { path: "/suspended-revenue", icon: AlertTriangle, label: "Suspended Revenue", departments: ["general", "perfume", "mobile money"] },
    { path: "/mobile-money", icon: Smartphone, label: "Mobile Money", departments: ["mobile money"] },
    { path: "/analytics", icon: BarChart, label: "Analytics", adminOnly: true },
    { path: "/perfume-dashboard", icon: LayoutDashboard, label: "My Shop", departments: ["perfume"] },
    { path: "/perfume-analytics", icon: Sparkles, label: "Perfume Analytics", departments: ["perfume"] },
    { path: "/perfume-inventory", icon: Droplet, label: "Perfume Inventory", departments: ["perfume"] },
    { path: "/perfume-revenue", icon: TrendingUp, label: "Perfume Revenue", departments: ["perfume"] },
    { path: "/scent-popularity", icon: BarChart3, label: "Scent Tracker", departments: ["perfume"] },
    { path: "/reports", icon: FileText, label: "Reports", departments: ["general", "perfume", "mobile money"] },
    { path: "/settings", icon: Settings, label: "Settings", departments: ["general", "mobile money", "perfume"] },
  ];

  // Admin-only items
  const adminItems: NavItem[] = [
    { path: "/admin-reports", icon: Shield, label: "Admin Reports", adminOnly: true },
    { path: "/staff-management", icon: UserCog, label: "Staff Mgmt", adminOnly: true },
    { path: "/scent-manager", icon: Sparkles, label: "Scent Manager", adminOnly: true },
  ];

  // Filter navigation items based on user role, department, and permissions
  const navItems = [...allNavItems, ...adminItems].filter(item => {
    // Admins see everything
    if (isAdmin) return true;

    // Check if user has explicit permission for this nav item
    // This allows non-admins to access specific pages if explicitly assigned
    if (userNavPermissions && (userNavPermissions.includes(item.path) || (item.path === '/dashboard' && userNavPermissions.includes('/')))) {
      return true;
    }

    // Filter out admin-only items if no explicit permission
    if (item.adminOnly) return false;

    // If user has no department assigned, show nothing (they need to be assigned)
    if (!departmentId) return false;

    // Fallback to department-based filtering
    if (!item.departments) return true; // Allow access if no department restriction
    return item.departments.includes(departmentName);
  });

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b shadow-sm">

    </nav>
  );
};

export default Navigation;