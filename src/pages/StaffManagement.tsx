import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, UserPlus, Users, KeyRound, Trash2, Settings, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import { emailSchema, passwordSchema } from "@/lib/validation";

const availableNavItems = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/sales", label: "Sales" },
  { path: "/sales-history", label: "Sales History" },
  { path: "/inventory", label: "Inventory" },
  { path: "/suppliers", label: "Suppliers" },
  { path: "/bundle-guide", label: "Bundle Guide" },
  { path: "/barcode-generator", label: "Barcode Generator" },
  { path: "/services", label: "Services" },
  { path: "/customers", label: "Customers" },
  { path: "/appointments", label: "Appointments" },
  { path: "/credits", label: "Credits" },
  { path: "/inbox", label: "Inbox" },
  { path: "/reconcile", label: "Reconciliation" },
  { path: "/internal-usage", label: "Internal Usage" },
  { path: "/expenses", label: "Expenses" },
  { path: "/suspended-revenue", label: "Suspended Revenue" },
  { path: "/mobile-money", label: "Mobile Money" },
  { path: "/advanced-analytics", label: "Advanced Analytics" },
  { path: "/perfume-analytics", label: "Perfume Analytics" },
  { path: "/perfume-dashboard", label: "Perfume Dashboard" },
  { path: "/perfume-pos", label: "Perfume POS" },
  { path: "/perfume-inventory", label: "Perfume Inventory" },
  { path: "/perfume-report", label: "Perfume Department Report" },
  { path: "/perfume-revenue", label: "Perfume Revenue" },
  { path: "/scent-popularity", label: "Scent Popularity" },
  { path: "/scent-manager", label: "Scent Manager" },
  { path: "/reports", label: "Reports" },
  { path: "/settings", label: "Settings" },
  { path: "/admin-reports", label: "Admin Reports" },
  { path: "/admin-credit-approval", label: "Credit Approvals" },
  { path: "/sync-users", label: "Sync Users" },
  { path: "/staff-management", label: "Staff Management" },
  { path: "/landing-page-editor", label: "Landing Page Editor" },
];

