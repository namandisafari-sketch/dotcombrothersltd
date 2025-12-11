import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

interface SimCardSettingsProps {
  departmentId: string;
}

export const SimCardSettings = ({ departmentId }: SimCardSettingsProps) => {
  const queryClient = useQueryClient();
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [helpCodes, setHelpCodes] = useState({
    checkBalance: "Dial *165# or *131#",
    mobileMoney: "Dial *165# (MTN) or *185# (Airtel)",
    customerCare: "Dial 100 (MTN) or 175 (Airtel)",
    checkNumber: "Dial *135# or *131*1#",
    dataBalance: "Dial *131*4# or *165*4#",
  });

  const [internetSettings, setInternetSettings] = useState({
    automatic: "Dial *165*4# and follow prompts",
    sms: 'Send "Internet" to 165 via SMS',
    manual: "Go to Settings → Mobile Networks → Access Point Names",
    apn: "internet / wap.airtel.com",
  });

  const [warnings, setWarnings] = useState([
    "Keep your SIM card PIN secure and never share it",
    "Register your number with mobile money for financial transactions",
    "Contact customer care immediately if you lose your SIM card",
    "Update your personal information regularly with the network provider",
    "Beware of fraudulent calls asking for personal information",
    "Use official channels for all mobile money transactions",
  ]);

  // Fetch existing settings
  const { data: settings } = useQuery({
    queryKey: ["sim-card-settings", departmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_settings")
        .select("*")
        .eq("department_id", departmentId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!departmentId && departmentId.length > 0,
  });

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!departmentId || departmentId.length === 0) {
        throw new Error("Department ID is required");
      }
      
      const settingsData = {
        help_codes: helpCodes,
        internet_settings: internetSettings,
        sim_warnings: warnings,
        logo_url: logoUrl,
      };

      // Store in department_settings as additional JSON field or create separate table
      // For now, we'll use the seasonal_remark field as a JSON store
      const { error } = await supabase
        .from("department_settings")
        .upsert({
          department_id: departmentId,
          seasonal_remark: JSON.stringify(settingsData),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SIM card settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["sim-card-settings"] });
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  // Load settings on mount
  useEffect(() => {
    if (settings?.seasonal_remark) {
      try {
        const parsed = JSON.parse(settings.seasonal_remark);
        if (parsed.help_codes) setHelpCodes(parsed.help_codes);
        if (parsed.internet_settings) setInternetSettings(parsed.internet_settings);
        if (parsed.sim_warnings) setWarnings(parsed.sim_warnings);
        if (parsed.logo_url) setLogoUrl(parsed.logo_url);
      } catch (e) {
        // Invalid JSON, keep defaults
      }
    }
    // Check settings_json for logo_url as fallback
    const settingsJson = settings?.settings_json as any;
    if (settingsJson?.logo_url) {
      setLogoUrl(settingsJson.logo_url);
    }
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image dimensions
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    if (img.width !== 1536 || img.height !== 2048) {
      toast.error("Image must be exactly 1536 × 2048 pixels");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${departmentId}-logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("department-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("department-logos")
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      toast.error("Failed to upload logo: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    toast.success("Logo removed");
  };

  const handleAddWarning = () => {
    setWarnings([...warnings, ""]);
  };

  const handleRemoveWarning = (index: number) => {
    setWarnings(warnings.filter((_, i) => i !== index));
  };

  const handleWarningChange = (index: number, value: string) => {
    const updated = [...warnings];
    updated[index] = value;
    setWarnings(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SIM Card Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Card Logo (1536 × 2048 pixels)</h3>
          <div className="space-y-3">
            {logoUrl && (
              <div className="relative w-32 h-42 border rounded">
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-1 right-1"
                  onClick={handleRemoveLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div>
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 border-2 border-dashed rounded p-4 hover:bg-accent">
                  <Upload className="h-5 w-5" />
                  <span>{uploading ? "Uploading..." : "Upload Logo (1536 × 2048)"}</span>
                </div>
              </Label>
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Help Codes Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Quick Self-Help Codes</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Check Balance</Label>
              <Input
                value={helpCodes.checkBalance}
                onChange={(e) =>
                  setHelpCodes({ ...helpCodes, checkBalance: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Mobile Money</Label>
              <Input
                value={helpCodes.mobileMoney}
                onChange={(e) =>
                  setHelpCodes({ ...helpCodes, mobileMoney: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Customer Care</Label>
              <Input
                value={helpCodes.customerCare}
                onChange={(e) =>
                  setHelpCodes({ ...helpCodes, customerCare: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Check Number</Label>
              <Input
                value={helpCodes.checkNumber}
                onChange={(e) =>
                  setHelpCodes({ ...helpCodes, checkNumber: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Data Balance</Label>
              <Input
                value={helpCodes.dataBalance}
                onChange={(e) =>
                  setHelpCodes({ ...helpCodes, dataBalance: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Internet Settings Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Internet Settings</h3>
          <div className="space-y-3">
            <div>
              <Label>Automatic Settings</Label>
              <Input
                value={internetSettings.automatic}
                onChange={(e) =>
                  setInternetSettings({ ...internetSettings, automatic: e.target.value })
                }
              />
            </div>
            <div>
              <Label>SMS Method</Label>
              <Input
                value={internetSettings.sms}
                onChange={(e) =>
                  setInternetSettings({ ...internetSettings, sms: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Manual Instructions</Label>
              <Input
                value={internetSettings.manual}
                onChange={(e) =>
                  setInternetSettings({ ...internetSettings, manual: e.target.value })
                }
              />
            </div>
            <div>
              <Label>APN Name</Label>
              <Input
                value={internetSettings.apn}
                onChange={(e) =>
                  setInternetSettings({ ...internetSettings, apn: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Warnings Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Important Warnings & Remarks</h3>
            <Button size="sm" onClick={handleAddWarning}>
              Add Warning
            </Button>
          </div>
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className="flex gap-2">
                <Textarea
                  value={warning}
                  onChange={(e) => handleWarningChange(index, e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleRemoveWarning(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

