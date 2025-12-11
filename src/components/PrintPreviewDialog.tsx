import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Download, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentHtml: string;
  documentTitle?: string;
  documentType?: "receipt" | "invoice" | "report";
  onPrint?: () => void;
  onDownloadPdf?: () => void;
}

export const PrintPreviewDialog = ({
  open,
  onOpenChange,
  documentHtml,
  documentTitle = "Document",
  documentType = "receipt",
  onPrint,
  onDownloadPdf,
}: PrintPreviewDialogProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [copies, setCopies] = useState(1);
  const [paperSize, setPaperSize] = useState<"receipt" | "a4" | "letter">(
    documentType === "receipt" ? "receipt" : "a4"
  );
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [zoom, setZoom] = useState(100);
  const [isPrinting, setIsPrinting] = useState(false);

  // Update iframe content when documentHtml changes
  useEffect(() => {
    if (iframeRef.current && open && documentHtml) {
      const iframe = iframeRef.current;
      // Small delay to ensure iframe is mounted
      setTimeout(() => {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(documentHtml);
          doc.close();
        }
      }, 100);
    }
  }, [documentHtml, open]);

  const handlePrint = async () => {
    setIsPrinting(true);
    
    try {
      // Create a hidden print window with proper print styles
      const printWindow = window.open("", "_blank", "width=800,height=600");
      
      if (!printWindow) {
        console.error("Could not open print window. Please allow popups.");
        setIsPrinting(false);
        return;
      }

      // Add print-specific CSS based on settings
      const printStyles = `
        @page {
          size: ${paperSize === "receipt" ? "80mm 200mm" : paperSize === "a4" ? "A4" : "letter"} ${orientation};
          margin: ${paperSize === "receipt" ? "5mm" : "15mm"};
        }
        @media print {
          body { margin: 0; padding: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `;

      // Inject print styles into the document
      const htmlWithPrintStyles = documentHtml.replace(
        "</head>",
        `<style>${printStyles}</style></head>`
      );

      printWindow.document.write(htmlWithPrintStyles);
      printWindow.document.close();

      printWindow.onload = () => {
        // Print the specified number of copies
        for (let i = 0; i < copies; i++) {
          setTimeout(() => {
            printWindow.print();
          }, i * 100);
        }

        printWindow.onafterprint = () => {
          printWindow.close();
          setIsPrinting(false);
          onPrint?.();
        };

        // Fallback close after timeout
        setTimeout(() => {
          printWindow.close();
          setIsPrinting(false);
        }, 3000);
      };
    } catch (error) {
      console.error("Print error:", error);
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const container = document.createElement("div");
      container.innerHTML = documentHtml;
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      const pdfOptions = {
        margin: paperSize === "receipt" ? 5 : 10,
        filename: `${documentTitle.replace(/\s+/g, "_")}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, logging: false },
        jsPDF: {
          unit: "mm" as const,
          format: paperSize === "receipt" ? [80, 200] as [number, number] : paperSize === "a4" ? "a4" : "letter",
          orientation: orientation as "portrait" | "landscape",
        },
      };

      await html2pdf().from(container).set(pdfOptions).save();

      document.body.removeChild(container);
      onDownloadPdf?.();
    } catch (error) {
      console.error("PDF generation error:", error);
    }
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const resetZoom = () => setZoom(100);

  const getPreviewWidth = () => {
    switch (paperSize) {
      case "receipt":
        return 320;
      case "a4":
        return orientation === "portrait" ? 595 : 842;
      case "letter":
        return orientation === "portrait" ? 612 : 792;
      default:
        return 595;
    }
  };

  const getPreviewHeight = () => {
    switch (paperSize) {
      case "receipt":
        return 600;
      case "a4":
        return orientation === "portrait" ? 842 : 595;
      case "letter":
        return orientation === "portrait" ? 792 : 612;
      default:
        return 842;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 bg-background">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Print Preview - {documentTitle}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Settings Panel */}
          <div className="w-72 border-r bg-muted/20 p-4 flex flex-col gap-4 overflow-y-auto">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Print Settings
              </h3>

              <div className="space-y-2">
                <Label htmlFor="copies" className="text-sm font-medium">
                  Copies
                </Label>
                <Input
                  id="copies"
                  type="number"
                  min={1}
                  max={99}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paperSize" className="text-sm font-medium">
                  Paper Size
                </Label>
                <Select
                  value={paperSize}
                  onValueChange={(value: "receipt" | "a4" | "letter") => setPaperSize(value)}
                >
                  <SelectTrigger id="paperSize" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    <SelectItem value="receipt">Receipt (80mm)</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paperSize !== "receipt" && (
                <div className="space-y-2">
                  <Label htmlFor="orientation" className="text-sm font-medium">
                    Orientation
                  </Label>
                  <Select
                    value={orientation}
                    onValueChange={(value: "portrait" | "landscape") => setOrientation(value)}
                  >
                    <SelectTrigger id="orientation" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Preview Controls
              </h3>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={zoomOut} className="h-8 w-8">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[50px] text-center">{zoom}%</span>
                <Button variant="outline" size="icon" onClick={zoomIn} className="h-8 w-8">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={resetZoom} className="h-8 w-8">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              <Separator />

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Tip:</strong> Click "Print" to open the system print dialog where you
                  can select from available printers.
                </p>
              </div>
            </div>

            <div className="mt-auto space-y-2">
              <Button
                onClick={handlePrint}
                disabled={isPrinting}
                className="w-full gap-2"
                size="lg"
              >
                <Printer className="h-4 w-4" />
                {isPrinting ? "Printing..." : "Print"}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
                className="w-full gap-2"
                size="lg"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 bg-muted/50 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-8 flex justify-center">
                <div
                  className="bg-white shadow-xl rounded-lg overflow-hidden transition-transform"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top center",
                    width: getPreviewWidth(),
                    minHeight: getPreviewHeight(),
                  }}
                >
                  <iframe
                    ref={iframeRef}
                    title="Print Preview"
                    className="w-full border-0 bg-white"
                    style={{
                      width: getPreviewWidth(),
                      height: getPreviewHeight(),
                      minHeight: getPreviewHeight(),
                      pointerEvents: "none",
                    }}
                    srcDoc={documentHtml || "<html><body><p>No content to preview</p></body></html>"}
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPreviewDialog;
