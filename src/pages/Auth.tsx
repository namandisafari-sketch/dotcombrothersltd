import { useState, useEffect } from "react";
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
import { supabaseClient, isSelfHosted } from "@/lib/supabase";

const Auth = () => {
  const navigate = useNavigate();
  const { session, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  // Immediate redirect if already logged in
  useEffect(() => {
    if (session && !authLoading) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, authLoading, navigate]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#062e18]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Use the appropriate Supabase client (self-hosted or Lovable Cloud)
  const authClient = supabaseClient;

  const handleEmailAuth = async (e: React.FormEvent) => {
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
        
        const { data, error } = await authClient.auth.signUp({
          email: emailValidation.data,
          password,
          options: { 
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        
        if (error) throw error;
        if (data.user) {
          toast.success("Account created successfully!");
          navigate("/dashboard");
        }
      } else {
        const { data, error } = await authClient.auth.signInWithPassword({
          email: emailValidation.data,
          password
        });
        
        if (error) throw error;
        
        if (data.user) {
          // Check if user is active
          const { data: profile } = await authClient
            .from('profiles')
            .select('is_active')
            .eq('id', data.user.id)
            .maybeSingle();
          
          if (profile && !profile.is_active) {
            await authClient.auth.signOut();
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
      } else if (error.message?.includes("fetch")) {
        toast.error("Connection error. Please check your network.");
      } else {
        toast.error(error.message || "An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

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
          {isSelfHosted && (
            <p className="text-xs text-green-400">🏠 Connected to self-hosted backend</p>
          )}
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
