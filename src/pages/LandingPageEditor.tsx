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
import { toast } from "sonner";
import { Eye, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PasscodeDialog } from "@/components/PasscodeDialog";
import { useUserRole } from "@/hooks/useUserRole";

export default function LandingPageEditor() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState("content");
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

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

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["landing-page-content-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("landing_page_content").select("*").order("order_index");
      return data || [];
    },
  });

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["service-showcase-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("service_showcase").select("*").order("display_order");
      return data || [];
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("landing_page_content").update(data).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-content-admin"] });
      toast.success("Content updated successfully");
    },
    onError: () => {
      toast.error("Failed to update content");
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("service_showcase").update(data).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-showcase-admin"] });
      toast.success("Service updated successfully");
    },
    onError: () => {
      toast.error("Failed to update service");
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_showcase").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-showcase-admin"] });
      toast.success("Service deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete service");
    },
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
      toast.success("Service added successfully");
    },
    onError: () => {
      toast.error("Failed to add service");
    },
  });

  // Show passcode dialog if admin hasn't entered it yet
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Page Content</TabsTrigger>
            <TabsTrigger value="services">Services Showcase</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            {contentLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </CardContent>
              </Card>
            ) : (
              content?.map((section) => (
                <Card key={section.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="capitalize">{section.section_key} Section</CardTitle>
                        <CardDescription>Order: {section.order_index}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`visible-${section.id}`} className="text-sm">Visible</Label>
                        <Switch
                          id={`visible-${section.id}`}
                          checked={section.is_visible}
                          onCheckedChange={(checked) =>
                            updateContentMutation.mutate({ ...section, is_visible: checked })
                          }
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor={`title-${section.id}`}>Title</Label>
                      <Input
                        id={`title-${section.id}`}
                        value={section.title || ""}
                        onChange={(e) => {
                          const updated = { ...section, title: e.target.value };
                          queryClient.setQueryData(["landing-page-content-admin"], (old: any) =>
                            old.map((s: any) => (s.id === section.id ? updated : s))
                          );
                        }}
                        onBlur={() => updateContentMutation.mutate(section)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`image-${section.id}`}>Image URL</Label>
                      <Input
                        id={`image-${section.id}`}
                        value={section.image_url || ""}
                        onChange={(e) => {
                          const updated = { ...section, image_url: e.target.value };
                          queryClient.setQueryData(["landing-page-content-admin"], (old: any) =>
                            old.map((s: any) => (s.id === section.id ? updated : s))
                          );
                        }}
                        onBlur={() => updateContentMutation.mutate(section)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`content-${section.id}`}>Content</Label>
                      <Textarea
                        id={`content-${section.id}`}
                        value={section.content || ""}
                        onChange={(e) => {
                          const updated = { ...section, content: e.target.value };
                          queryClient.setQueryData(["landing-page-content-admin"], (old: any) =>
                            old.map((s: any) => (s.id === section.id ? updated : s))
                          );
                        }}
                        onBlur={() => updateContentMutation.mutate(section)}
                        rows={4}
                      />
                    </div>
                    <Button
                      onClick={() => updateContentMutation.mutate(section)}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </CardContent>
              </Card>
            ) : (
              services?.map((service) => (
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
                          placeholder="e.g., Starting at $99"
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
                    <div>
                      <Label>Image URL</Label>
                      <Input
                        value={service.image_url || ""}
                        onChange={(e) => {
                          const updated = { ...service, image_url: e.target.value };
                          queryClient.setQueryData(["service-showcase-admin"], (old: any) =>
                            old.map((s: any) => (s.id === service.id ? updated : s))
                          );
                        }}
                        onBlur={() => updateServiceMutation.mutate(service)}
                        placeholder="https://example.com/image.jpg"
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
                      <Button onClick={() => updateServiceMutation.mutate(service)} className="gap-2">
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
