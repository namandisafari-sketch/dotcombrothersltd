import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Database, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type ImportStatus = {
  table: string;
  status: "pending" | "importing" | "success" | "error";
  count?: number;
  error?: string;
};

export default function DataImport() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusList, setStatusList] = useState<ImportStatus[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [backupData, setBackupData] = useState<any>(null);

  const loadDefaultBackup = async () => {
    try {
      const response = await fetch('/backup.json');
      
      // Check if the response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('No backup file found. Please upload a custom backup file.');
      }
      
      if (!response.ok) {
        throw new Error('Failed to load backup file');
      }
      
      const data = await response.json();
      setBackupData(data);
      setFile(new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' }));
      toast.success("Backup file loaded successfully");
    } catch (error: any) {
      console.error("Error loading backup:", error);
      toast.error(error.message || "Failed to load backup file");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "application/json") {
        setFile(selectedFile);
        setBackupData(null); // Clear any loaded backup data
      } else {
        toast.error("Please select a valid JSON file");
      }
    }
  };

  const updateTableStatus = (table: string, update: Partial<ImportStatus>) => {
    setStatusList(prev =>
      prev.map(item => item.table === table ? { ...item, ...update } : item)
    );
  };

  const importData = async () => {
    if (!file && !backupData) {
      toast.error("Please load or select a backup file first");
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      let backup = backupData;
      
      if (!backup && file) {
        const fileContent = await file.text();
        backup = JSON.parse(fileContent);
      }

      if (!backup.tables) {
        throw new Error("Invalid backup file format");
      }

      const tables = Object.keys(backup.tables);
      const totalTables = tables.length;

      // Initialize status list
      setStatusList(
        tables.map(table => ({
          table,
          status: "pending",
          count: backup.tables[table]?.length || 0,
        }))
      );

      // Import tables in sequence
      for (let i = 0; i < tables.length; i++) {
        const tableName = tables[i];
        const records = backup.tables[tableName];

        if (!Array.isArray(records) || records.length === 0) {
          updateTableStatus(tableName, { status: "success", count: 0 });
          setProgress(((i + 1) / totalTables) * 100);
          continue;
        }

        updateTableStatus(tableName, { status: "importing" });

        try {
          // Import in batches of 100 records
          const batchSize = 100;
          for (let j = 0; j < records.length; j += batchSize) {
            const batch = records.slice(j, j + batchSize);
            
            const { error } = await (supabase as any)
              .from(tableName)
              .upsert(batch, { 
                onConflict: 'id',
                ignoreDuplicates: false 
              });

            if (error) {
              throw error;
            }
          }

          updateTableStatus(tableName, { 
            status: "success", 
            count: records.length 
          });
        } catch (error: any) {
          console.error(`Error importing ${tableName}:`, error);
          updateTableStatus(tableName, {
            status: "error",
            error: error.message || "Import failed",
          });
        }

        setProgress(((i + 1) / totalTables) * 100);
      }

      toast.success("Data import completed!");
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Failed to import data");
    } finally {
      setImporting(false);
    }
  };

  const hasErrors = statusList.some(s => s.status === "error");
  const allComplete = statusList.length > 0 && statusList.every(s => s.status === "success" || s.status === "error");

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Database Import</CardTitle>
              <CardDescription>
                Import your backup data to restore departments, customers, sales, and more
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Import */}
          {!file && !backupData && !importing && statusList.length === 0 && (
            <div className="space-y-4">
              <Button
                onClick={loadDefaultBackup}
                size="lg"
                className="w-full"
                variant="default"
              >
                <Database className="h-5 w-5 mr-2" />
                Load System Backup
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={importing || !!backupData}
                className="hidden"
                id="backup-file"
              />
              <label htmlFor="backup-file">
                <Button
                  variant="outline"
                  disabled={importing || !!backupData}
                  asChild
                >
                  <span className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Select Custom File
                  </span>
                </Button>
              </label>
              {file && (
                <span className="text-sm text-muted-foreground">
                  {file.name}
                </span>
              )}
            </div>

            {(file || backupData) && !importing && statusList.length === 0 && (
              <Button
                onClick={importData}
                size="lg"
                className="w-full"
              >
                <Database className="h-5 w-5 mr-2" />
                Start Import
              </Button>
            )}
          </div>

          {/* Warning */}
          {file && !importing && statusList.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> This will upsert (insert or update) data into your database. 
                Existing records with the same IDs will be updated. Make sure you have a backup of your current data.
              </AlertDescription>
            </Alert>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Import Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Status List */}
          {statusList.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Import Status</h3>
              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {statusList.map((item) => (
                  <div
                    key={item.table}
                    className="p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {item.status === "success" && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {item.status === "error" && (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      {item.status === "importing" && (
                        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                      {item.status === "pending" && (
                        <div className="h-5 w-5 border-2 border-muted rounded-full" />
                      )}
                      <div>
                        <p className="font-medium">{item.table}</p>
                        {item.error && (
                          <p className="text-xs text-destructive">{item.error}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.count} records
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {allComplete && (
            <div className="space-y-4">
              <Alert variant={hasErrors ? "destructive" : "default"}>
                <AlertDescription>
                  {hasErrors
                    ? "Import completed with some errors. Please check the status above."
                    : "All data imported successfully!"}
                </AlertDescription>
              </Alert>
              
              {!hasErrors && (
                <>
                  <Alert>
                    <AlertDescription className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p>
                          <strong>Important:</strong> User authentication accounts cannot be automatically imported. 
                        </p>
                        <Button
                          onClick={() => window.location.href = '/user-accounts-guide'}
                          variant="outline"
                          size="sm"
                        >
                          View User Accounts Guide
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <Alert className="bg-blue-50 border-blue-200">
                    <Database className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <AlertDescription className="flex items-start gap-3">
                      <div className="space-y-2">
                        <p className="font-medium text-blue-900">
                          Want Full Control? Migrate to Your Own Server
                        </p>
                        <p className="text-sm text-blue-800">
                          Follow our comprehensive step-by-step guide to migrate this entire application 
                          to your own Amazon server and PostgreSQL database. Complete with security setup, 
                          SSL configuration, and automated backups.
                        </p>
                        <Button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = '/SELF_HOSTING_MIGRATION_GUIDE.md';
                            link.download = 'SELF_HOSTING_MIGRATION_GUIDE.md';
                            link.click();
                          }}
                          variant="outline"
                          size="sm"
                          className="border-blue-300 text-blue-700 hover:bg-blue-100"
                        >
                          Download Migration Guide
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}