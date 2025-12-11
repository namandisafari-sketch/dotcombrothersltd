import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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
  
  // Track if initial load is complete to prevent race conditions
  const initialLoadComplete = useRef(false);
  const fetchingRef = useRef(false);

  const fetchUserDetails = async (authUser: User): Promise<AuthUser | null> => {
    // Prevent concurrent fetches
    if (fetchingRef.current) {
      return null;
    }
    
    fetchingRef.current = true;
    
    try {
      // Get profile and role in parallel for efficiency
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

      const userDetails: AuthUser = {
        id: authUser.id,
        email: authUser.email || profile?.email,
        full_name: profile?.full_name || authUser.user_metadata?.full_name,
        department_id: roleData?.department_id || undefined,
        is_active: profile?.is_active ?? true,
        role: roleData?.role || 'staff',
        nav_permissions: roleData?.nav_permissions || []
      };

      console.log('Fetched user details:', {
        id: userDetails.id,
        role: userDetails.role,
        department_id: userDetails.department_id,
        nav_permissions: userDetails.nav_permissions
      });

      return userDetails;
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
    } finally {
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check initial session first
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        console.log('Initial session check:', initialSession?.user?.email);
        setSession(initialSession);
        
        if (initialSession?.user) {
          const userDetails = await fetchUserDetails(initialSession.user);
          if (mounted && userDetails) {
            setUser(userDetails);
          }
        }
        
        initialLoadComplete.current = true;
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state listener for subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event, currentSession?.user?.email);
        
        if (!mounted) return;
        
        setSession(currentSession);
        
        // Only process auth changes after initial load is complete
        // This prevents the race condition
        if (!initialLoadComplete.current && event === 'INITIAL_SESSION') {
          return;
        }
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (currentSession?.user) {
            // Small delay to ensure database triggers have completed
            await new Promise(resolve => setTimeout(resolve, 100));
            const userDetails = await fetchUserDetails(currentSession.user);
            if (mounted && userDetails) {
              setUser(userDetails);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      fetchingRef.current = false; // Reset to allow refresh
      const userDetails = await fetchUserDetails(authUser);
      if (userDetails) {
        setUser(userDetails);
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    initialLoadComplete.current = false;
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
