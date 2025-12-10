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
import { LogOut } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Inventory from "./pages/Inventory";
import Services from "./pages/Services";
import Customers from "./pages/Customers";
import Appointments from "./pages/Appointments";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminReports from "./pages/AdminReports";
import MobileMoney from "./pages/MobileMoney";
import MobileMoneyDashboard from "./pages/MobileMoneyDashboard";
import AdvancedAnalytics from "./pages/AdvancedAnalytics";
import PerfumeAnalytics from "./pages/PerfumeAnalytics";
import PerfumeInventory from "./pages/PerfumeInventory";
import PerfumeDashboard from "./pages/PerfumeDashboard";
import PerfumePOS from "./pages/PerfumePOS";
import StaffManagement from "./pages/StaffManagement";
import Reconcile from "./pages/Reconcile";
import Expenses from "./pages/Expenses";
import SyncUsers from "./pages/SyncUsers";
import InternalUsage from "./pages/InternalUsage";
import SalesHistory from "./pages/SalesHistory";
import BundleGuide from "./pages/BundleGuide";
import BarcodeGenerator from "./pages/BarcodeGenerator";
import ScentPopularityTracker from "./pages/ScentPopularityTracker";
import PerfumeRevenueReport from "./pages/PerfumeRevenueReport";
import PerfumeDepartmentReport from "./pages/PerfumeDepartmentReport";
import ScentManager from "./pages/ScentManager";
import Credits from "./pages/Credits";
import AdminCreditApproval from "./pages/AdminCreditApproval";
import Inbox from "./pages/Inbox";
import LandingPage from "./pages/LandingPage";
import LandingPageEditor from "./pages/LandingPageEditor";
import ComingSoon from "./pages/ComingSoon";
import Suppliers from "./pages/Suppliers";
import SuspendedRevenue from "./pages/SuspendedRevenue";
import InstallPWA from "./pages/InstallPWA";
import PerfumeSalesHistory from "./pages/PerfumeSalesHistory";
import CustomerCredits from "./pages/CustomerCredits";
import CustomerScentCheckIn from "./pages/CustomerScentCheckIn";
import CustomerScentMemory from "./pages/CustomerScentMemory";
import ScentCheckInQR from "./pages/ScentCheckInQR";
import DataImport from "./pages/DataImport";
import UserAccountsGuide from "./pages/UserAccountsGuide";

const queryClient = new QueryClient();

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
              </DepartmentProvider>
            </DemoModeProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
