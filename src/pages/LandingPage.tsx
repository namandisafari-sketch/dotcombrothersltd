import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, Wifi, Smartphone, Globe, Mail, Phone, MapPin, ChevronRight, MessageCircle, Zap, Clock, Shield, Star, Users } from "lucide-react";
import { Link } from "react-router-dom";
import heroBanner from "@/assets/hero-banner.jpg";
import logo from "@/assets/logo.png";

// Icon mapping for dynamic content
const iconMap: Record<string, any> = {
  Printer,
  Wifi,
  Smartphone,
  Globe,
  Mail,
  Phone,
  MapPin,
  Zap,
  Clock,
  Shield,
  Star,
  Users,
};

// Default color gradients for services
const colorGradients = [
  "from-blue-500 to-cyan-500",
  "from-green-500 to-emerald-500",
  "from-orange-500 to-amber-500",
  "from-purple-500 to-pink-500",
  "from-red-500 to-rose-500",
  "from-indigo-500 to-violet-500",
];

// Fallback content
const defaultHeroContent = {
  tagline: "Fast. Reliable.",
  subtitle: "Always Connected.",
  description: "Printing, Cyber Cafe, Mobile Money, Data Bundles — all under one roof with the fastest service in Kasangati",
  badge_text: "✨ Your One-Stop Digital Services Center",
  cta_primary: "Visit Us Today",
  cta_secondary: "Our Services",
};

const defaultFeatures = [
  { icon: "Zap", title: "Fast Service", description: "Quick turnaround on all services" },
  { icon: "Clock", title: "Always Open", description: "Extended hours for your convenience" },
  { icon: "Shield", title: "Trusted", description: "Reliable and secure transactions" },
  { icon: "Star", title: "Quality", description: "Top-notch service every time" },
];

const defaultAboutContent = {
  title: "Your Trusted Digital Hub in Kasangati",
  description: "Located opposite Kasangati Police Station, we provide fast, reliable digital services to our community. From printing your important documents to keeping you connected with affordable data bundles, we have got you covered.",
  stat1_number: "1000+",
  stat1_label: "Happy Customers",
  stat2_number: "24/7",
  stat2_label: "Support Available",
};

const defaultContactContent = {
  title: "Visit Us Today",
  subtitle: "We are ready to serve you!",
  cta_text: "Sign In to Dashboard",
  whatsapp_text: "Chat on WhatsApp",
  whatsapp_number: "256745368426",
};

const defaultFooterContent = {
  copyright: "All rights reserved.",
  made_by: "Made with Love by Earn Frank test by Hamzooz Zolna",
};

const defaultServices = [
  {
    id: "1",
    title: "Printing Services",
    description: "High-quality printing for documents, photos, and more. Fast turnaround guaranteed.",
    icon: Printer,
    color: "from-blue-500 to-cyan-500"
  },
  {
    id: "2",
    title: "Cyber Cafe",
    description: "Lightning-fast internet for browsing, streaming, and downloads. Comfortable workstations.",
    icon: Wifi,
    color: "from-green-500 to-emerald-500"
  },
  {
    id: "3",
    title: "Mobile Money",
    description: "Reliable mobile money services - deposits, withdrawals, and transfers made easy.",
    icon: Smartphone,
    color: "from-orange-500 to-amber-500"
  },
  {
    id: "4",
    title: "Data Bundles",
    description: "Affordable data packages for all networks. Stay connected with the best rates.",
    icon: Globe,
    color: "from-purple-500 to-pink-500"
  },
];

