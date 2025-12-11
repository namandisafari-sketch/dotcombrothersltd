import * as React from "react";
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DepartmentProvider } from "./contexts/DepartmentContext";
import { ThemeProvider } from "./components/ThemeProvider";
import { DemoModeProvider } from "./contexts/DemoModeContext";
import { OfflineSyncIndicator } from "./components/OfflineSyncIndicator";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { GettingStarted } from "./components/GettingStarted";
import { DemoModeBanner } from "./components/DemoModeBanner";
import WhatsAppButton from "./components/WhatsAppButton";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Sales = lazy(() => import("./pages/Sales"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Services = lazy(() => import("./pages/Services"));
const Customers = lazy(() => import("./pages/Customers"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const MobileMoney = lazy(() => import("./pages/MobileMoney"));
const MobileMoneyDashboard = lazy(() => import("./pages/MobileMoneyDashboard"));
const AdvancedAnalytics = lazy(() => import("./pages/AdvancedAnalytics"));
const PerfumeAnalytics = lazy(() => import("./pages/PerfumeAnalytics"));
const PerfumeInventory = lazy(() => import("./pages/PerfumeInventory"));
const PerfumeDashboard = lazy(() => import("./pages/PerfumeDashboard"));
const PerfumePOS = lazy(() => import("./pages/PerfumePOS"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const Reconcile = lazy(() => import("./pages/Reconcile"));
const Expenses = lazy(() => import("./pages/Expenses"));
const SyncUsers = lazy(() => import("./pages/SyncUsers"));
const InternalUsage = lazy(() => import("./pages/InternalUsage"));
const SalesHistory = lazy(() => import("./pages/SalesHistory"));
const BundleGuide = lazy(() => import("./pages/BundleGuide"));
const BarcodeGenerator = lazy(() => import("./pages/BarcodeGenerator"));
const ScentPopularityTracker = lazy(() => import("./pages/ScentPopularityTracker"));
const PerfumeRevenueReport = lazy(() => import("./pages/PerfumeRevenueReport"));
const PerfumeDepartmentReport = lazy(() => import("./pages/PerfumeDepartmentReport"));
const ScentManager = lazy(() => import("./pages/ScentManager"));
const Credits = lazy(() => import("./pages/Credits"));
const AdminCreditApproval = lazy(() => import("./pages/AdminCreditApproval"));
const Inbox = lazy(() => import("./pages/Inbox"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const LandingPageEditor = lazy(() => import("./pages/LandingPageEditor"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const SuspendedRevenue = lazy(() => import("./pages/SuspendedRevenue"));
const InstallPWA = lazy(() => import("./pages/InstallPWA"));
const PerfumeSalesHistory = lazy(() => import("./pages/PerfumeSalesHistory"));
const CustomerCredits = lazy(() => import("./pages/CustomerCredits"));
const CustomerScentCheckIn = lazy(() => import("./pages/CustomerScentCheckIn"));
const CustomerScentMemory = lazy(() => import("./pages/CustomerScentMemory"));
const ScentCheckInQR = lazy(() => import("./pages/ScentCheckInQR"));
const DataImport = lazy(() => import("./pages/DataImport"));
const UserAccountsGuide = lazy(() => import("./pages/UserAccountsGuide"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Configure QueryClient with caching for better performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // Data is fresh for 2 minutes
      gcTime: 1000 * 60 * 10, // Cache for 10 minutes
      refetchOnWindowFocus: false, // Don't refetch when window gains focus
      retry: 1, // Only retry once on failure
    },
  },
});

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  // Always render the same structure to maintain consistent hook usage
  return (
    <>
      {user && (
        <>
          <DemoModeBanner />
          <GettingStarted />
          <WhatsAppButton />
        </>
      )}
      {!user ? (
        <>{children}</>
      ) : (
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <header className="sticky top-0 z-[60] w-full">
                <div className="flex h-14 items-center gap-4 px-4">
                  <SidebarTrigger />
                  <div className="flex-1" />
                  <ThemeToggle />
                  <Button variant="ghost" size="icon" onClick={handleSignOut}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </header>
              <main className="flex-1">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
      )}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <DemoModeProvider>
              <DepartmentProvider>
                <OfflineSyncIndicator />
                
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route element={<AppLayout><ProtectedRoute /></AppLayout>}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/appointments" element={<Appointments />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/admin-reports" element={<AdminReports />} />
                      <Route path="/mobile-money" element={<MobileMoney />} />
                      <Route path="/mobile-money-dashboard" element={<MobileMoneyDashboard />} />
                      <Route path="/advanced-analytics" element={<AdvancedAnalytics />} />
                      <Route path="/perfume-analytics" element={<PerfumeAnalytics />} />
                      <Route path="/perfume-dashboard" element={<PerfumeDashboard />} />
                      <Route path="/perfume-pos" element={<PerfumePOS />} />
                      <Route path="/perfume-inventory" element={<PerfumeInventory />} />
                      <Route path="/perfume-sales-history" element={<PerfumeSalesHistory />} />
                      <Route path="/staff-management" element={<StaffManagement />} />
                      <Route path="/reconcile" element={<Reconcile />} />
                      <Route path="/suspended-revenue" element={<SuspendedRevenue />} />
                      <Route path="/expenses" element={<Expenses />} />
                      <Route path="/sync-users" element={<SyncUsers />} />
                      <Route path="/internal-usage" element={<InternalUsage />} />
                      <Route path="/sales-history" element={<SalesHistory />} />
                      <Route path="/bundle-guide" element={<BundleGuide />} />
                      <Route path="/barcode-generator" element={<BarcodeGenerator />} />
                      <Route path="/scent-popularity" element={<ScentPopularityTracker />} />
                      <Route path="/perfume-revenue" element={<PerfumeRevenueReport />} />
                      <Route path="/perfume-report" element={<PerfumeDepartmentReport />} />
                      <Route path="/scent-manager" element={<ScentManager />} />
                      <Route path="/credits" element={<Credits />} />
                      <Route path="/admin-credit-approval" element={<AdminCreditApproval />} />
                      <Route path="/inbox" element={<Inbox />} />
                      <Route path="/landing-page-editor" element={<LandingPageEditor />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/install" element={<InstallPWA />} />
                      <Route path="/customer-credits" element={<CustomerCredits />} />
                      <Route path="/scent-qr" element={<ScentCheckInQR />} />
                      <Route path="/data-import" element={<DataImport />} />
                      <Route path="/user-accounts-guide" element={<UserAccountsGuide />} />
                    </Route>
                    {/* Public routes for customer self-service */}
                    <Route path="/customer-scent-check-in" element={<CustomerScentCheckIn />} />
                    <Route path="/customer-scent-memory" element={<CustomerScentMemory />} />
                  </Routes>
                </Suspense>
              </DepartmentProvider>
            </DemoModeProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
