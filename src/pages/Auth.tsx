import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { RefreshCw } from "lucide-react";
import logo from "@/assets/logo.png";
import jagonixBg from "@/assets/jagonix-bg.png";

// Check if we're on self-hosted domain
const isSelfHosted = () => {
  const hostname = window.location.hostname;
  return hostname === 'dotcombrothersltd.com' || 
         hostname === 'www.dotcombrothersltd.com' ||
         hostname === '172.234.31.22';
};

const Auth = () => {
  const navigate = useNavigate();
  const { session, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  // For self-hosted, check localStorage token instead of Supabase session
  useEffect(() => {
    if (isSelfHosted()) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [navigate]);
  
  // Immediate redirect if already logged in (for Supabase mode)
  if (!isSelfHosted() && session && !authLoading) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  // Show nothing while checking auth to prevent flash
  if (!isSelfHosted() && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#062e18]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Self-hosted login using local backend API
  const handleSelfHostedAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setIsLoading(true);
      
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
      const body = isSignUp 
        ? { email, password, full_name: fullName }
        : { email, password };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      // Store token and user data
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      
      toast.success(isSignUp ? "Account created!" : "Welcome back!");
      navigate("/dashboard");
      
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  // Supabase login (original implementation)
  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      toast.error(emailValidation.error.errors[0].message);
      return;
    }

    if (isSignUp) {
      const passwordValidation = passwordSchema.safeParse(password);
      if (!passwordValidation.success) {
        toast.error(passwordValidation.error.errors[0].message);
        return;
      }
    }

    try {
      setIsLoading(true);
      
      if (isSignUp) {
        if (!fullName) {
          toast.error("Please enter your full name");
          return;
        }
        
        const { data, error } = await supabase.auth.signUp({
          email: emailValidation.data,
          password,
          options: { data: { full_name: fullName } }
        });
        
        if (error) throw error;
        if (data.user) {
          toast.success("Account created successfully!");
          navigate("/dashboard");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailValidation.data,
          password
        });
        
        if (error) throw error;
        
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', data.user.id)
            .maybeSingle();
          
          if (profile && !profile.is_active) {
            await supabase.auth.signOut();
            toast.error("Your account has been deactivated.");
            return;
          }
          
          toast.success("Welcome back!");
          navigate("/dashboard");
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.message?.includes("Invalid login credentials")) {
        toast.error("Invalid email or password");
      } else if (error.message?.includes("User already registered")) {
        toast.error("Email already registered.");
      } else {
        toast.error(error.message || "An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = isSelfHosted() ? handleSelfHostedAuth : handleSupabaseAuth;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative" 
      style={{
        backgroundImage: `url(${jagonixBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-[#062e18]" />
      <Card className="w-full max-w-md relative z-10 backdrop-blur-sm border-border/30 bg-[#051e0a]/20">
        <Button 
          onClick={() => window.location.reload()} 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-4 z-20" 
          title="Refresh page"
        >
          <RefreshCw className="h-5 w-5" />
        </Button>
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="Shelf Buzi POS" className="h-24 w-24 object-contain" />
          </div>
          <h1 className="text-3xl font-bold">Shelf Buzi POS</h1>
          <CardTitle className="text-2xl">Owned by DOTCOM BROTHERS LTD</CardTitle>
          <CardDescription className="text-slate-50">
            {isSignUp ? "Create your account to get started with Jagonix POS" : "Welcome back! Sign in to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input 
                  id="fullName" 
                  type="text" 
                  placeholder="John Doe" 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)} 
                  disabled={isLoading} 
                  required 
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@example.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                disabled={isLoading} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput 
                id="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                disabled={isLoading} 
                required 
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full" size="lg">
              {isLoading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>

          <div className="text-center text-sm">
            <button 
              type="button" 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setPassword("");
              }} 
              className="text-primary hover:underline" 
              disabled={isLoading}
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
