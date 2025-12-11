import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, Search, Edit, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { printSimCard, printSimCardBatch } from "@/utils/simCardPrinter";
import QRCode from "qrcode";

interface CustomerRegistrationProps {
  departmentId: string;
}

export function CustomerRegistration({ departmentId }: CustomerRegistrationProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState("Airtel");

  const [formData, setFormData] = useState({
    id: "",
    service_type: "sim_registration",
    customer_name: "",
    customer_phone: "",
    customer_id_type: "national_id",
    customer_id_number: "",
    customer_address: "",
  });

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["sensitive-registrations", departmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sensitive_service_registrations")
        .select("*")
        .eq("department_id", departmentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!departmentId && departmentId.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!departmentId || departmentId.length === 0) {
        throw new Error("Department ID is required");
      }
      if (editMode && data.id) {
        const { id, ...updateData } = data;
        const { error } = await supabase
          .from("sensitive_service_registrations")
          .update(updateData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { id, ...insertData } = data;
        const { error } = await supabase
          .from("sensitive_service_registrations")
          .insert({
            ...insertData,
            department_id: departmentId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editMode ? "Registration updated successfully" : "Registration saved successfully");
      queryClient.invalidateQueries({ queryKey: ["sensitive-registrations"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(`Failed to ${editMode ? "update" : "save"} registration: ` + error.message);
    },
  });

  const resetForm = () => {
    setEditMode(false);
    setFormData({
      id: "",
      service_type: "sim_registration",
      customer_name: "",
      customer_phone: "",
      customer_id_type: "national_id",
      customer_id_number: "",
      customer_address: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleEdit = (registration: any) => {
    setEditMode(true);
    setFormData({
      id: registration.id,
      service_type: registration.service_type,
      customer_name: registration.customer_name,
      customer_phone: registration.customer_phone,
      customer_id_type: registration.customer_id_type || "national_id",
      customer_id_number: registration.customer_id_number || "",
      customer_address: registration.customer_address || "",
    });
    setDialogOpen(true);
  };

  const generateQRCode = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text, { width: 100, margin: 1 });
    } catch (error) {
      console.error("QR code generation failed:", error);
      return "";
    }
  };

  const handlePrintCard = async (registration: any, selectedProvider?: string) => {
    const { data: deptSettings } = await supabase
      .from("settings")
      .select("*")
      .eq("department_id", departmentId)
      .single();
    
    const { data: globalSettings } = await supabase
      .from("settings")
      .select("*")
      .is("department_id", null)
      .single();

    const settings = deptSettings || globalSettings;

    let cardSettings = null;
    try {
      if (settings?.seasonal_remark) {
        cardSettings = JSON.parse(settings.seasonal_remark);
      }
    } catch (e) {
      // Invalid JSON
    }

    const qrCodeUrl = settings?.whatsapp_number 
      ? await generateQRCode(`https://wa.me/${settings.whatsapp_number.replace(/\+/g, "")}`)
      : "";

    printSimCard({
      customerName: registration.customer_name,
      phoneNumber: registration.customer_phone,
      registrationDate: format(new Date(registration.created_at), "PPP"),
      serviceType: registration.service_type.replace(/_/g, " ").toUpperCase(),
      provider: selectedProvider || provider,
      idType: registration.customer_id_type,
      idNumber: registration.customer_id_number,
      businessName: settings?.business_name || "DOTCOM BROTHERS LTD",
      departmentName: settings?.business_name,
      businessPhone: settings?.business_phone,
      whatsappNumber: settings?.whatsapp_number,
      logoUrl: cardSettings?.logo_url || settings?.logo_url,
      helpCodes: cardSettings?.help_codes,
      warnings: cardSettings?.sim_warnings,
      qrCodeUrl,
    });

    toast.success("Card opened for printing");
  };

  const handlePrintBatch = async () => {
    if (selectedCards.size === 0) {
      toast.error("Please select cards to print");
      return;
    }

    const selectedRegs = registrations?.filter((reg) => selectedCards.has(reg.id)) || [];
    
    const { data: deptSettings } = await supabase
      .from("settings")
      .select("*")
      .eq("department_id", departmentId)
      .single();
    
    const { data: globalSettings } = await supabase
      .from("settings")
      .select("*")
      .is("department_id", null)
      .single();

    const settings = deptSettings || globalSettings;

    let cardSettings = null;
    try {
      if (settings?.seasonal_remark) {
        cardSettings = JSON.parse(settings.seasonal_remark);
      }
    } catch (e) {
      // Invalid JSON
    }

    const qrCodeUrl = settings?.whatsapp_number 
      ? await generateQRCode(`https://wa.me/${settings.whatsapp_number.replace(/\+/g, "")}`)
      : "";

    const cardData = selectedRegs.map((reg) => ({
      customerName: reg.customer_name,
      phoneNumber: reg.customer_phone,
      registrationDate: format(new Date(reg.created_at), "PPP"),
      serviceType: reg.service_type.replace(/_/g, " ").toUpperCase(),
      provider,
      idType: reg.customer_id_type,
      idNumber: reg.customer_id_number,
      businessName: settings?.business_name || "DOTCOM BROTHERS LTD",
      departmentName: settings?.business_name,
      businessPhone: settings?.business_phone,
      whatsappNumber: settings?.whatsapp_number,
      logoUrl: cardSettings?.logo_url || settings?.logo_url,
      helpCodes: cardSettings?.help_codes,
      warnings: cardSettings?.sim_warnings,
      qrCodeUrl,
    }));

    printSimCardBatch(cardData);
    toast.success(`Printing ${selectedCards.size} cards`);
  };

  const toggleCardSelection = (id: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCards(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCards.size === filteredRegistrations?.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(filteredRegistrations?.map((r) => r.id) || []));
    }
  };

  const filteredRegistrations = registrations?.filter((reg) =>
    reg.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.customer_phone.includes(searchTerm) ||
    reg.customer_id_number?.includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or ID number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label>Provider:</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Airtel">Airtel</SelectItem>
              <SelectItem value="MTN">MTN</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedCards.size > 0 && (
          <Button onClick={handlePrintBatch} variant="secondary">
            <Printer className="mr-2 h-4 w-4" />
            Print {selectedCards.size} Cards
          </Button>
        )}
        
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Registration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editMode ? "Edit Registration" : "New Registration"}</DialogTitle>
              <DialogDescription>
                {editMode 
                  ? "Update customer registration information" 
                  : "Register a new customer for sensitive services"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Service Type</Label>
                  <Select
                    value={formData.service_type}
                    onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim_registration">SIM Card Registration</SelectItem>
                      <SelectItem value="account_opening">Account Opening</SelectItem>
                      <SelectItem value="kyc_verification">KYC Verification</SelectItem>
                      <SelectItem value="other">Other Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>ID Type</Label>
                  <Select
                    value={formData.customer_id_type}
                    onValueChange={(value) => setFormData({ ...formData, customer_id_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national_id">National ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="driving_license">Driving License</SelectItem>
                      <SelectItem value="voter_id">Voter ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name *</Label>
                  <Input
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Phone Number *</Label>
                  <Input
                    required
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>ID Number</Label>
                <Input
                  value={formData.customer_id_number}
                  onChange={(e) => setFormData({ ...formData, customer_id_number: e.target.value })}
                />
              </div>

              <div>
                <Label>Address</Label>
                <Textarea
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editMode ? "Update Registration" : "Save Registration"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Registrations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filteredRegistrations && filteredRegistrations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedCards.size === filteredRegistrations?.length && filteredRegistrations.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedCards.has(reg.id)}
                        onCheckedChange={() => toggleCardSelection(reg.id)}
                      />
                    </TableCell>
                    <TableCell>{format(new Date(reg.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {reg.service_type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{reg.customer_name}</TableCell>
                    <TableCell>{reg.customer_phone}</TableCell>
                    <TableCell>{reg.customer_id_number || "N/A"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedRegistration(reg);
                            setViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(reg)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {reg.service_type === "sim_registration" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrintCard(reg)}
                            title="Print single card"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No customer registrations found
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registration Details</DialogTitle>
            <DialogDescription>
              View complete customer registration information
            </DialogDescription>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Service Type</Label>
                  <p className="font-medium">{selectedRegistration.service_type?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Registration Date</Label>
                  <p className="font-medium">{format(new Date(selectedRegistration.created_at), "PPP")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium">{selectedRegistration.customer_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone Number</Label>
                  <p className="font-medium">{selectedRegistration.customer_phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">ID Type</Label>
                  <p className="font-medium">{selectedRegistration.customer_id_type?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ID Number</Label>
                  <p className="font-medium">{selectedRegistration.customer_id_number || "N/A"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Address</Label>
                <p className="font-medium">{selectedRegistration.customer_address || "N/A"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