export default function LandingPage() {
  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .is("department_id", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Fetch all landing page content with real-time updates
  const { data: pageContent } = useQuery({
    queryKey: ["landing-page-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_content")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Fetch dynamic services from database with real-time updates
  const { data: dbServices } = useQuery({
    queryKey: ["service-showcase"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_showcase")
        .select("*")
        .eq("is_visible", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Parse content by section
  const getContent = (sectionKey: string) => {
    const section = pageContent?.find((s: any) => s.section_key === sectionKey);
    return section?.settings_json || {};
  };

  // Get section content with defaults
  const heroContent = { ...defaultHeroContent, ...getContent("hero") };
  const featuresData = getContent("features");
  const features = featuresData?.items?.length > 0 ? featuresData.items : defaultFeatures;
  const aboutContent = { ...defaultAboutContent, ...getContent("about") };
  const contactContent = { ...defaultContactContent, ...getContent("contact") };
  const footerContent = { ...defaultFooterContent, ...getContent("footer") };

  // Map database services to display format, or use defaults
  const services = dbServices && dbServices.length > 0
    ? dbServices.map((service: any, index: number) => ({
      id: service.id,
      title: service.title,
      description: service.description || "",
      icon: iconMap[service.title.split(" ")[0]] || Globe,
      color: colorGradients[index % colorGradients.length],
    }))
    : defaultServices;

  const businessName = settings?.business_name || "DOTCOM BROTHERS LTD";

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3 animate-fade-in">
              <img src={logo} alt="Logo" className="h-10 w-auto" />
              <span className="font-bold text-xl tracking-tight">{businessName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" className="hidden sm:inline-flex">Sign In</Button>
              </Link>
              <Link to="/auth">
                <Button className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 animate-[pulse_10s_ease-in-out_infinite]"
          style={{ backgroundImage: `url(${heroBanner})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-primary/30" />

        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite_1s]" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            <Badge
              variant="secondary"
              className="mb-4 px-4 py-2 text-sm font-medium bg-white/10 text-white border border-white/20 backdrop-blur-sm animate-fade-in"
            >
              {heroContent.badge_text}
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white animate-fade-in [animation-delay:100ms]">
              {heroContent.tagline}
              <span className="block mt-2 bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {heroContent.subtitle}
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto leading-relaxed animate-fade-in [animation-delay:200ms]">
              {heroContent.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 animate-fade-in [animation-delay:300ms]">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 gap-2 shadow-2xl hover:shadow-primary/25 transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/80"
                >
                  {heroContent.cta_primary} <ChevronRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#services">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm transition-all duration-300"
                >
                  {heroContent.cta_secondary}
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      </section>

      {/* Features Strip */}
      <section className="py-6 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-y">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((feature: any, index: number) => {
              const FeatureIcon = iconMap[feature.icon] || Zap;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 justify-center animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <FeatureIcon className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-semibold text-sm">{feature.title}</div>
                    <div className="text-xs text-muted-foreground">{feature.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/30 to-transparent" />
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline" className="mb-4">What We Offer</Badge>
            <h2 className="text-4xl md:text-5xl font-bold animate-fade-in">
              Our <span className="text-primary">Services</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need, all in one convenient location
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service: any, index: number) => (
              <Card
                key={service.id}
                className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                <CardContent className="p-8">
                  <div className="flex items-start gap-6">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${service.color} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <service.icon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                        {service.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {service.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 px-4 bg-muted/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />

        <div className="container mx-auto max-w-6xl relative">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 animate-fade-in">
              <Badge variant="outline">About Us</Badge>
              <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                {aboutContent.title.includes("Digital Hub") ? (
                  <>
                    Your Trusted <span className="text-primary">Digital Hub</span> in Kasangati
                  </>
                ) : (
                  aboutContent.title
                )}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {aboutContent.description}
              </p>

              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="p-6 bg-background rounded-2xl border shadow-sm hover:shadow-lg transition-shadow">
                  <div className="text-4xl font-bold text-primary mb-1">{aboutContent.stat1_number}</div>
                  <div className="text-muted-foreground">{aboutContent.stat1_label}</div>
                </div>
                <div className="p-6 bg-background rounded-2xl border shadow-sm hover:shadow-lg transition-shadow">
                  <div className="text-4xl font-bold text-primary mb-1">{aboutContent.stat2_number}</div>
                  <div className="text-muted-foreground">{aboutContent.stat2_label}</div>
                </div>
              </div>
            </div>

            <div className="relative animate-fade-in [animation-delay:200ms]">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-2 border-primary/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary),0.1),transparent)]" />
                <div className="grid grid-cols-2 gap-6 p-8">
                  {services.slice(0, 4).map((service: any, index: number) => (
                    <div
                      key={service.id}
                      className="p-6 bg-background/80 backdrop-blur-sm rounded-2xl shadow-lg hover:scale-105 transition-transform cursor-pointer"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <service.icon className="h-10 w-10 text-primary mb-3" />
                      <div className="font-semibold text-sm">{service.title.split(" ")[0]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-4 relative">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-4 mb-16">
            <Badge variant="outline">Get In Touch</Badge>
            <h2 className="text-4xl md:text-5xl font-bold animate-fade-in">
              {contactContent.title.includes("Today") ? (
                <>Visit Us <span className="text-primary">Today</span></>
              ) : (
                contactContent.title
              )}
            </h2>
            <p className="text-xl text-muted-foreground">
              {contactContent.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Phone, title: "Call Us", value: settings?.business_phone || contactContent?.phone || "+256 745 368 426", color: "from-green-500 to-emerald-500" },
              { icon: Mail, title: "Email", value: settings?.business_email || contactContent?.email || "info@dotcombrothers.com", color: "from-blue-500 to-cyan-500" },
              { icon: MapPin, title: "Location", value: contactContent?.address || "Opp. Kasangati Police Station", color: "from-orange-500 to-amber-500" },
            ].map((contact, index) => (
              <Card
                key={contact.title}
                className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="pt-8 pb-6 text-center space-y-4">
                  <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${contact.color} flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform`}>
                    <contact.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="font-bold text-lg">{contact.title}</div>
                  <div className="text-sm text-muted-foreground px-4">{contact.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-16 space-y-6 animate-fade-in [animation-delay:400ms]">
            <Link to="/auth">
              <Button
                size="lg"
                className="text-lg px-10 py-6 gap-2 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
              >
                {contactContent.cta_text} <ChevronRight className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <a href={`https://wa.me/${contactContent.whatsapp_number}?text=Hi%2C%20I%20need%20your%20services`} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6 gap-2 hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-600 transition-all duration-300"
                >
                  <MessageCircle className="h-5 w-5" />
                  {contactContent.whatsapp_text}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Logo" className="h-12 w-auto" />
                <span className="font-bold text-xl">{businessName}</span>
              </div>
              <p className="text-muted-foreground max-w-md">
                Your trusted partner for all digital services in Kasangati. Fast, reliable, and always ready to serve you.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-lg">Services</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li className="hover:text-primary transition-colors cursor-pointer">Printing</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Cyber Cafe</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Mobile Money</li>
                <li className="hover:text-primary transition-colors cursor-pointer">Data Bundles</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-lg">Contact</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li>{settings?.business_phone || contactContent?.phone || "+256 745 368 426"}</li>
                <li>{settings?.business_email || contactContent?.email || "info@dotcombrothers.com"}</li>
                <li>{contactContent?.address || "Kasangati"}</li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-12 pt-8 text-center text-muted-foreground space-y-4">
            <p>&copy; {new Date().getFullYear()} {businessName}. {footerContent.copyright}</p>
            <h3 className="text-lg font-semibold text-foreground">{footerContent.made_by}</h3>
          </div>
        </div>
      </footer>
    </div>
  );
}
