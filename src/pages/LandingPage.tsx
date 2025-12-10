import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package, Wallet, BarChart3, Calendar, Users, Mail, Phone, MapPin, ChevronRight, CheckCircle2, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import heroBanner from "@/assets/hero-banner.jpg";
import logo from "@/assets/logo.png";

const iconMap: Record<string, any> = {
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  Calendar,
  Users
};

export default function LandingPage() {
  const { data: content } = useQuery({
    queryKey: ["landing-page-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_content")
        .select("*")
        .eq("is_visible", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: services } = useQuery({
    queryKey: ["service-showcase"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_showcase")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const hero = content?.find(c => c.section_key === "hero");
  const about = content?.find(c => c.section_key === "about");
  const servicesSection = content?.find(c => c.section_key === "services");
  const contactSection = content?.find(c => c.section_key === "contact");
  const featuredServices = services?.filter(s => s.is_featured);

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logo} alt="DOTCOM Logo" className="h-8 w-auto" />
              <span className="font-bold text-xl">{settings?.business_name || "DOTCOM BROTHERS LTD"}</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/auth"><Button variant="ghost">Sign In</Button></Link>
              <Link to="/auth"><Button>Get Started</Button></Link>
            </div>
          </div>
        </div>
      </nav>

      {hero && (
        <section className="relative py-32 px-4 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroBanner})` }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="text-center space-y-6">
              <Badge variant="secondary" className="mb-4 text-foreground bg-[#0a1f11]">Many Businesses Trust Us</Badge>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white drop-shadow-2xl">{hero.title}</h1>
              <p className="text-xl md:text-2xl text-white/95 max-w-3xl mx-auto drop-shadow-lg">{hero.content}</p>
              <div className="flex gap-4 justify-center pt-4">
                <Link to="/auth"><Button size="lg" className="gap-2 shadow-xl">Get Started <ChevronRight className="h-4 w-4" /></Button></Link>
                <a href="#services"><Button size="lg" variant="outline">Learn More</Button></a>
              </div>
            </div>
          </div>
        </section>
      )}

      {servicesSection && (
        <section id="services" className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-bold">{servicesSection.title}</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{servicesSection.content}</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
              {services?.map(service => (
                <Card key={service.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-xl">{service.title}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {about && (
        <section className="py-20 px-4 bg-muted/50">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-4xl font-bold">{about.title}</h2>
                <p className="text-muted-foreground leading-relaxed">{about.content}</p>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-4 bg-background rounded-lg border">
                    <div className="text-3xl font-bold text-primary">100+</div>
                    <div className="text-sm text-muted-foreground">Happy Customers</div>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <div className="text-3xl font-bold text-primary">24/7</div>
                    <div className="text-sm text-muted-foreground">Always Here to Help</div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20"></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {contactSection && (
        <section id="contact" className="py-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-bold">{contactSection.title}</h2>
              <p className="text-xl text-muted-foreground">{contactSection.content}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {settings?.business_phone && (
                <Card>
                  <CardContent className="pt-6 text-center space-y-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                    <div className="font-semibold">Phone</div>
                    <div className="text-sm text-muted-foreground">{settings.business_phone}</div>
                  </CardContent>
                </Card>
              )}
              {settings?.business_email && (
                <Card>
                  <CardContent className="pt-6 text-center space-y-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div className="font-semibold">Email</div>
                    <div className="text-sm text-muted-foreground">{settings.business_email}</div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="pt-6 text-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div className="font-semibold">Location</div>
                  <div className="text-sm text-muted-foreground">Kasangati opp Kasangati Police Station</div>
                </CardContent>
              </Card>
            </div>
            <div className="text-center mt-12 space-y-4">
              <Link to="/auth"><Button size="lg" className="gap-2">Sign In to Dashboard <ChevronRight className="h-4 w-4" /></Button></Link>
              <div>
                <a href="https://wa.me/256745368426?text=Hi%2C%20I%20need%20help%20with%20the%20system" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Contact Our Developer
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img src={logo} alt="DOTCOM Logo" className="h-8 w-auto" />
                <span className="font-bold">{settings?.business_name || "DOTCOM BROTHERS LTD"}</span>
              </div>
              <p className="text-sm text-muted-foreground">We help your business grow</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">What We Do</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Sales System</li>
                <li>Stock Management</li>
                <li>Mobile Money</li>
                <li>Business Reports</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">About</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Who We Are</li>
                <li>Contact Us</li>
                <li>Get Help</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Call or Email Us</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {settings?.business_phone && <li>{settings.business_phone}</li>}
                {settings?.business_email && <li>{settings.business_email}</li>}
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} {settings?.business_name || "DOTCOM BROTHERS LTD"}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}