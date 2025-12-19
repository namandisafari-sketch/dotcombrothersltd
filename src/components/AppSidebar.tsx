import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FileText,
  Settings,
  BarChart3,
  Calendar,
  Scissors,
  DollarSign,
  AlertCircle,
  Wallet,
  PauseCircle,
  TrendingUp,
  Receipt,
  CreditCard,
  Sparkles,
  ChevronRight,
  Barcode,
  Mail,
  Globe,
  Building2,
  QrCode,
  Upload,
  BookOpen,
  Building,
  Banknote,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  adminOnly?: boolean;
  moderatorOnly?: boolean;
  requiresDepartment?: boolean;
  departmentTypes?: string[];
}

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useAuth();
  const { selectedDepartmentId, setSelectedDepartmentId } = useDepartment();
  const { isAdmin, isLoading: roleLoading } = useUserRole();

  const { data: userNavPermissions } = useQuery({
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
    enabled: !!user,
  });

  // Fetch all departments for admin selector
  const { data: allDepartments } = useQuery({
    queryKey: ["all-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

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
    },
  });

  const { data: userDepartment } = useQuery({
    queryKey: ["user-department", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return null;
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", selectedDepartmentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDepartmentId,
  });

  const allNavItems: NavItem[] = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/mobile-money-dashboard", icon: LayoutDashboard, label: "Dashboard", departmentTypes: ["mobile_money"] },
    { path: "/inventory", icon: Package, label: "Inventory" },
    { path: "/suppliers", icon: Building2, label: "Suppliers", adminOnly: true },
    { path: "/sales", icon: ShoppingCart, label: "Sales" },
    { path: "/sales-history", icon: Receipt, label: "Sales History" },
    { path: "/customers", icon: Users, label: "Customers" },
    { path: "/services", icon: Scissors, label: "Services" },
    { path: "/appointments", icon: Calendar, label: "Appointments" },
    { path: "/barcode-generator", icon: Barcode, label: "Barcode Generator" },
    { path: "/reports", icon: FileText, label: "Reports" },
    { path: "/credits", icon: CreditCard, label: "Credits" },
    { path: "/customer-credits", icon: CreditCard, label: "Customer Credits" },
    { path: "/inbox", icon: Mail, label: "Inbox" },
    { path: "/internal-usage", icon: AlertCircle, label: "Internal Usage" },
    { path: "/mobile-money", icon: Wallet, label: "Mobile Money", departmentTypes: ["mobile_money"] },
    { path: "/suspended-revenue", icon: PauseCircle, label: "Suspended Revenue", departmentTypes: ["mobile_money"] },
    { path: "/expenses", icon: DollarSign, label: "Expenses" },
    { path: "/reconcile", icon: TrendingUp, label: "Reconciliation" },
    { path: "/cash-drawer", icon: Banknote, label: "Cash Drawer" },
  ];

  const perfumeNavItems: NavItem[] = [
    { path: "/perfume-dashboard", icon: LayoutDashboard, label: "My Shop", departmentTypes: ["perfume"] },
    { path: "/perfume-pos", icon: ShoppingCart, label: "Perfume POS", departmentTypes: ["perfume"] },
    { path: "/perfume-inventory", icon: Sparkles, label: "Perfume Inventory", departmentTypes: ["perfume"] },
    { path: "/perfume-sales-history", icon: Receipt, label: "Sales History", departmentTypes: ["perfume"] },
    { path: "/perfume-report", icon: FileText, label: "Department Report", departmentTypes: ["perfume"] },
    { path: "/perfume-analytics", icon: BarChart3, label: "Perfume Analytics", departmentTypes: ["perfume"] },
    { path: "/scent-popularity", icon: TrendingUp, label: "Scent Popularity", departmentTypes: ["perfume"] },
    { path: "/perfume-revenue", icon: DollarSign, label: "Perfume Revenue", departmentTypes: ["perfume"] },
    { path: "/scent-manager", icon: Sparkles, label: "Scent Manager", departmentTypes: ["perfume"] },
    { path: "/scent-qr", icon: QrCode, label: "Scent QR Code", departmentTypes: ["perfume"] },
  ];

  const adminItems: NavItem[] = [
    { path: "/admin-reports", icon: BarChart3, label: "Admin Reports", adminOnly: true },
    { path: "/admin-credit-approval", icon: CreditCard, label: "Credit Approvals", adminOnly: true },
    { path: "/staff-management", icon: Users, label: "Staff Management", adminOnly: true },
    { path: "/landing-page-editor", icon: Globe, label: "Landing Page", adminOnly: true },
    { path: "/data-import", icon: Upload, label: "Data Import", adminOnly: true },
    { path: "/user-accounts-guide", icon: BookOpen, label: "User Guide", adminOnly: true },
    { path: "/settings", icon: Settings, label: "Settings", adminOnly: true },
  ];

  // Use department flags (is_perfume_department, is_mobile_money) instead of name matching
  const isPerfumeDepartment = userDepartment?.is_perfume_department === true;
  const isMobileMoneyDepartment = userDepartment?.is_mobile_money === true;

  let navItems = allNavItems.filter((item) => {
    if (isAdmin) return true;
    if (item.adminOnly || item.moderatorOnly) return false;
    
    if (isPerfumeDepartment) {
      const regularPages = ["/dashboard", "/inventory", "/sales", "/sales-history", "/customers", 
                            "/services", "/appointments", "/barcode-generator", "/reports", 
                            "/inbox", "/internal-usage"];
      if (regularPages.includes(item.path)) return false;
      return userNavPermissions?.includes(item.path) || false;
    }
    
    if (isMobileMoneyDepartment) {
      if (item.departmentTypes?.includes("mobile_money")) return true;
      const regularPages = ["/inventory", "/sales", "/sales-history", "/services", "/reports"];
      if (regularPages.includes(item.path)) return false;
      return userNavPermissions?.includes(item.path) || false;
    }
    
    if (item.departmentTypes) {
      if (item.departmentTypes.includes("perfume") && isPerfumeDepartment) return true;
      return false;
    }
    
    const basicPages = ["/inventory", "/sales", "/sales-history", "/customers", "/services", 
                        "/appointments", "/barcode-generator", "/credits", 
                        "/inbox", "/internal-usage", "/reports"];
    if (basicPages.includes(item.path)) return true;
    
    if (!userNavPermissions || userNavPermissions.length === 0) return false;
    return userNavPermissions.includes(item.path);
  });

  const perfumeItems = perfumeNavItems.filter((item) => {
    if (isAdmin) return true;
    if (isPerfumeDepartment) return true;
    return false;
  });

  const adminMenuItems = adminItems.filter((item) => {
    if (isAdmin) return true;
    if (item.adminOnly) return false;
    if (!userNavPermissions || userNavPermissions.length === 0) return false;
    return userNavPermissions.includes(item.path);
  });

  const isActive = (path: string) => location.pathname === path;

  if (roleLoading) {
    return (
      <Sidebar className={isCollapsed ? "w-14" : "w-64"}>
        <SidebarContent>
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"}>
      <SidebarContent className="px-2 pt-2">
        {!isCollapsed ? (
          <div className="space-y-6">
            {/* Admin Department Selector */}
            {isAdmin && allDepartments && allDepartments.length > 0 && (
              <div className="px-2 pb-2 border-b border-border">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  <Building className="h-3 w-3 inline mr-1" />
                  Department
                </label>
                <Select
                  value={selectedDepartmentId || ""}
                  onValueChange={(value) => setSelectedDepartmentId(value)}
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {allDepartments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                        {dept.is_mobile_money && " (Mobile Money)"}
                        {dept.is_perfume_department && " (Perfume)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Main Menu
              </h3>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full",
                    isActive(item.path)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive(item.path) && <ChevronRight className="h-4 w-4" />}
                </Link>
              ))}
            </div>

            {perfumeItems.length > 0 && (
              <div className="space-y-1">
                <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Perfume
                </h3>
                {perfumeItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full",
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {isActive(item.path) && <ChevronRight className="h-4 w-4" />}
                  </Link>
                ))}
              </div>
            )}

            {adminMenuItems.length > 0 && (
              <div className="space-y-1">
                <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Administration
                </h3>
                {adminMenuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full",
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {isActive(item.path) && <ChevronRight className="h-4 w-4" />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center justify-center p-2 rounded-md transition-colors",
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                title={item.label}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            ))}

            {perfumeItems.length > 0 && (
              <>
                <div className="h-px bg-border my-2" />
                {perfumeItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-md transition-colors",
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    title={item.label}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                ))}
              </>
            )}

            {adminMenuItems.length > 0 && (
              <>
                <div className="h-px bg-border my-2" />
                {adminMenuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center justify-center p-2 rounded-md transition-colors",
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    title={item.label}
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}