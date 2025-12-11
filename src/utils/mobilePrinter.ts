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

// Generate receipt as image using html2canvas
export const generateReceiptImage = async (data: ReceiptData): Promise<Blob | null> => {
  try {
    const html2canvas = (await import('html2canvas')).default;
    
    // Create a container for the receipt
    const container = document.createElement('div');
    container.innerHTML = generateImageOptimizedReceiptHTML(data);
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '320px';
    document.body.appendChild(container);
    
    // Wait for fonts and images to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher quality
      logging: false,
      useCORS: true,
      width: 320,
    });
    
    document.body.removeChild(container);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png', 0.95);
    });
  } catch (error) {
    console.error('Error generating receipt image:', error);
    return null;
  }
};

// Optimized HTML for image generation (cleaner, faster rendering)
const generateImageOptimizedReceiptHTML = (data: ReceiptData): string => {
  const discount = data.subtotal - data.total + (data.tax || 0);
  
  return `
    <div style="font-family: 'Courier New', monospace; font-size: 12px; padding: 15px; background: white; width: 290px;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px;">
        <div style="font-weight: bold; font-size: 14px;">${data.businessInfo.name}</div>
        <div style="font-size: 11px;">${data.businessInfo.address}</div>
        <div style="font-size: 11px;">Tel: ${data.businessInfo.phone}</div>
      </div>
      
      <div style="margin-bottom: 10px; font-size: 11px;">
        <div><strong>Receipt:</strong> ${data.receiptNumber}</div>
        <div><strong>Date:</strong> ${data.date}</div>
        ${data.cashierName ? `<div><strong>Cashier:</strong> ${data.cashierName}</div>` : ''}
      </div>
      
      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px 0; margin: 8px 0;">
        ${data.items.map(item => `
          <div style="margin-bottom: 6px;">
            <div style="font-weight: bold;">${item.name}</div>
            <div style="display: flex; justify-content: space-between;">
              <span>x${item.quantity} @ ${item.price.toLocaleString()}</span>
              <span>${item.subtotal.toLocaleString()}</span>
            </div>
            ${item.scentMixture ? `<div style="font-size: 10px; color: #666; padding-left: 8px;">Scents: ${item.scentMixture}</div>` : ''}
          </div>
        `).join('')}
      </div>
      
      <div style="margin: 10px 0;">
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span>
          <span>${data.subtotal.toLocaleString()} UGX</span>
        </div>
        ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Discount:</span>
            <span>-${discount.toLocaleString()} UGX</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 2px solid #000; padding-top: 5px; margin-top: 5px;">
          <span>TOTAL:</span>
          <span>${data.total.toLocaleString()} UGX</span>
        </div>
      </div>
      
      <div style="text-align: center; margin: 10px 0; font-size: 11px;">
        Paid by: <strong>${(data.paymentMethod || 'N/A').toUpperCase()}</strong>
      </div>
      
      ${data.customerName ? `
        <div style="border-top: 1px dashed #000; padding-top: 8px; font-size: 11px;">
          Customer: ${data.customerName}
          ${data.customerPhone ? `<br>Phone: ${data.customerPhone}` : ''}
        </div>
      ` : ''}
      
      <div style="text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px;">
        <div style="font-weight: bold;">THANK YOU!</div>
        <div style="font-size: 10px;">Visit again</div>
        ${data.seasonalRemark ? `<div style="font-size: 10px; margin-top: 5px;">${data.seasonalRemark}</div>` : ''}
        ${data.businessInfo.whatsapp ? `<div style="font-size: 10px; margin-top: 5px;">WhatsApp: ${data.businessInfo.whatsapp}</div>` : ''}
      </div>
    </div>
  `;
};

// Share receipt as image via WhatsApp
export const shareReceiptAsImage = async (data: ReceiptData, phoneNumber?: string): Promise<boolean> => {
  try {
    const imageBlob = await generateReceiptImage(data);
    
    if (!imageBlob) {
      throw new Error('Failed to generate image');
    }
    
    const file = new File([imageBlob], `Receipt_${data.receiptNumber}.png`, { type: 'image/png' });
    
    // Check if Web Share API supports files
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      const shareData: ShareData = {
        title: `Receipt ${data.receiptNumber}`,
        text: `Receipt from ${data.businessInfo.name}\nTotal: ${data.total.toLocaleString()} UGX`,
        files: [file],
      };
      
      await navigator.share(shareData);
      return true;
    }
    
    // Fallback: Download and open WhatsApp
    const url = URL.createObjectURL(imageBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_${data.receiptNumber}.png`;
    link.click();
    URL.revokeObjectURL(url);
    
    // Open WhatsApp with message
    const message = `Receipt ${data.receiptNumber} from ${data.businessInfo.name}. Total: ${data.total.toLocaleString()} UGX. Please find the receipt image attached.`;
    const whatsappUrl = phoneNumber 
      ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    return true;
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Share image failed:', error);
    }
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
