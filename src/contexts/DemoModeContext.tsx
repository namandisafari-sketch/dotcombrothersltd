import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { toast } from "sonner";

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  showDemoWarning: () => void;
  resetDemoData: () => Promise<void>;
  isResetting: boolean;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

const DEMO_MODE_KEY = "demo_mode_enabled";

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    const stored = localStorage.getItem(DEMO_MODE_KEY);
    return stored === "true";
  });
  const [isResetting, setIsResetting] = useState(false);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => {
      const newValue = !prev;
      localStorage.setItem(DEMO_MODE_KEY, String(newValue));
      
      if (newValue) {
        toast.success("Demo Mode Enabled", {
          description: "Staff training mode is now active. No real changes will be saved.",
          duration: 4000,
        });
      } else {
        toast.info("Demo Mode Disabled", {
          description: "You are now in normal mode. All changes will be saved.",
          duration: 3000,
        });
      }
      
      return newValue;
    });
  }, []);

  const showDemoWarning = useCallback(() => {
    if (isDemoMode) {
      toast.warning("Demo Mode Active", {
        description: "This action was simulated and not saved.",
        duration: 2000,
      });
    }
  }, [isDemoMode]);

  const resetDemoData = useCallback(async () => {
    if (!isDemoMode) return;
    
    setIsResetting(true);
    try {
      // Simulate reset delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success("Demo data has been reset");
    } catch (error) {
      toast.error("Failed to reset demo data");
    } finally {
      setIsResetting(false);
    }
  }, [isDemoMode]);

  return (
    <DemoModeContext.Provider value={{ 
      isDemoMode, 
      toggleDemoMode, 
      showDemoWarning,
      resetDemoData,
      isResetting
    }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error("useDemoMode must be used within a DemoModeProvider");
  }
  return context;
}
