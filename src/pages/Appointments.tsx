import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import { DepartmentSelector } from "@/components/DepartmentSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Clock, User, Receipt, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useDepartment } from "@/contexts/DepartmentContext";
import { useUserRole } from "@/hooks/useUserRole";
import { AppointmentCheckoutDialog } from "@/components/appointments/AppointmentCheckoutDialog";
import { customerSchema } from "@/lib/validation";

// Note: There's no appointments table in the current schema, so we'll create a simple in-memory solution
// or use a workaround with existing tables

const Appointments = () => {
  const queryClient = useQueryClient();
  const { selectedDepartmentId, selectedDepartment } = useDepartment();
  const { isAdmin } = useUserRole();
  const [appointmentForm, setAppointmentForm] = useState({
    customer_id: "",
    service_id: "",
    appointment_date: "",
    appointment_time: "",
    duration_minutes: 60,
    notes: "",
    assigned_staff: "",
  });
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  // In-memory appointments store (since there's no appointments table)
  const [localAppointments, setLocalAppointments] = useState<any[]>([]);

  const { data: customers } = useQuery({
    queryKey: ["customers", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("department_id", selectedDepartmentId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  const { data: services } = useQuery({
    queryKey: ["services", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("department_id", selectedDepartmentId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: typeof appointmentForm) => {
      const appointmentDateTime = `${data.appointment_date}T${data.appointment_time}:00`;
      const newAppointment = {
        id: crypto.randomUUID(),
        customer_id: data.customer_id || null,
        service_id: data.service_id || null,
        appointment_date: appointmentDateTime,
        duration_minutes: data.duration_minutes,
        notes: data.notes,
        assigned_staff: data.assigned_staff,
        status: "scheduled",
        customers: customers?.find(c => c.id === data.customer_id),
        services: services?.find(s => s.id === data.service_id),
      };
      setLocalAppointments(prev => [...prev, newAppointment]);
      return newAppointment;
    },
    onSuccess: () => {
      toast.success("Appointment scheduled successfully");
      setAppointmentForm({
        customer_id: "",
        service_id: "",
        appointment_date: "",
        appointment_time: "",
        duration_minutes: 60,
        notes: "",
        assigned_staff: "",
      });
    },
    onError: () => {
      toast.error("Failed to schedule appointment");
    },
  });

  const saveCustomerMutation = useMutation({
    mutationFn: async (data: typeof customerFormData) => {
      const validated = customerSchema.parse(data);
      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
          name: validated.name,
          email: validated.email ?? null,
          phone: validated.phone ?? null,
          address: validated.address ?? null,
          department_id: selectedDepartmentId,
        })
        .select()
        .single();
      if (error) throw error;
      return newCustomer;
    },
    onSuccess: (newCustomer) => {
      toast.success("Customer added successfully");
      setCustomerDialogOpen(false);
      setCustomerFormData({ name: "", phone: "", email: "", address: "" });
      setAppointmentForm({ ...appointmentForm, customer_id: newCustomer.id });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save customer");
    },
  });

  const updateAppointmentStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      setLocalAppointments(prev => 
        prev.map(apt => apt.id === id ? { ...apt, status } : apt)
      );
    },
    onSuccess: () => {
      toast.success("Appointment status updated");
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "default";
      case "in_progress":
        return "secondary";
      case "completed":
        return "outline";
      case "cancelled":
      case "no_show":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-32 lg:pt-20">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 pt-24">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">
              {selectedDepartment?.name || ""} Appointments
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">Manage service appointments and sessions</p>
          </div>
          {isAdmin && <DepartmentSelector />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Schedule Appointment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <div className="flex gap-2">
                    <Select
                      value={appointmentForm.customer_id}
                      onValueChange={(value) =>
                        setAppointmentForm({ ...appointmentForm, customer_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon">
                          <UserPlus className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Customer</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Customer Name *</Label>
                            <Input
                              value={customerFormData.name}
                              onChange={(e) =>
                                setCustomerFormData({ ...customerFormData, name: e.target.value })
                              }
                              placeholder="Full name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input
                              value={customerFormData.phone}
                              onChange={(e) =>
                                setCustomerFormData({ ...customerFormData, phone: e.target.value })
                              }
                              placeholder="+256..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={customerFormData.email}
                              onChange={(e) =>
                                setCustomerFormData({ ...customerFormData, email: e.target.value })
                              }
                              placeholder="email@example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Address</Label>
                            <Input
                              value={customerFormData.address}
                              onChange={(e) =>
                                setCustomerFormData({ ...customerFormData, address: e.target.value })
                              }
                              placeholder="Physical address"
                            />
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => saveCustomerMutation.mutate(customerFormData)}
                            disabled={!customerFormData.name}
                          >
                            Add Customer
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Service</Label>
                  <Select
                    value={appointmentForm.service_id}
                    onValueChange={(value) =>
                      setAppointmentForm({ ...appointmentForm, service_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services?.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={appointmentForm.appointment_date}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, appointment_date: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={appointmentForm.appointment_time}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, appointment_time: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={appointmentForm.duration_minutes}
                    onChange={(e) =>
                      setAppointmentForm({
                        ...appointmentForm,
                        duration_minutes: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assigned Staff</Label>
                  <Input
                    value={appointmentForm.assigned_staff}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, assigned_staff: e.target.value })
                    }
                    placeholder="Staff name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={appointmentForm.notes}
                    onChange={(e) =>
                      setAppointmentForm({ ...appointmentForm, notes: e.target.value })
                    }
                    placeholder="Additional information..."
                    rows={3}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => createAppointmentMutation.mutate(appointmentForm)}
                  disabled={
                    !appointmentForm.appointment_date || !appointmentForm.appointment_time
                  }
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Appointment
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {localAppointments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No appointments scheduled
                    </p>
                  ) : (
                    localAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="p-4 rounded-lg border bg-card space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium">
                                {appointment.customers?.name || "Walk-in"}
                              </p>
                              <Badge variant={getStatusColor(appointment.status)}>
                                {appointment.status}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {new Date(appointment.appointment_date).toLocaleDateString()}
                              </p>
                              <p className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {new Date(appointment.appointment_date).toLocaleTimeString()} (
                                {appointment.duration_minutes} min)
                              </p>
                              {appointment.assigned_staff && (
                                <p className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  {appointment.assigned_staff}
                                </p>
                              )}
                              <p>Service: {appointment.services?.name || "N/A"}</p>
                              {appointment.notes && <p>Notes: {appointment.notes}</p>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {appointment.status === "scheduled" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  updateAppointmentStatusMutation.mutate({
                                    id: appointment.id,
                                    status: "in_progress",
                                  })
                                }
                              >
                                Start
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateAppointmentStatusMutation.mutate({
                                    id: appointment.id,
                                    status: "cancelled",
                                  })
                                }
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          {appointment.status === "in_progress" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedAppointment(appointment);
                                  setCheckoutDialogOpen(true);
                                }}
                              >
                                <Receipt className="w-4 h-4 mr-2" />
                                Complete & Checkout
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateAppointmentStatusMutation.mutate({
                                    id: appointment.id,
                                    status: "completed",
                                  })
                                }
                              >
                                Mark Complete Only
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {selectedAppointment && (
        <AppointmentCheckoutDialog
          open={checkoutDialogOpen}
          onOpenChange={setCheckoutDialogOpen}
          appointment={selectedAppointment}
          departmentId={selectedDepartmentId!}
        />
      )}
    </div>
  );
};

export default Appointments;
