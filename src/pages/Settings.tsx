import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { DepartmentManager } from "@/components/DepartmentManager";
import { DataBackup } from "@/components/DataBackup";
import { MobileMoneySettings } from "@/components/settings/MobileMoneySettings";
import { ReceiptPreview } from "@/components/settings/ReceiptPreview";
import { DemoModeToggle } from "@/components/DemoModeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Upload, QrCode, Bell, Mail, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import logoImage from "@/assets/logo.png";
import { useUserRole } from "@/hooks/useUserRole";

const Settings = () => {
  const queryClient = useQueryClient();
  const { isAdmin, departmentId } = useUserRole();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [formData, setFormData] = useState({
    business_name: "",
    business_address: "",
    business_phone: "",
    business_email: "",
    whatsapp_number: "",
    logo_url: logoImage,
    receipt_logo_url: "",
    website: "",
    seasonal_remark: "",
    show_back_page: true,
    report_email_enabled: false,
    report_email_time: "08:00",
    report_email_frequency: "daily",
    admin_report_email: "",
    timezone_offset: 3,
  });
  const [isSendingTestReport, setIsSendingTestReport] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptLogoInputRef = useRef<HTMLInputElement>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: globalSettings } = useQuery({
    queryKey: ["global-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").is("department_id", null).maybeSingle();
      return data;
    },
  });

  const { data: departmentSettings } = useQuery({
    queryKey: ["department-settings", selectedDepartmentId],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("department_id", selectedDepartmentId).maybeSingle();
      return data;
    },
    enabled: !!selectedDepartmentId && selectedDepartmentId !== "global",
  });

  useEffect(() => {
    if (!isAdmin && departmentId) {
      setSelectedDepartmentId(departmentId);
    } else if (isAdmin && !selectedDepartmentId) {
      setSelectedDepartmentId("global");
    }
  }, [isAdmin, departmentId]);

  useEffect(() => {
    const settings = (selectedDepartmentId && selectedDepartmentId !== "global") ? departmentSettings : globalSettings;
    if (settings) {
      setFormData({
        business_name: settings.business_name || "",
        business_address: settings.business_address || "",
        business_phone: settings.business_phone || "",
        business_email: settings.business_email || "",
        whatsapp_number: settings.whatsapp_number || "",
        logo_url: settings.logo_url || logoImage,
        receipt_logo_url: (settings as any).receipt_logo_url || "",
        website: (settings as any).website || "",
        seasonal_remark: (settings as any).seasonal_remark || "",
        show_back_page: (settings as any).show_back_page === true,
        report_email_enabled: (settings as any).report_email_enabled || false,
        report_email_time: (settings as any).report_email_time || "08:00",
        report_email_frequency: (settings as any).report_email_frequency || "daily",
        admin_report_email: (settings as any).admin_report_email || "",
        timezone_offset: (settings as any).settings_json?.timezone_offset ?? 3,
      });
    } else if (selectedDepartmentId && selectedDepartmentId !== "global" && !departmentSettings) {
      setFormData({
        business_name: "",
        business_address: "",
        business_phone: "",
        business_email: "",
        whatsapp_number: "",
        logo_url: logoImage,
        receipt_logo_url: "",
        website: "",
        seasonal_remark: "",
        show_back_page: true,
        report_email_enabled: false,
        report_email_time: "08:00",
        report_email_frequency: "daily",
        admin_report_email: "",
        timezone_offset: 3,
      });
    }
  }, [selectedDepartmentId, departmentSettings, globalSettings]);

  useEffect(() => {
    if (formData.whatsapp_number) {
      const message = "Hello! I'd like to connect with Dotcom Brothers Ltd.";
      const whatsappUrl = `https://wa.me/${formData.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

      QRCode.toDataURL(whatsappUrl, { width: 200 })
        .then(setQrCodeUrl)
        .catch(() => toast.error("Failed to generate QR code"));
    }
  }, [formData.whatsapp_number]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { timezone_offset, ...rest } = data;
      const settingsPayload = {
        ...rest,
        settings_json: {
          ...(globalSettings?.settings_json as any || {}),
          timezone_offset: timezone_offset
        }
      };

      if (selectedDepartmentId && selectedDepartmentId !== "global") {
        const { data: existing } = await supabase.from("settings").select("id").eq("department_id", selectedDepartmentId).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("settings").update(settingsPayload).eq("department_id", selectedDepartmentId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("settings").insert({ ...settingsPayload, department_id: selectedDepartmentId });
          if (error) throw error;
        }
      } else {
        const { data: existing } = await supabase.from("settings").select("id").is("department_id", null).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("settings").update(settingsPayload).is("department_id", null);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("settings").insert(settingsPayload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["global-settings"] });
      queryClient.invalidateQueries({ queryKey: ["department-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: any) => {
      console.error("Settings update error:", error);
      toast.error("Failed to update settings");
    },
  });

  const sendWhatsAppNotificationMutation = useMutation({
    mutationFn: async () => {
      // TODO: Implement WhatsApp notification in local backend
      throw new Error("WhatsApp notification not yet implemented in local backend");
    },
    onSuccess: () => {
      toast.success("WhatsApp notification sent successfully");
    },
    onError: (error: any) => {
      console.error("WhatsApp notification error:", error);
      toast.error("Failed to send WhatsApp notification");
    },
  });

  return (
    <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 pt-24">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Settings</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {selectedDepartmentId && selectedDepartmentId !== "global"
              ? "Set up department-specific business info for receipts"
              : "Set up global business info"}
          </p>
        </div>

        {isAdmin && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label>Select Department (optional)</Label>
                <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Global Settings (all departments)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global Settings</SelectItem>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Department settings override global settings for receipts
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="business" className="space-y-6">
          <TabsList>
            <TabsTrigger value="business">Business Info</TabsTrigger>
            <TabsTrigger value="mobile-money">Mobile Money</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="business">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5" />
                    Business Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input
                      value={formData.business_name}
                      onChange={(e) =>
                        setFormData({ ...formData, business_name: e.target.value })
                      }
                      placeholder="Dotcom Brothers Ltd"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={formData.business_address}
                      onChange={(e) =>
                        setFormData({ ...formData, business_address: e.target.value })
                      }
                      placeholder="Kampala, Uganda"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={formData.business_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, business_phone: e.target.value })
                      }
                      placeholder="+256..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.business_email}
                      onChange={(e) =>
                        setFormData({ ...formData, business_email: e.target.value })
                      }
                      placeholder="info@dotcombrothers.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>WhatsApp Number (Low Stock Alerts)</Label>
                    <Input
                      value={formData.whatsapp_number}
                      onChange={(e) =>
                        setFormData({ ...formData, whatsapp_number: e.target.value })
                      }
                      placeholder="+256..."
                    />
                    <p className="text-xs text-muted-foreground">
                      This number will receive low stock notifications via WhatsApp
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      type="url"
                      value={formData.website}
                      onChange={(e) =>
                        setFormData({ ...formData, website: e.target.value })
                      }
                      placeholder="https://dotcombrothers.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Seasonal Remark</Label>
                    <Input
                      value={formData.seasonal_remark}
                      onChange={(e) =>
                        setFormData({ ...formData, seasonal_remark: e.target.value })
                      }
                      placeholder="e.g., Merry Christmas, Happy New Year"
                    />
                    <p className="text-xs text-muted-foreground">
                      This message will appear on all receipts
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>Show Back Page on Receipts</Label>
                      <p className="text-xs text-muted-foreground">
                        Display "Powered by Kabejja Systems" section with QR codes
                      </p>
                    </div>
                    <Switch
                      checked={formData.show_back_page}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, show_back_page: checked })
                      }
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => updateSettingsMutation.mutate(formData)}
                  >
                    Save Changes
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Business Logo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={formData.logo_url}
                        alt="Business Logo"
                        className="w-32 h-32 object-contain border rounded-lg p-2"
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `logo_${Date.now()}.${fileExt}`;

                              const { error: uploadError } = await supabase.storage
                                .from('department-logos')
                                .upload(fileName, file, { upsert: true });

                              if (uploadError) throw uploadError;

                              const { data: urlData } = supabase.storage
                                .from('department-logos')
                                .getPublicUrl(fileName);

                              setFormData(prev => ({
                                ...prev,
                                logo_url: urlData.publicUrl,
                              }));
                              toast.success('Logo uploaded successfully');
                            } catch (error) {
                              console.error('Logo upload error:', error);
                              toast.error('Failed to upload logo');
                            }
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Logo
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setFormData({ ...formData, logo_url: logoImage })
                        }
                      >
                        Reset to Default
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Receipt Logo (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Use a different logo on receipts. If not set, the main business logo will be used.
                    </p>
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={formData.receipt_logo_url || formData.logo_url}
                        alt="Receipt Logo"
                        className="w-32 h-32 object-contain border rounded-lg p-2"
                      />
                      <input
                        type="file"
                        ref={receiptLogoInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `receipt_logo_${Date.now()}.${fileExt}`;

                              const { error: uploadError } = await supabase.storage
                                .from('department-logos')
                                .upload(fileName, file, { upsert: true });

                              if (uploadError) throw uploadError;

                              const { data: urlData } = supabase.storage
                                .from('department-logos')
                                .getPublicUrl(fileName);

                              setFormData(prev => ({
                                ...prev,
                                receipt_logo_url: urlData.publicUrl,
                              }));
                              toast.success('Receipt logo uploaded successfully');
                            } catch (error) {
                              console.error('Receipt logo upload error:', error);
                              toast.error('Failed to upload receipt logo');
                            }
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => receiptLogoInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Receipt Logo
                      </Button>
                      {formData.receipt_logo_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setFormData({ ...formData, receipt_logo_url: "" })
                          }
                        >
                          Use Main Logo Instead
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="w-5 h-5" />
                      WhatsApp QR Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {qrCodeUrl ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={qrCodeUrl} alt="WhatsApp QR Code" className="w-48 h-48" />
                        <p className="text-xs text-muted-foreground text-center">
                          Scan to chat on WhatsApp
                        </p>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground">
                        Enter WhatsApp number to generate QR code
                      </p>
                    )}
                  </CardContent>
                </Card>

                {isAdmin && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        Email Report Scheduling
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Receive daily or weekly reports of all departments via email.
                      </p>

                      <div className="space-y-2">
                        <Label>Admin Report Email</Label>
                        <Input
                          type="email"
                          value={formData.admin_report_email}
                          onChange={(e) =>
                            setFormData({ ...formData, admin_report_email: e.target.value })
                          }
                          placeholder="admin@example.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          Reports will be sent to this email address. Save settings before testing.
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={!formData.admin_report_email || isSendingTestReport}
                        onClick={async () => {
                          if (!formData.admin_report_email) {
                            toast.error("Please enter an admin report email first");
                            return;
                          }
                          setIsSendingTestReport(true);
                          try {
                            const response = await supabase.functions.invoke("send-admin-report", {
                              body: { testMode: true }
                            });
                            if (response.error) throw response.error;
                            const data = response.data;
                            if (data?.success) {
                              toast.success("Test report sent! Check your email.");
                            } else if (data?.message) {
                              toast.error(data.message);
                            } else {
                              toast.error("Unknown response from server");
                            }
                          } catch (error: any) {
                            console.error("Failed to send test report:", error);
                            toast.error("Failed to send test report: " + (error.message || "Unknown error"));
                          } finally {
                            setIsSendingTestReport(false);
                          }
                        }}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {isSendingTestReport ? "Sending..." : "Send Test Report Now"}
                      </Button>

                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg mb-4">
                          <div className="space-y-0.5">
                            <Label>Enable Scheduled Reports</Label>
                            <p className="text-xs text-muted-foreground">
                              Automatically send reports at scheduled times
                            </p>
                          </div>
                          <Switch
                            checked={formData.report_email_enabled}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, report_email_enabled: checked })
                            }
                          />
                        </div>
                        {formData.report_email_enabled && (
                          <>
                            <div className="space-y-2 mb-4">
                              <Label className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Report Time
                              </Label>
                              <Input
                                type="time"
                                value={formData.report_email_time}
                                onChange={(e) =>
                                  setFormData({ ...formData, report_email_time: e.target.value })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                ⏰ Report will be sent at this exact time in your configured timezone. The system checks every 30 minutes, so delivery occurs within the scheduled hour.
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Report Frequency</Label>
                              <Select
                                value={formData.report_email_frequency}
                                onValueChange={(value) =>
                                  setFormData({ ...formData, report_email_frequency: value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Timezone Offset (UTC)</Label>
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                  Set your timezone to ensure reports are sent at the exact time you configure. Reports are scheduled in your local timezone.
                                </p>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={formData.timezone_offset.toString()}
                                    onValueChange={(value) =>
                                      setFormData({ ...formData, timezone_offset: parseInt(value) })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: 27 }, (_, i) => i - 12).map((offset) => (
                                        <SelectItem key={offset} value={offset.toString()}>
                                          UTC {offset >= 0 ? "+" : ""}{offset}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded">
                                  📍 Example: Uganda = UTC+3, Kenya = UTC+3, South Africa = UTC+2
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {isAdmin && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        Low Stock Notifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Send WhatsApp notifications when products are running low on stock.
                      </p>
                      <Button
                        onClick={() => sendWhatsAppNotificationMutation.mutate()}
                        disabled={!formData.whatsapp_number || sendWhatsAppNotificationMutation.isPending}
                        className="w-full"
                      >
                        <Bell className="w-4 h-4 mr-2" />
                        {sendWhatsAppNotificationMutation.isPending ? "Sending..." : "Send Test Notification"}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <ReceiptPreview
                  businessInfo={{
                    name: formData.business_name,
                    address: formData.business_address,
                    phone: formData.business_phone,
                    email: formData.business_email,
                    logo: formData.receipt_logo_url || formData.logo_url,
                    seasonalRemark: formData.seasonal_remark,
                    website: formData.website,
                    whatsapp: formData.whatsapp_number,
                  }}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>System Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-medium">1.0.0</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Default Currency</span>
                        <span className="font-medium">UGX</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">System Status</span>
                        <span className="font-medium text-success">Active</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Training & Demo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DemoModeToggle />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mobile-money">
            <MobileMoneySettings departmentId={selectedDepartmentId || departmentId} />
          </TabsContent>

          <TabsContent value="departments">
            <DepartmentManager />
          </TabsContent>

          <TabsContent value="backup">
            <DataBackup />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;