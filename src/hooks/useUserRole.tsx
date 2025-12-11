import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "admin" | "moderator" | "user" | "staff" | "manager" | "cashier";

export const useUserRole = () => {
  const { user, isLoading: authLoading } = useAuth();
  
  // Get role from the authenticated user context - already fetched in AuthContext
  const role = (user?.role as UserRole) || "staff";
  
  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator" || role === "manager",
    isLoading: authLoading,
    departmentId: user?.department_id,
    navPermissions: user?.nav_permissions || [],
  };
};
