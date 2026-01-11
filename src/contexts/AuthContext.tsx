import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabase";
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
        supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle(),
        supabaseClient
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

    // Get initial session immediately
    const getInitialSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
        
        if (!mounted) return;
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          try {
            const userDetails = await fetchUserDetails(currentSession.user);
            if (mounted) setUser(userDetails);
          } catch (e) {
            console.error('Error fetching user details:', e);
          }
        }
      } catch (error) {
        console.error('Error getting session:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes AFTER initial check
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        
        console.log('Auth event:', event);
        setSession(currentSession);
        
        if (event === 'SIGNED_IN' && currentSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            if (!mounted) return;
            try {
              const userDetails = await fetchUserDetails(currentSession.user);
              if (mounted) {
                setUser(userDetails);
                setIsLoading(false);
              }
            } catch (e) {
              console.error('Error in SIGNED_IN:', e);
              if (mounted) setIsLoading(false);
            }
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && currentSession?.user) {
          setTimeout(async () => {
            if (!mounted) return;
            try {
              const userDetails = await fetchUserDetails(currentSession.user);
              if (mounted) setUser(userDetails);
            } catch (e) {
              console.error('Error in TOKEN_REFRESHED:', e);
            }
          }, 0);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    try {
      const { data: { user: authUser } } = await supabaseClient.auth.getUser();
      if (authUser) {
        const userDetails = await fetchUserDetails(authUser);
        setUser(userDetails);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  // Listen for profile updates via Realtime
  useEffect(() => {
    let mounted = true;

    const subscription = supabaseClient
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user?.id}`,
        },
        (payload) => {
          if (mounted) {
            console.log('Profile updated:', payload);
            refreshUser();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Listen for user_roles updates via Realtime
  useEffect(() => {
    let mounted = true;

    const subscription = supabaseClient
      .channel('user_roles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          if (mounted) {
            console.log('User roles updated:', payload);
            refreshUser();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [user?.id]);
    setIsLoading(true);
    await supabaseClient.auth.signOut();
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
