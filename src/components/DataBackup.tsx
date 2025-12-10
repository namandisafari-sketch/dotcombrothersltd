import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Database, Upload, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TABLES = [
  { name: "departments", label: "Departments" },
  { name: "products", label: "Products" },
  { name: "services", label: "Services" },
  { name: "customers", label: "Customers" },
  { name: "sales", label: "Sales" },
  { name: "sale_items", label: "Sale Items" },
  { name: "expenses", label: "Expenses" },
  { name: "categories", label: "Categories" },
  { name: "reconciliations", label: "Reconciliations" },
  { name: "internal_stock_usage", label: "Internal Stock Usage" },
  { name: "customer_preferences", label: "Customer Preferences" },
  { name: "credits", label: "Credits" },
  { name: "department_settings", label: "Department Settings" },
  { name: "perfume_pricing_config", label: "Perfume Pricing Config" },
  { name: "perfume_scents", label: "Perfume Scents" },
];

export function DataBackup() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>(TABLES.map(t => t.name));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTable = (tableName: string) => {
    setSelectedTables(prev =>
      prev.includes(tableName)
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const exportData = async () => {
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table to export");
      return;
    }

    try {
      setIsExporting(true);
      const backupData: {
        exported_at: string;
        version: string;
        tables: Record<string, any[]>;
      } = {
        exported_at: new Date().toISOString(),
        version: "1.0",
        tables: {},
      };

      for (const tableName of selectedTables) {
        try {
          const { data, error } = await supabase.from(tableName as any).select("*");
          if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            backupData.tables[tableName] = [];
          } else {
            backupData.tables[tableName] = data || [];
          }
        } catch (error) {
          console.error(`Error fetching ${tableName}:`, error);
          backupData.tables[tableName] = [];
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dotcom-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const selectAll = () => {
    setSelectedTables(TABLES.map(t => t.name));
  };

  const deselectAll = () => {
    setSelectedTables([]);
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.tables || typeof backupData.tables !== 'object') {
        toast.error("Invalid backup file format");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const [tableName, records] of Object.entries(backupData.tables)) {
        if (!Array.isArray(records) || records.length === 0) continue;

        try {
          const { error } = await supabase.from(tableName as any).upsert(records as any);
          if (error) {
            console.error(`Failed to import ${tableName}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to import ${tableName}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} table(s)`);
      }
      if (errorCount > 0) {
        toast.warning(`Failed to import ${errorCount} table(s)`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import data. Please check the file format.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const deleteAllData = async () => {
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table to delete");
      return;
    }

    try {
      setIsDeleting(true);
      
      toast.info("Creating backup before deletion...");
      await exportData();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let successCount = 0;
      let errorCount = 0;
      const failedTables: string[] = [];

      const orderedTables = [
        'sale_items',
        'sales',
        'internal_stock_usage',
        'customer_preferences',
        'reconciliations',
        'credits',
        'expenses',
        'products',
        'services',
        'customers',
        'department_settings',
        'perfume_pricing_config',
        'perfume_scents',
        'categories',
        'departments'
      ];

      const tablesToDelete = orderedTables.filter(table => 
        selectedTables.includes(table)
      );

      for (const tableName of tablesToDelete) {
        try {
          const { error } = await supabase.from(tableName as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) {
            console.error(`Failed to delete from ${tableName}:`, error);
            failedTables.push(tableName);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to delete from ${tableName}:`, err);
          failedTables.push(tableName);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully deleted data from ${successCount} table(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to delete from: ${failedTables.join(', ')}`);
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete data");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Backup & Restore
        </CardTitle>
        <CardDescription>
          Save or restore your business data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Deselect All
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TABLES.map((table) => (
            <div key={table.name} className="flex items-center space-x-2">
              <Checkbox
                id={table.name}
                checked={selectedTables.includes(table.name)}
                onCheckedChange={() => toggleTable(table.name)}
              />
              <Label
                htmlFor={table.name}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {table.label}
              </Label>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={exportData}
            disabled={isExporting || selectedTables.length === 0}
            className="w-full"
            size="lg"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Saving..." : "Save Backup"}
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? "Loading..." : "Restore Backup"}
          </Button>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={isDeleting || selectedTables.length === 0}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete All Data"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all data from the selected tables. 
                A backup will be created automatically before deletion, but this action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteAllData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete All Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={importData}
          className="hidden"
        />

        <p className="text-xs text-muted-foreground text-center">
          Save creates a backup file. Restore loads data from a backup file. Delete removes all data from selected tables after creating a backup.
        </p>
      </CardContent>
    </Card>
  );
}
