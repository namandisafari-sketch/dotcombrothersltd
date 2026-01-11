import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, Save, Plus, Trash2, GripVertical, Zap, Clock, Shield, Star, Printer, Wifi, Smartphone, Globe, Layout, Type, Users, Phone, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PasscodeDialog } from "@/components/PasscodeDialog";
import { useUserRole } from "@/hooks/useUserRole";

// Available icons for features
const availableIcons = [
  { key: "Zap", label: "Lightning", icon: Zap },
  { key: "Clock", label: "Clock", icon: Clock },
  { key: "Shield", label: "Shield", icon: Shield },
  { key: "Star", label: "Star", icon: Star },
  { key: "Printer", label: "Printer", icon: Printer },
  { key: "Wifi", label: "Wifi", icon: Wifi },
  { key: "Smartphone", label: "Phone", icon: Smartphone },
  { key: "Globe", label: "Globe", icon: Globe },
  { key: "Users", label: "Users", icon: Users },
  { key: "Phone", label: "Contact", icon: Phone },
];

// Default content structures
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

export default function LandingPageEditor() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState("hero");
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Local state for each section
  const [heroContent, setHeroContent] = useState(defaultHeroContent);
  const [features, setFeatures] = useState(defaultFeatures);
  const [aboutContent, setAboutContent] = useState(defaultAboutContent);
  const [contactContent, setContactContent] = useState(defaultContactContent);
  const [footerContent, setFooterContent] = useState(defaultFooterContent);

  useEffect(() => {
    if (isAdmin) {
      const accessGranted = sessionStorage.getItem("landing_editor_access");
      if (accessGranted === "granted") {
        setHasAccess(true);
      } else {
        setShowPasscodeDialog(true);
      }
    } else {
      navigate("/dashboard");
    }
  }, [isAdmin, navigate]);

  const handlePasscodeSuccess = () => {
    setShowPasscodeDialog(false);
    setHasAccess(true);
    sessionStorage.setItem("landing_editor_access", "granted");
  };

  const handlePasscodeCancel = () => {
    setShowPasscodeDialog(false);
    navigate("/dashboard");
  };

  // Fetch landing page content
  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["landing-page-content-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("landing_page_content").select("*").order("order_index");
      return data || [];
    },
  });

  // Load content into state when fetched
  useEffect(() => {
    if (content && content.length > 0) {
      content.forEach((section: any) => {
        const settings = section.settings_json || {};
        switch (section.section_key) {
          case "hero":
            setHeroContent({ ...defaultHeroContent, ...settings });
            break;
          case "features":
            if (settings.items && Array.isArray(settings.items)) {
              setFeatures(settings.items);
            }
            break;
          case "about":
            setAboutContent({ ...defaultAboutContent, ...settings });
            break;
          case "contact":
            setContactContent({ ...defaultContactContent, ...settings });
            break;
          case "footer":
            setFooterContent({ ...defaultFooterContent, ...settings });
            break;
        }
      });
    }
  }, [content]);

  // Fetch services
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["service-showcase-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("service_showcase").select("*").order("display_order");
      return data || [];
    },
  });

  // Generic upsert mutation for landing page content
  const upsertContentMutation = useMutation({
    mutationFn: async ({ section_key, settings_json }: { section_key: string; settings_json: any }) => {
      // Check if section exists
      const { data: existing } = await supabase
        .from("landing_page_content")
        .select("id")
        .eq("section_key", section_key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("landing_page_content")
          .update({ settings_json, updated_at: new Date().toISOString() })
          .eq("section_key", section_key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("landing_page_content")
          .insert({
            section_key,
            settings_json,
            is_visible: true,
            order_index: ["hero", "features", "services", "about", "contact", "footer"].indexOf(section_key)
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-content-admin"] });
      queryClient.invalidateQueries({ queryKey: ["landing-page-content"] });
      queryClient.invalidateQueries({ queryKey: ["service-showcase"] });
      toast.success("Content saved successfully!");
    },
    onError: () => {
      toast.error("Failed to save content");
    },
  });

  // Service mutations
  const updateServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("service_showcase").update(data).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-showcase-admin"] });
      queryClient.invalidateQueries({ queryKey: ["service-showcase"] });
      toast.success("Service updated");
    },
    onError: () => toast.error("Failed to update service"),
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_showcase").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-showcase-admin"] });
      toast.success("Service deleted");
    },
    onError: () => toast.error("Failed to delete service"),
  });

  const addServiceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_showcase").insert({
        title: "New Service",
        description: "Service description",
        display_order: services?.length || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-showcase-admin"] });
      toast.success("Service added");
    },
    onError: () => toast.error("Failed to add service"),
  });

  // Save handlers
  const saveHero = () => upsertContentMutation.mutate({ section_key: "hero", settings_json: heroContent });
  const saveFeatures = () => upsertContentMutation.mutate({ section_key: "features", settings_json: { items: features } });
  const saveAbout = () => upsertContentMutation.mutate({ section_key: "about", settings_json: aboutContent });
  const saveContact = () => upsertContentMutation.mutate({ section_key: "contact", settings_json: contactContent });
  const saveFooter = () => upsertContentMutation.mutate({ section_key: "footer", settings_json: footerContent });

  // Feature handlers
  const updateFeature = (index: number, field: string, value: string) => {
    const updated = [...features];
    updated[index] = { ...updated[index], [field]: value };
    setFeatures(updated);
  };

  if (!hasAccess) {
    return (
      <PasscodeDialog
        open={showPasscodeDialog}
        onSuccess={handlePasscodeSuccess}
        onCancel={handlePasscodeCancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Landing Page Editor</h1>
            <p className="text-muted-foreground">Manage your public-facing website content</p>
          </div>
          <Link to="/" target="_blank">
            <Button variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview Landing Page
            </Button>
          </Link>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="hero" className="gap-2">
              <Layout className="h-4 w-4" />
              Hero
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <Zap className="h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <Printer className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-2">
              <Users className="h-4 w-4" />
              About
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-2">
              <Phone className="h-4 w-4" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="footer" className="gap-2">
              <FileText className="h-4 w-4" />
              Footer
            </TabsTrigger>
          </TabsList>

          {/* HERO TAB */}
          <TabsContent value="hero">
            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
                <CardDescription>Edit the main banner area that visitors see first</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Badge Text (small text above title)</Label>
                  <Input
                    value={heroContent.badge_text}
                    onChange={(e) => setHeroContent({ ...heroContent, badge_text: e.target.value })}
                    placeholder="✨ Your One-Stop Digital Services Center"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Main Tagline</Label>
                    <Input
                      value={heroContent.tagline}
                      onChange={(e) => setHeroContent({ ...heroContent, tagline: e.target.value })}
                      placeholder="Fast. Reliable."
                    />
                  </div>
                  <div>
                    <Label>Subtitle (highlighted text)</Label>
                    <Input
                      value={heroContent.subtitle}
                      onChange={(e) => setHeroContent({ ...heroContent, subtitle: e.target.value })}
                      placeholder="Always Connected."
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={heroContent.description}
                    onChange={(e) => setHeroContent({ ...heroContent, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Primary Button Text</Label>
                    <Input
                      value={heroContent.cta_primary}
                      onChange={(e) => setHeroContent({ ...heroContent, cta_primary: e.target.value })}
                      placeholder="Visit Us Today"
                    />
                  </div>
                  <div>
                    <Label>Secondary Button Text</Label>
                    <Input
                      value={heroContent.cta_secondary}
                      onChange={(e) => setHeroContent({ ...heroContent, cta_secondary: e.target.value })}
                      placeholder="Our Services"
                    />
                  </div>
                </div>
                <Button onClick={saveHero} className="gap-2" disabled={upsertContentMutation.isPending}>
                  <Save className="h-4 w-4" />
                  Save Hero Section
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEATURES TAB */}
          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Features Strip</CardTitle>
                <CardDescription>Edit the 4 feature highlights shown below the hero</CardDescription>
              </CardHeader>
            </Card>

            {features.map((feature, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Icon</Label>
                      <Select
                        value={feature.icon}
                        onValueChange={(value) => updateFeature(index, "icon", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableIcons.map((icon) => (
                            <SelectItem key={icon.key} value={icon.key}>
                              <div className="flex items-center gap-2">
                                <icon.icon className="h-4 w-4" />
                                {icon.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={feature.title}
                        onChange={(e) => updateFeature(index, "title", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={feature.description}
                        onChange={(e) => updateFeature(index, "description", e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button onClick={saveFeatures} className="gap-2" disabled={upsertContentMutation.isPending}>
              <Save className="h-4 w-4" />
              Save All Features
            </Button>
          </TabsContent>

          {/* SERVICES TAB */}
          <TabsContent value="services" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services Showcase</CardTitle>
                    <CardDescription>Manage the services displayed on your landing page</CardDescription>
                  </div>
                  <Button onClick={() => addServiceMutation.mutate()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Service
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {servicesLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                </CardContent>
              </Card>
            ) : (
              services?.map((service: any) => (
                <Card key={service.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <CardTitle>{service.title}</CardTitle>
                          <CardDescription>Order: {service.display_order}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {service.is_featured && <Badge variant="secondary">Featured</Badge>}
                        <Switch
                          checked={service.is_visible}
                          onCheckedChange={(checked) =>
                            updateServiceMutation.mutate({ ...service, is_visible: checked })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteServiceMutation.mutate(service.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={service.title}
                          onChange={(e) => {
                            const updated = { ...service, title: e.target.value };
                            queryClient.setQueryData(["service-showcase-admin"], (old: any) =>
                              old.map((s: any) => (s.id === service.id ? updated : s))
                            );
                          }}
                          onBlur={() => updateServiceMutation.mutate(service)}
                        />
                      </div>
                      <div>
                        <Label>Price</Label>
                        <Input
                          value={service.price || ""}
                          onChange={(e) => {
                            const updated = { ...service, price: e.target.value };
                            queryClient.setQueryData(["service-showcase-admin"], (old: any) =>
                              old.map((s: any) => (s.id === service.id ? updated : s))
                            );
                          }}
                          onBlur={() => updateServiceMutation.mutate(service)}
                          placeholder="e.g., Starting at UGX 500"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={service.description || ""}
                        onChange={(e) => {
                          const updated = { ...service, description: e.target.value };
                          queryClient.setQueryData(["service-showcase-admin"], (old: any) =>
                            old.map((s: any) => (s.id === service.id ? updated : s))
                          );
                        }}
                        onBlur={() => updateServiceMutation.mutate(service)}
                        rows={2}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={service.is_featured}
                          onCheckedChange={(checked) =>
                            updateServiceMutation.mutate({ ...service, is_featured: checked })
                          }
                        />
                        <Label>Featured</Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ABOUT TAB */}
          <TabsContent value="about">
            <Card>
              <CardHeader>
                <CardTitle>About Section</CardTitle>
                <CardDescription>Edit the about us section content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Section Title</Label>
                  <Input
                    value={aboutContent.title}
                    onChange={(e) => setAboutContent({ ...aboutContent, title: e.target.value })}
                    placeholder="Your Trusted Digital Hub in Kasangati"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={aboutContent.description}
                    onChange={(e) => setAboutContent({ ...aboutContent, description: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4">
                    <Label className="text-lg font-semibold mb-2 block">Stat 1</Label>
                    <div className="space-y-2">
                      <div>
                        <Label>Number/Value</Label>
                        <Input
                          value={aboutContent.stat1_number}
                          onChange={(e) => setAboutContent({ ...aboutContent, stat1_number: e.target.value })}
                          placeholder="1000+"
                        />
                      </div>
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={aboutContent.stat1_label}
                          onChange={(e) => setAboutContent({ ...aboutContent, stat1_label: e.target.value })}
                          placeholder="Happy Customers"
                        />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <Label className="text-lg font-semibold mb-2 block">Stat 2</Label>
                    <div className="space-y-2">
                      <div>
                        <Label>Number/Value</Label>
                        <Input
                          value={aboutContent.stat2_number}
                          onChange={(e) => setAboutContent({ ...aboutContent, stat2_number: e.target.value })}
                          placeholder="24/7"
                        />
                      </div>
                      <div>
                        <Label>Label</Label>
                        <Input
                          value={aboutContent.stat2_label}
                          onChange={(e) => setAboutContent({ ...aboutContent, stat2_label: e.target.value })}
                          placeholder="Support Available"
                        />
                      </div>
                    </div>
                  </Card>
                </div>
                <Button onClick={saveAbout} className="gap-2" disabled={upsertContentMutation.isPending}>
                  <Save className="h-4 w-4" />
                  Save About Section
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTACT TAB */}
          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle>Contact Section</CardTitle>
                <CardDescription>Edit contact section headings and buttons</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Section Title</Label>
                    <Input
                      value={contactContent.title}
                      onChange={(e) => setContactContent({ ...contactContent, title: e.target.value })}
                      placeholder="Visit Us Today"
                    />
                  </div>
                  <div>
                    <Label>Subtitle</Label>
                    <Input
                      value={contactContent.subtitle}
                      onChange={(e) => setContactContent({ ...contactContent, subtitle: e.target.value })}
                      placeholder="We are ready to serve you!"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Primary CTA Button Text</Label>
                    <Input
                      value={contactContent.cta_text}
                      onChange={(e) => setContactContent({ ...contactContent, cta_text: e.target.value })}
                      placeholder="Sign In to Dashboard"
                    />
                  </div>
                  <div>
                    <Label>WhatsApp Button Text</Label>
                    <Input
                      value={contactContent.whatsapp_text}
                      onChange={(e) => setContactContent({ ...contactContent, whatsapp_text: e.target.value })}
                      placeholder="Chat on WhatsApp"
                    />
                  </div>
                </div>
                <div>
                  <Label>WhatsApp Number (without +)</Label>
                  <Input
                    value={contactContent.whatsapp_number}
                    onChange={(e) => setContactContent({ ...contactContent, whatsapp_number: e.target.value })}
                    placeholder="256745368426"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Note: Phone, Email, and Address are managed in Settings → Business Info
                </p>
                <Button onClick={saveContact} className="gap-2" disabled={upsertContentMutation.isPending}>
                  <Save className="h-4 w-4" />
                  Save Contact Section
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FOOTER TAB */}
          <TabsContent value="footer">
            <Card>
              <CardHeader>
                <CardTitle>Footer Section</CardTitle>
                <CardDescription>Edit footer text and credits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Copyright Text (appears after year and business name)</Label>
                  <Input
                    value={footerContent.copyright}
                    onChange={(e) => setFooterContent({ ...footerContent, copyright: e.target.value })}
                    placeholder="All rights reserved."
                  />
                </div>
                <div>
                  <Label>Made By / Credits Text</Label>
                  <Input
                    value={footerContent.made_by}
                    onChange={(e) => setFooterContent({ ...footerContent, made_by: e.target.value })}
                    placeholder="Made with Love by ..."
                  />
                </div>
                <Button onClick={saveFooter} className="gap-2" disabled={upsertContentMutation.isPending}>
                  <Save className="h-4 w-4" />
                  Save Footer
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
