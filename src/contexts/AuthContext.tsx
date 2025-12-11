import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  is_active?: boolean;
}

interface UserRole {
  role: string;
  department_id?: string;
  nav_permissions?: string[];
}

interface AuthUser {
  id: string;
  email?: string;
  full_name?: string;
  department_id?: string;
  is_active: boolean;
  role?: string;
  nav_permissions?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  const fetchUserDetails = async (authUser: User): Promise<AuthUser> => {
    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role, department_id, nav_permissions')
          .eq('user_id', authUser.id)
          .maybeSingle()
      ]);

      const profile = profileResult.data;
      const roleData = roleResult.data;

      return {
        id: authUser.id,
        email: authUser.email || profile?.email,
        full_name: profile?.full_name || authUser.user_metadata?.full_name,
        department_id: roleData?.department_id || undefined,
        is_active: profile?.is_active ?? true,
        role: roleData?.role || 'staff',
        nav_permissions: roleData?.nav_permissions || []
      };
    } catch (error) {
      console.error('Error fetching user details:', error);
      return {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name,
        is_active: true,
        role: 'staff',
        nav_permissions: []
      };
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialCheckDone = false;

    // Set up auth listener FIRST to catch all events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        
        console.log('Auth event:', event);
        
        // Handle INITIAL_SESSION - this fires on page load/refresh
        if (event === 'INITIAL_SESSION') {
          setSession(currentSession);
          if (currentSession?.user) {
            const userDetails = await fetchUserDetails(currentSession.user);
            if (mounted) {
              setUser(userDetails);
            }
          }
          if (mounted) {
            initialCheckDone = true;
            setIsLoading(false);
          }
          return;
        }
        
        setSession(currentSession);
        
        if (event === 'SIGNED_IN' && currentSession?.user) {
          const userDetails = await fetchUserDetails(currentSession.user);
          if (mounted) {
            setUser(userDetails);
            setIsLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && currentSession?.user) {
          const userDetails = await fetchUserDetails(currentSession.user);
          if (mounted) {
            setUser(userDetails);
          }
        }
      }
    );

    // Fallback: if INITIAL_SESSION doesn't fire within 3 seconds, check manually
    const fallbackTimeout = setTimeout(async () => {
      if (!mounted || initialCheckDone) return;
      
      console.log('Auth fallback check triggered');
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted || initialCheckDone) return;
        
        setSession(currentSession);
        if (currentSession?.user) {
          const userDetails = await fetchUserDetails(currentSession.user);
          if (mounted) {
            setUser(userDetails);
          }
        }
      } catch (error) {
        console.error('Error in fallback auth check:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const userDetails = await fetchUserDetails(authUser);
      setUser(userDetails);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsLoading(false);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, signOut, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