const StaffManagement = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "staff",
    departmentId: "",
    navPermissions: [] as string[],
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<{ userId: string; email: string } | null>(null);

  const [passwordResetDialog, setPasswordResetDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });
  const [deleteUserDialog, setDeleteUserDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });
  const [masterPassword, setMasterPassword] = useState("");

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: userProfiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["user-profiles-with-roles"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles (role, department_id, nav_permissions)
        `);
      if (error) throw error;
      
      // Get department names
      const profilesWithDepts = await Promise.all((profiles || []).map(async (profile) => {
        const userRole = Array.isArray(profile.user_roles) ? profile.user_roles[0] : null;
        const deptId = userRole?.department_id;
        let departmentName = "No Department";
        if (deptId) {
          const { data: dept } = await supabase.from("departments").select("name").eq("id", deptId).single();
          departmentName = dept?.name || "Unknown";
        }
        return {
          ...profile,
          department_id: deptId,
          departments: { name: departmentName },
          user_nav_permissions: userRole?.nav_permissions || [],
          parsed_role: userRole?.role || "staff",
        };
      }));
      
      return profilesWithDepts;
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; role: string; departmentId: string; navPermissions: string[] }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({
          role: data.role as any,
          department_id: data.departmentId || null,
          nav_permissions: data.navPermissions,
        })
        .eq("user_id", data.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User updated successfully");
      setIsDialogOpen(false);
      setEditingUser(null);
      setRoleForm({ email: "", password: "", fullName: "", role: "staff", departmentId: "", navPermissions: [] });
      queryClient.invalidateQueries({ queryKey: ["user-profiles-with-roles"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  const deleteSingleUserMutation = useMutation({
    mutationFn: async ({ userId, masterPassword }: { userId: string; masterPassword: string }) => {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId, masterPassword },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["user-profiles-with-roles"] });
      setDeleteUserDialog({ open: false, userId: "", userName: "" });
      setMasterPassword("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  const toggleActivationMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase.functions.invoke("toggle-user-activation", {
        body: { userId, isActive },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profiles-with-roles"] });
      toast.success("User activation toggled");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to toggle user activation");
    },
  });

  const handleDeleteUser = () => {
    if (!masterPassword) {
      toast.error("Please enter the master password");
      return;
    }
    deleteSingleUserMutation.mutate({
      userId: deleteUserDialog.userId,
      masterPassword,
    });
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; fullName: string; role: string; departmentId: string; navPermissions: string[] }) => {
      const emailValidation = emailSchema.safeParse(data.email);
      if (!emailValidation.success) {
        throw new Error(emailValidation.error.errors[0].message);
      }

      const passwordValidation = passwordSchema.safeParse(data.password);
      if (!passwordValidation.success) {
        throw new Error(passwordValidation.error.errors[0].message);
      }

      const { error } = await supabase.functions.invoke("create-staff-user", {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          departmentId: data.departmentId || null,
          navPermissions: data.navPermissions,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User created successfully");
      setIsDialogOpen(false);
      setIsCreatingUser(false);
      setRoleForm({ email: "", password: "", fullName: "", role: "staff", departmentId: "", navPermissions: [] });
      queryClient.invalidateQueries({ queryKey: ["user-profiles-with-roles"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create user");
    },
  });

  const handleAssignRole = async () => {
    if (isCreatingUser || editingUser) {
      if (editingUser) {
        updateUserMutation.mutate({
          userId: editingUser.userId,
          role: roleForm.role,
          departmentId: roleForm.departmentId === "none" ? "" : roleForm.departmentId,
          navPermissions: roleForm.navPermissions,
        });
        return;
      }
      
      if (!roleForm.email || !roleForm.password || !roleForm.fullName) {
        toast.error("Please fill in all required fields");
        return;
      }

      const emailValidation = emailSchema.safeParse(roleForm.email);
      if (!emailValidation.success) {
        toast.error(emailValidation.error.errors[0].message);
        return;
      }

      const passwordValidation = passwordSchema.safeParse(roleForm.password);
      if (!passwordValidation.success) {
        toast.error(passwordValidation.error.errors[0].message);
        return;
      }

      if (roleForm.fullName.trim().length < 2) {
        toast.error("Name must be at least 2 characters");
        return;
      }

      if (roleForm.role !== "admin" && (!roleForm.departmentId || roleForm.departmentId === "none")) {
        toast.error("Please select a department for non-admin users");
        return;
      }
      
      createUserMutation.mutate({
        email: emailValidation.data,
        password: roleForm.password,
        fullName: roleForm.fullName.trim(),
        role: roleForm.role,
        departmentId: roleForm.departmentId === "none" ? "" : roleForm.departmentId,
        navPermissions: roleForm.navPermissions,
      });
    } else {
      const user = userProfiles?.find(p => p.id === roleForm.email);
      
      if (!user) {
        toast.error("User not found");
        return;
      }

      updateUserMutation.mutate({
        userId: user.id,
        role: roleForm.role,
        departmentId: roleForm.departmentId === "none" ? "" : roleForm.departmentId,
        navPermissions: roleForm.navPermissions,
      });
    }
  };

  const getRoleColor = (role: string) => {
    if (role === "admin") return "destructive";
    if (role === "manager") return "default";
    return "secondary";
  };

  const permissions = {
    user: [
      "Access assigned department features",
      "Process sales (if in sales dept)",
      "Manage inventory (if in inventory dept)",
      "Provide services (if in services dept)",
      "View department-specific reports",
    ],
    user_restrictions: [
      "Cannot access other departments",
      "Cannot view dashboard",
      "Cannot change system settings",
      "Cannot manage user roles",
      "Cannot view analytics",
    ],
    moderator: [
      "All user permissions",
      "Approve department transactions",
      "View department analytics",
      "Manage department staff",
    ],
    admin: [
      "Access all departments",
      "View full dashboard",
      "Manage users and roles",
      "Configure system settings",
      "Access all financial reports",
      "View all analytics",
      "Manage suppliers and stock",
    ],
  };

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-20 pt-32 lg:pt-20">
      <Navigation />

      <main className="max-w-7xl mx-auto px-2 sm:px-4 pt-20 sm:pt-24">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Staff Management</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Manage user roles and permissions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    User Roles
                  </CardTitle>
                </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingUser(null);
          }
        }}>
                   <DialogTrigger asChild>
                    <Button 
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setIsCreatingUser(false);
                        setEditingUser(null);
                        setRoleForm({ email: "", password: "", fullName: "", role: "staff", departmentId: "", navPermissions: [] });
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      <span className="text-xs sm:text-sm">Assign Role</span>
                    </Button>
                  </DialogTrigger>
                   <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {isCreatingUser ? "Create New User" : editingUser ? "Edit User" : "Assign User Role & Department"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {!editingUser && (
                        <div className="flex gap-2 mb-4">
                          <Button
                            type="button"
                            variant={!isCreatingUser ? "default" : "outline"}
                            onClick={() => {
                              setIsCreatingUser(false);
                              setEditingUser(null);
                              setRoleForm({ email: "", password: "", fullName: "", role: "staff", departmentId: "", navPermissions: [] });
                            }}
                            className="flex-1"
                          >
                            Existing User
                          </Button>
                          <Button
                            type="button"
                            variant={isCreatingUser ? "default" : "outline"}
                            onClick={() => {
                              setIsCreatingUser(true);
                              setEditingUser(null);
                              setRoleForm({ email: "", password: "", fullName: "", role: "staff", departmentId: "", navPermissions: [] });
                            }}
                            className="flex-1"
                          >
                            Create New
                          </Button>
                        </div>
                      )}

                      {isCreatingUser ? (
                        <>
                          <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                              value={roleForm.fullName}
                              onChange={(e) =>
                                setRoleForm({ ...roleForm, fullName: e.target.value })
                              }
                              placeholder="John Doe"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={roleForm.email}
                              onChange={(e) =>
                                setRoleForm({ ...roleForm, email: e.target.value })
                              }
                              placeholder="user@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Password</Label>
                            <PasswordInput
                              value={roleForm.password}
                              onChange={(e) =>
                                setRoleForm({ ...roleForm, password: e.target.value })
                              }
                              placeholder="Minimum 10 characters with uppercase, lowercase, number, and special character"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Must be at least 10 characters with uppercase, lowercase, number, and special character
                            </p>
                          </div>
                        </>
                      ) : !editingUser ? (
                        <div className="space-y-2">
                          <Label>User</Label>
                          <Select
                            value={roleForm.email}
                            onValueChange={(value) =>
                              setRoleForm({ ...roleForm, email: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent>
                              {userProfiles?.map((profile) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                  {profile.full_name || profile.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>User</Label>
                          <Input value={editingUser.email} disabled />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={roleForm.role}
                          onValueChange={(value) =>
                            setRoleForm({ ...roleForm, role: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="cashier">Cashier</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Department {roleForm.role === "admin" ? "(Optional - Admin can access all)" : "(Required)"}</Label>
                        <Select
                          value={roleForm.departmentId}
                          onValueChange={(value) =>
                            setRoleForm({ ...roleForm, departmentId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={roleForm.role === "admin" ? "No department (access all)" : "Select department"} />
                          </SelectTrigger>
                          <SelectContent>
                            {roleForm.role === "admin" && (
                              <SelectItem value="none">No Department (Access All)</SelectItem>
                            )}
                            {departments?.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {roleForm.role !== "admin" && (
                        <div className="space-y-2">
                          <Label>Navigation Access (Select tabs user can see)</Label>
                          <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
                            {availableNavItems
                              .filter(item => !item.path.includes("admin") && item.path !== "/staff")
                              .map((item) => (
                                <div key={item.path} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`nav-${item.path}`}
                                    checked={roleForm.navPermissions.includes(item.path)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        const uniquePermissions = Array.from(new Set([...roleForm.navPermissions, item.path]));
                                        setRoleForm({
                                          ...roleForm,
                                          navPermissions: uniquePermissions,
                                        });
                                      } else {
                                        setRoleForm({
                                          ...roleForm,
                                          navPermissions: roleForm.navPermissions.filter(p => p !== item.path),
                                        });
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`nav-${item.path}`}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {item.label}
                                  </Label>
                                </div>
                              ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Admin users have access to all tabs automatically
                          </p>
                        </div>
                      )}
                      
                      <Button 
                        className="w-full" 
                        onClick={handleAssignRole}
                        disabled={
                          updateUserMutation.isPending || 
                          createUserMutation.isPending ||
                          (isCreatingUser && roleForm.role !== "admin" && (!roleForm.departmentId || roleForm.departmentId === "none"))
                        }
                       >
                         {updateUserMutation.isPending || createUserMutation.isPending 
                           ? "Processing..." 
                           : isCreatingUser ? "Create User" : editingUser ? "Update User" : "Assign Role"}
                       </Button>
                     </div>
                   </DialogContent>
                 </Dialog>
               </CardHeader>
              <CardContent>
                {isLoadingProfiles ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading users...
                  </div>
                ) : !userProfiles || userProfiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found. Create your first user.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userProfiles.map((profile) => {
                      const role = profile.parsed_role || "staff";
                      const department = profile.departments?.name || "No Department";
                      const navPerms = profile.user_nav_permissions || [];
                      
                      return (
                        <div
                          key={profile.id}
                          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-card gap-2"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{profile.full_name || "Unknown User"}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant={getRoleColor(role)} className="text-xs">
                                {role}
                              </Badge>
                              <Badge 
                                variant={profile.is_active ? "default" : "secondary"} 
                                className="text-xs"
                              >
                                {profile.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {department}
                              </span>
                              {navPerms.length > 0 && (
                                <span className="text-xs text-primary">
                                  {navPerms.length} page{navPerms.length !== 1 ? 's' : ''} access
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant={profile.is_active ? "outline" : "default"}
                              size="sm"
                              onClick={() => {
                                toggleActivationMutation.mutate({
                                  userId: profile.id,
                                  isActive: !profile.is_active,
                                });
                              }}
                              disabled={toggleActivationMutation.isPending}
                            >
                              {profile.is_active ? (
                                <>
                                  <UserX className="w-3 h-3 mr-1" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Activate
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPasswordResetDialog({
                                  open: true,
                                  userId: profile.id,
                                  userName: profile.full_name || "User",
                                });
                              }}
                            >
                              <KeyRound className="w-3 h-3 mr-1" />
                              Reset
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const editRole = profile.parsed_role || "staff";
                                const navPerms = profile.user_nav_permissions || [];
                                setEditingUser({ userId: profile.id, email: profile.full_name || "User" });
                                setRoleForm({ 
                                  email: profile.id, 
                                  password: "", 
                                  fullName: profile.full_name || "",
                                  role: role,
                                  departmentId: profile.department_id || "none",
                                  navPermissions: navPerms,
                                });
                                setIsDialogOpen(true);
                              }}
                            >
                              <Settings className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDeleteUserDialog({
                                  open: true,
                                  userId: profile.id,
                                  userName: profile.full_name || "User",
                                });
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Permissions Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge>Staff</Badge>
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {permissions.user.map((perm, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-success">✓</span>
                        {perm}
                      </li>
                    ))}
                  </ul>
                  <h4 className="font-semibold mt-3 mb-2 text-sm text-destructive">
                    Restrictions:
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {permissions.user_restrictions.map((perm, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-destructive">✗</span>
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge>Manager</Badge>
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {permissions.moderator.map((perm, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-success">✓</span>
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="destructive">Admin</Badge>
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {permissions.admin.map((perm, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-success">✓</span>
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <PasswordResetDialog
        open={passwordResetDialog.open}
        onOpenChange={(open) =>
          setPasswordResetDialog({ ...passwordResetDialog, open })
        }
        userId={passwordResetDialog.userId}
        userName={passwordResetDialog.userName}
      />

      <Dialog open={deleteUserDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteUserDialog({ open: false, userId: "", userName: "" });
          setMasterPassword("");
        } else {
          setDeleteUserDialog({ ...deleteUserDialog, open });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User - Master Password Required</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to delete <span className="font-semibold">{deleteUserDialog.userName}</span>. 
              This action cannot be undone. Please enter the master password to confirm.
            </p>
            <div className="space-y-2">
              <Label htmlFor="master-password">Master Password</Label>
              <PasswordInput
                id="master-password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Enter master password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && masterPassword) {
                    handleDeleteUser();
                  }
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteUserDialog({ open: false, userId: "", userName: "" });
                  setMasterPassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={deleteSingleUserMutation.isPending || !masterPassword}
              >
                {deleteSingleUserMutation.isPending ? "Deleting..." : "Delete User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffManagement;
