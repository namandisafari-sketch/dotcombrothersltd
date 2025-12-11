import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";

interface ReceiptPreviewProps {
  businessInfo: {
    name: string;
    address: string;
    phone: string;
    email?: string;
    logo?: string;
    seasonalRemark?: string;
  };
}

export const ReceiptPreview = ({ businessInfo }: ReceiptPreviewProps) => {
  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Receipt Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white text-black rounded-lg p-4 text-xs font-mono shadow-inner border max-w-[280px] mx-auto">
          {/* Header */}
          <div className="flex items-start gap-2 pb-2 border-b border-dashed border-gray-400">
            {businessInfo.logo && (
              <img 
                src={businessInfo.logo} 
                alt="Logo" 
                className="w-10 h-10 object-contain border rounded flex-shrink-0"
              />
            )}
            <div className="flex-1">
              <div className="font-bold text-[11px] uppercase tracking-wide">
                {businessInfo.name || "Business Name"}
              </div>
              <div className="text-[9px] text-gray-600">
                📍 {businessInfo.address || "Address"}
              </div>
              <div className="text-[9px] text-gray-600">
                ☎ {businessInfo.phone || "Phone"}
              </div>
              {businessInfo.email && (
                <div className="text-[9px] text-gray-600">
                  ✉ {businessInfo.email}
                </div>
              )}
            </div>
          </div>

          {/* Receipt Info */}
          <div className="py-2 border-b border-dashed border-gray-400 text-[9px]">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span>RCP-001234</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{currentDate}</span>
            </div>
            <div className="flex justify-between">
              <span>Time:</span>
              <span>{currentTime}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>Staff</span>
            </div>
          </div>

          {/* Items */}
          <div className="py-2 border-b border-dashed border-gray-400">
            <div className="flex justify-between text-[9px] font-bold mb-1">
              <span>Item</span>
              <span>Total</span>
            </div>
            <div className="space-y-1 text-[9px]">
              <div className="flex justify-between">
                <span>Sample Item x2</span>
                <span>10,000</span>
              </div>
              <div className="flex justify-between">
                <span>Another Item x1</span>
                <span>5,000</span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="py-2 border-b border-dashed border-gray-400 text-[9px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>15,000</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>TOTAL:</span>
              <span>UGX 15,000</span>
            </div>
            <div className="flex justify-between">
              <span>Paid (Cash):</span>
              <span>20,000</span>
            </div>
            <div className="flex justify-between">
              <span>Change:</span>
              <span>5,000</span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 text-center text-[8px] text-gray-600">
            {businessInfo.seasonalRemark && (
              <div className="font-semibold text-gray-800 mb-1">
                ✨ {businessInfo.seasonalRemark} ✨
              </div>
            )}
            <div>Thank you for your business!</div>
            <div className="mt-1">Powered by Dotcom Brothers</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Live preview of your receipt layout
        </p>
      </CardContent>
    </Card>
  );
};
