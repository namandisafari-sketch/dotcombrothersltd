import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer, Share2, Smartphone, FileText, Copy, Check, Image, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  mobilePrint,
  generatePlainTextReceipt,
  shareReceiptText,
  shareReceiptAsImage,
  isAndroid,
} from "@/utils/mobilePrinter";

interface ReceiptData {
  receiptNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    variantName?: string;
    scentMixture?: string;
    packingCost?: number;
    isPerfumeRefill?: boolean;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  date: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  departmentName?: string;
  businessInfo: {
    name: string;
    address: string;
    phone: string;
    email?: string;
    whatsapp?: string;
  };
  seasonalRemark?: string;
}

interface MobilePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: ReceiptData;
  onPrintComplete?: () => void;
}

export const MobilePrintDialog = ({
  open,
  onOpenChange,
  receiptData,
  onPrintComplete,
}: MobilePrintDialogProps) => {
  const [printMethod, setPrintMethod] = useState<"browser" | "rawbt" | "share" | "image">("image");
  const [isPrinting, setIsPrinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(receiptData.customerPhone || "");

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (printMethod === "image") {
        const success = await shareReceiptAsImage(receiptData, whatsappNumber);
        if (success) {
          toast.success("Receipt image ready for sharing");
          onPrintComplete?.();
          onOpenChange(false);
        } else {
          toast.error("Failed to create image. Try another method.");
        }
      } else {
        const success = await mobilePrint(receiptData, printMethod);
        if (success) {
          toast.success("Receipt sent to printer");
          onPrintComplete?.();
          if (printMethod !== "browser") {
            onOpenChange(false);
          }
        } else {
          toast.error("Print failed. Try another method.");
        }
      }
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Operation failed");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyText = async () => {
    const text = generatePlainTextReceipt(receiptData);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Receipt copied! Paste in RawBT or any print app");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Could not copy");
    }
  };

  const handleShare = async () => {
    setIsPrinting(true);
    try {
      const success = await shareReceiptText(receiptData);
      if (success) {
        toast.success("Receipt shared");
        onPrintComplete?.();
      }
    } catch (error) {
      toast.error("Share failed");
    } finally {
      setIsPrinting(false);
    }
  };

  const handleQuickWhatsApp = async () => {
    setIsPrinting(true);
    try {
      const success = await shareReceiptAsImage(receiptData, whatsappNumber);
      if (success) {
        toast.success("Opening WhatsApp...");
        onPrintComplete?.();
        onOpenChange(false);
      }
    } catch (error) {
      toast.error("Failed to share");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Print & Share
          </DialogTitle>
          <DialogDescription>
            Choose how to print or share your receipt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* WhatsApp Number Input */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="text-sm font-medium">
              Customer WhatsApp (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                id="whatsapp"
                placeholder="+256..."
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="default"
                size="sm"
                onClick={handleQuickWhatsApp}
                disabled={isPrinting}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>

          <RadioGroup
            value={printMethod}
            onValueChange={(value: "browser" | "rawbt" | "share" | "image") => setPrintMethod(value)}
            className="space-y-3"
          >
            {/* WhatsApp Image Share - Recommended */}
            <div className="flex items-start space-x-3 p-3 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 cursor-pointer">
              <RadioGroupItem value="image" id="image" className="mt-1" />
              <Label htmlFor="image" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
                  <Image className="h-4 w-4" />
                  WhatsApp Image
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Recommended</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Share receipt as image via WhatsApp - fastest on mobile
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="browser" id="browser" className="mt-1" />
              <Label htmlFor="browser" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <Printer className="h-4 w-4" />
                  Browser Print
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Standard print dialog - works with connected printers
                </p>
              </Label>
            </div>

            {isAndroid() && (
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="rawbt" id="rawbt" className="mt-1" />
                <Label htmlFor="rawbt" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4" />
                    RawBT Print Service
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send directly to RawBT for thermal printers
                  </p>
                </Label>
              </div>
            )}

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="share" id="share" className="mt-1" />
              <Label htmlFor="share" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <Share2 className="h-4 w-4" />
                  Share as Text
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Share plain text via any app
                </p>
              </Label>
            </div>
          </RadioGroup>

          {/* Quick Actions */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Quick actions:</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                className="flex-1 gap-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy Text"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="flex-1 gap-2"
                disabled={isPrinting}
              >
                <Share2 className="h-4 w-4" />
                Quick Share
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={isPrinting} className="flex-1 gap-2">
            {printMethod === "image" ? (
              <>
                <Image className="h-4 w-4" />
                {isPrinting ? "Creating..." : "Share Image"}
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                {isPrinting ? "Printing..." : "Print"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MobilePrintDialog;
