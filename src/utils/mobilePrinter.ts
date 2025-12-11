// Mobile-optimized printing utilities for Android with RawBT support

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

// Detect if running on Android
export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

// Detect if on mobile device
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Generate plain text receipt for RawBT thermal printers
export const generatePlainTextReceipt = (data: ReceiptData): string => {
  const width = 32; // Standard 58mm thermal printer width in characters
  const separator = '='.repeat(width);
  const dottedLine = '-'.repeat(width);
  
  const centerText = (text: string): string => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  };
  
  const formatLine = (left: string, right: string): string => {
    const space = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, space)) + right;
  };

  let receipt = '';
  
  // Header
  receipt += centerText(data.businessInfo.name) + '\n';
  receipt += centerText(data.businessInfo.address) + '\n';
  receipt += centerText(`Tel: ${data.businessInfo.phone}`) + '\n';
  receipt += separator + '\n';
  
  // Receipt info
  receipt += `Receipt: ${data.receiptNumber}\n`;
  receipt += `Date: ${data.date}\n`;
  if (data.cashierName) {
    receipt += `Cashier: ${data.cashierName}\n`;
  }
  if (data.departmentName) {
    receipt += `Dept: ${data.departmentName}\n`;
  }
  receipt += dottedLine + '\n';
  
  // Items
  data.items.forEach(item => {
    const name = item.name.substring(0, 20);
    const qty = `x${item.quantity}`;
    const total = item.subtotal.toLocaleString();
    
    receipt += `${name}\n`;
    receipt += formatLine(`  ${qty} @ ${item.price.toLocaleString()}`, total) + '\n';
    
    if (item.scentMixture) {
      const scents = item.scentMixture.split(' + ');
      scents.forEach(scent => {
        receipt += `  - ${scent.substring(0, 26)}\n`;
      });
    }
  });
  
  receipt += dottedLine + '\n';
  
  // Totals
  const discount = data.subtotal - data.total + (data.tax || 0);
  receipt += formatLine('Subtotal:', `${data.subtotal.toLocaleString()} UGX`) + '\n';
  if (discount > 0) {
    receipt += formatLine('Discount:', `-${discount.toLocaleString()} UGX`) + '\n';
  }
  receipt += separator + '\n';
  receipt += formatLine('TOTAL:', `${data.total.toLocaleString()} UGX`) + '\n';
  receipt += separator + '\n';
  
  // Payment
  receipt += centerText(`Paid by: ${(data.paymentMethod || 'N/A').toUpperCase()}`) + '\n';
  
  // Customer
  if (data.customerName) {
    receipt += dottedLine + '\n';
    receipt += `Customer: ${data.customerName}\n`;
    if (data.customerPhone) {
      receipt += `Phone: ${data.customerPhone}\n`;
    }
  }
  
  // Footer
  receipt += dottedLine + '\n';
  receipt += centerText('THANK YOU!') + '\n';
  receipt += centerText('Visit again') + '\n';
  if (data.seasonalRemark) {
    receipt += centerText(data.seasonalRemark) + '\n';
  }
  if (data.businessInfo.whatsapp) {
    receipt += centerText(`WhatsApp: ${data.businessInfo.whatsapp}`) + '\n';
  }
  receipt += '\n\n\n'; // Feed paper
  
  return receipt;
};

// Print via RawBT intent (Android)
export const printViaRawBT = (text: string): void => {
  // RawBT uses a custom URL scheme
  const encodedText = encodeURIComponent(text);
  window.location.href = `rawbt:base64,${btoa(unescape(encodeURIComponent(text)))}`;
};

// Share receipt as text (works well with RawBT and other apps)
export const shareReceiptText = async (data: ReceiptData): Promise<boolean> => {
  const text = generatePlainTextReceipt(data);
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Receipt ${data.receiptNumber}`,
        text: text,
      });
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }
  
  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Clipboard failed:', err);
    return false;
  }
};

// Generate lightweight HTML receipt (faster than full styled version)
export const generateLightweightReceiptHTML = (data: ReceiptData): string => {
  const discount = data.subtotal - data.total + (data.tax || 0);
  
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: monospace; font-size: 12px; width: 80mm; padding: 5mm; }
.center { text-align: center; }
.bold { font-weight: bold; }
.line { border-top: 1px dashed #000; margin: 3mm 0; }
.row { display: flex; justify-content: space-between; margin: 1mm 0; }
.total { font-size: 14px; font-weight: bold; }
@media print { body { width: 80mm; } @page { size: 80mm auto; margin: 0; } }
</style>
</head>
<body>
<div class="center bold">${data.businessInfo.name}</div>
<div class="center">${data.businessInfo.address}</div>
<div class="center">Tel: ${data.businessInfo.phone}</div>
<div class="line"></div>
<div>Receipt: ${data.receiptNumber}</div>
<div>Date: ${data.date}</div>
${data.cashierName ? `<div>Cashier: ${data.cashierName}</div>` : ''}
<div class="line"></div>
${data.items.map(item => `
<div>${item.name}</div>
<div class="row"><span>x${item.quantity} @ ${item.price.toLocaleString()}</span><span>${item.subtotal.toLocaleString()}</span></div>
${item.scentMixture ? `<div style="font-size:10px;color:#666;padding-left:5px;">Scents: ${item.scentMixture}</div>` : ''}
`).join('')}
<div class="line"></div>
<div class="row"><span>Subtotal:</span><span>${data.subtotal.toLocaleString()} UGX</span></div>
${discount > 0 ? `<div class="row"><span>Discount:</span><span>-${discount.toLocaleString()} UGX</span></div>` : ''}
<div class="line"></div>
<div class="row total"><span>TOTAL:</span><span>${data.total.toLocaleString()} UGX</span></div>
<div class="line"></div>
<div class="center">Paid by: ${(data.paymentMethod || 'N/A').toUpperCase()}</div>
${data.customerName ? `<div class="line"></div><div>Customer: ${data.customerName}</div>` : ''}
<div class="line"></div>
<div class="center bold">THANK YOU!</div>
${data.businessInfo.whatsapp ? `<div class="center">WhatsApp: ${data.businessInfo.whatsapp}</div>` : ''}
</body>
</html>`;
};

// Mobile-friendly print function
export const mobilePrint = async (data: ReceiptData, method: 'browser' | 'rawbt' | 'share' = 'browser'): Promise<boolean> => {
  if (method === 'rawbt') {
    const text = generatePlainTextReceipt(data);
    printViaRawBT(text);
    return true;
  }
  
  if (method === 'share') {
    return shareReceiptText(data);
  }
  
  // Browser print - use lightweight HTML
  const html = generateLightweightReceiptHTML(data);
  
  // Create a hidden iframe for printing (more reliable on mobile)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return false;
  }
  
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();
  
  return new Promise((resolve) => {
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            resolve(true);
          }, 1000);
        } catch (err) {
          console.error('Print failed:', err);
          document.body.removeChild(iframe);
          resolve(false);
        }
      }, 100);
    };
  });
};
