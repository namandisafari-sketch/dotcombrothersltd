import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer, MessageCircle, Eye, FileText, Edit, Smartphone } from "lucide-react";
import { useState } from "react";
import { printReceipt, shareViaWhatsApp, generateReceiptHTML } from "@/utils/receiptPrinter";
import { printInvoice, shareInvoiceViaWhatsApp, generateInvoiceHTML } from "@/utils/invoicePrinter";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { PrintPreviewDialog } from "@/components/PrintPreviewDialog";
import { MobilePrintDialog } from "@/components/MobilePrintDialog";
import { isMobile } from "@/utils/mobilePrinter";

interface ReceiptActionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: any;
  customerPhone?: string;
  isInvoice?: boolean;
  onEdit?: () => void;
}

export const ReceiptActionsDialog = ({ 
  isOpen, 
  onClose, 
  receiptData,
  customerPhone,
  isInvoice = false,
  onEdit,
}: ReceiptActionsDialogProps) => {
  const [whatsappNumber, setWhatsappNumber] = useState(customerPhone || "");
  const { isAdmin } = useUserRole();
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewHtml, setPrintPreviewHtml] = useState("");
  const [showMobilePrint, setShowMobilePrint] = useState(false);

  const handlePrint = async () => {
    // Check if on mobile - use mobile print dialog
    if (isMobile()) {
      setShowMobilePrint(true);
      return;
    }
    
    // On desktop, show print preview with thermal printer selection
    try {
      let html: string;
      if (isInvoice) {
        html = generateInvoiceHTML(receiptData);
      } else {
        html = generateReceiptHTML(receiptData);
      }
      setPrintPreviewHtml(html);
      setShowPrintPreview(true);
    } catch (error) {
      console.error('Error generating print preview:', error);
      // Fallback to direct print
      if (isInvoice) {
        await printInvoice(receiptData, false);
      } else {
        await printReceipt(receiptData, false);
      }
    }
  };

  const handlePreview = async () => {
    // Use custom print preview dialog
    try {
      let html: string;
      if (isInvoice) {
        html = generateInvoiceHTML(receiptData);
      } else {
        html = generateReceiptHTML(receiptData);
      }
      setPrintPreviewHtml(html);
      setShowPrintPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      // Fallback to old preview
      if (isInvoice) {
        await printInvoice(receiptData, true);
      } else {
        await printReceipt(receiptData, true);
      }
    }
  };

  const handlePrintFromPreview = async () => {
    try {
      const printWindow = window.open('', '_blank', 'width=300,height=600');
      if (printWindow) {
        printWindow.document.write(printPreviewHtml);
        printWindow.document.close();
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 250);
        };
      }
      setShowPrintPreview(false);
    } catch (error) {
      console.error('Print error:', error);
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      if (isInvoice) {
        await shareInvoiceViaWhatsApp(receiptData, whatsappNumber);
      } else {
        await shareViaWhatsApp(receiptData, whatsappNumber);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{isInvoice ? 'Invoice' : 'Receipt'} Actions</DialogTitle>
              <Badge variant={isInvoice ? "default" : "secondary"}>
                {isInvoice ? 'Wholesale' : 'Retail'}
              </Badge>
            </div>
            <DialogDescription>
              {isInvoice 
                ? "Preview, print, or share this invoice via WhatsApp" 
                : "Preview, print, or share this receipt via WhatsApp"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {isAdmin && onEdit && (
              <Button
                onClick={() => {
                  onEdit();
                  onClose();
                }}
                variant="default"
                className="w-full"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Receipt
              </Button>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handlePreview}
                variant="outline"
                className="w-full"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </Button>
              
              <Button
                onClick={handlePrint}
                className="w-full"
              >
                {isMobile() ? (
                  <Smartphone className="w-4 h-4 mr-2" />
                ) : (
                  <Printer className="w-4 h-4 mr-2" />
                )}
                Print
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">Customer WhatsApp Number</Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="+256700000000"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {isInvoice 
                  ? "Download PDF invoice and share it via WhatsApp" 
                  : "Download PDF receipt and share it via WhatsApp"}
              </p>
            </div>

            <Button
              onClick={handleWhatsAppShare}
              variant="outline"
              className="w-full"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Share via WhatsApp
            </Button>

            {isInvoice && (
              <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Invoice Details</p>
                    <p className="mt-1">
                      This invoice includes itemized costs, bottle charges, and scent mixtures. 
                      Payment terms and full business details are included.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog - Desktop */}
      <PrintPreviewDialog
        open={showPrintPreview}
        onOpenChange={setShowPrintPreview}
        documentHtml={printPreviewHtml}
        documentTitle={isInvoice ? "Invoice" : "Receipt"}
        documentType={isInvoice ? "invoice" : "receipt"}
        onPrint={handlePrintFromPreview}
      />

      {/* Mobile Print Dialog */}
      {receiptData && (
        <MobilePrintDialog
          open={showMobilePrint}
          onOpenChange={setShowMobilePrint}
          receiptData={receiptData}
          onPrintComplete={() => setShowMobilePrint(false)}
        />
      )}
    </>
  );
};
