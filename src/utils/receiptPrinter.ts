interface ReceiptData {
  receiptNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    variantName?: string; // Product variant name
    scentCount?: number; // Number of scents mixed (for perfumes)
    scentMixture?: string; // Actual scent mixture names
    packingCost?: number; // Packing material cost for perfumes
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
    logo?: string;
    whatsapp?: string;
    website?: string;
  };
  seasonalRemark?: string;
  qrCodeUrl?: string;
  showBackPage?: boolean;
}

export const generateReceiptHTML = (data: ReceiptData): string => {
  const discount = data.subtotal - data.total + (data.tax || 0);
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @media print {
          body { margin: 0; padding: 10px; }
          @page { margin: 0; size: auto; }
          * { page-break-inside: avoid !important; }
          .back-page { 
            page-break-before: avoid !important; 
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
        body {
          font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 11px;
          max-width: 300px;
          margin: 0 auto;
          line-height: 1.4;
          background: #ffffff;
        }
        .header { 
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding-bottom: 10px; 
          margin-bottom: 10px;
        }
        .logo {
          width: 50px;
          height: 50px;
          border-radius: 6px;
          border: 1px solid #ddd;
          object-fit: contain;
          flex-shrink: 0;
        }
        .header-info {
          flex: 1;
        }
        .business-name { 
          font-weight: bold; 
          font-size: 13px; 
          letter-spacing: 0.3px;
          margin-bottom: 3px;
          text-transform: uppercase;
          color: #000;
        }
        .info-line { 
          margin: 1px 0; 
          font-size: 9px;
          color: #333;
        }
        .receipt-info { 
          border-top: 1px solid #000;
          border-bottom: 1px solid #000; 
          padding: 6px 0; 
          margin-bottom: 8px;
          font-size: 10px;
        }
        .separator { 
          border-top: 1px dashed #000; 
          margin: 8px 0;
        }
        .double-separator {
          border-top: 2px solid #000;
          margin: 8px 0;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .items-table th {
          text-align: left;
          padding: 4px 2px;
          border-bottom: 1px solid #000;
          font-weight: bold;
        }
        .items-table th:nth-child(2),
        .items-table th:nth-child(3),
        .items-table th:nth-child(4) {
          text-align: right;
        }
        .items-table td {
          padding: 4px 2px;
          vertical-align: top;
        }
        .items-table td:nth-child(2),
        .items-table td:nth-child(3),
        .items-table td:nth-child(4) {
          text-align: right;
        }
        .scent-row {
          font-size: 9px;
          color: #555;
        }
        .scent-row td {
          padding: 2px 2px 4px 10px !important;
          border-left: 2px solid #ccc;
        }
        .scent-label {
          font-weight: bold;
          font-size: 9px;
          color: #444;
        }
        .scent-item {
          font-size: 9px;
          color: #555;
          padding-left: 5px;
        }
        .totals { 
          border-top: 1px solid #000;
          padding: 6px 0; 
          margin: 8px 0;
        }
        .total-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 3px 0;
          font-size: 11px;
        }
        .total-row.grand { 
          font-weight: bold; 
          font-size: 12px; 
          margin-top: 5px;
          padding-top: 5px;
          border-top: 1px dashed #000;
        }
        .payment-section {
          text-align: center;
          border-top: 1px dashed #000;
          padding-top: 8px;
          font-size: 11px;
        }
        .payment-line {
          margin: 4px 0;
        }
        .footer { 
          text-align: center; 
          font-size: 10px;
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px dashed #000;
        }
        .footer-thank {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .qr-section {
          margin: 12px 0;
          text-align: center;
        }
        .qr-label {
          font-weight: bold;
          font-size: 10px;
          margin-bottom: 8px;
        }
        .qr-code {
          width: 100px;
          height: 100px;
          margin: 0 auto;
          display: block;
          border: 2px solid #333;
          border-radius: 6px;
          padding: 4px;
          background: white;
        }
        .contact-info {
          font-size: 9px;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${data.businessInfo.logo ? `<img src="${data.businessInfo.logo}" alt="Logo" class="logo" />` : ''}
        <div class="header-info">
          <div class="business-name">${data.businessInfo.name}</div>
          <div class="info-line">📍 ${data.businessInfo.address}</div>
          <div class="info-line">☎ ${data.businessInfo.phone}</div>
          ${data.businessInfo.email ? `<div class="info-line">✉ ${data.businessInfo.email}</div>` : ''}
        </div>
      </div>
      
      <div class="receipt-info">
        <div>🧾 Receipt #: ${data.receiptNumber}</div>
        <div>🕓 Date: ${data.date} | Cashier: ${data.cashierName || 'Staff'}</div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 45%;">Products/Scent</th>
            <th style="width: 15%;">ml/qty</th>
            <th style="width: 18%;">Unit</th>
            <th style="width: 22%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
            <tr>
              <td>${item.name}${item.variantName ? ` (${item.variantName})` : ''}</td>
              <td>${item.quantity}</td>
              <td>${(item.price || 0).toLocaleString()}</td>
              <td>${(item.subtotal || 0).toLocaleString()}</td>
            </tr>
            ${item.scentMixture ? `
              <tr class="scent-row">
                <td colspan="4">
                  <div class="scent-label">Scents Mixed:</div>
                  ${item.scentMixture.split(' + ').map(scent => `
                    <div class="scent-item">+ ${scent.trim()}</div>
                  `).join('')}
                </td>
              </tr>
            ` : ''}
          `).join('')}
        </tbody>
      </table>

      <div class="double-separator"></div>
      
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${(data.subtotal || 0).toLocaleString()} UGX</span>
        </div>
        <div class="total-row">
          <span>Discount:</span>
          <span>${(discount || 0).toLocaleString()} UGX</span>
        </div>
        <div class="total-row grand">
          <span>TOTAL PAID:</span>
          <span>${(data.total || 0).toLocaleString()} UGX</span>
        </div>
      </div>

      <div class="payment-section">
        <div class="payment-line">Payment Mode: <strong>${(data.paymentMethod || 'N/A').toUpperCase()}</strong></div>
        ${data.cashierName ? `<div class="payment-line">Served by: <strong>${data.cashierName}</strong></div>` : ''}
        <div class="payment-line">Customer: <strong>${data.customerName || 'Walk-in'}</strong></div>
      </div>
      
      <div class="footer">
        <div class="footer-thank">THANK YOU! Visit again.</div>
        ${data.seasonalRemark ? `<div style="margin: 5px 0; font-weight: bold;">🎉 ${data.seasonalRemark} 🎉</div>` : ''}
        ${data.qrCodeUrl ? `
          <div class="qr-section">
            <div class="qr-label">Scan to connect:</div>
            <img src="${data.qrCodeUrl}" alt="QR Code" class="qr-code" />
            <div class="contact-info">
              ${data.businessInfo.whatsapp ? `<div>WhatsApp: ${data.businessInfo.whatsapp}</div>` : ''}
              ${data.businessInfo.website ? `<div>${data.businessInfo.website}</div>` : ''}
            </div>
          </div>
        ` : `
          ${data.businessInfo.whatsapp ? `<div style="margin-top: 5px;">WhatsApp: ${data.businessInfo.whatsapp}</div>` : ''}
        `}
      </div>
      
      ${data.showBackPage !== false ? `
      <!-- Back Page - System Info (continuous, no page break) -->
      <div class="back-page" style="min-height: 150px; padding: 15px 0; margin-top: 15px; border-top: 2px dashed #000;">
        <div style="text-align: center; font-size: 10px;">
          <div style="font-weight: bold; font-size: 11px; margin-bottom: 8px; color: #333;">✓ BACK PAGE ✓</div>
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 3px; color: #000;">POWERED BY</div>
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 3px; color: #000;">KABEJJA SYSTEMS</div>
          <div style="margin-bottom: 12px; font-size: 10px;">In partnership with DOTCOM BROTHERS LTD</div>
          
          <div style="display: flex; justify-content: center; gap: 12px; margin: 12px 0;">
            <div style="text-align: center;">
              <div style="font-weight: bold; font-size: 8px; margin-bottom: 4px;">Scan to Visit Website</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=https://www.kabejjasystems.store" 
                   alt="Website QR" 
                   style="width: 70px; height: 70px; border: 1px solid #333; border-radius: 4px; padding: 2px; background: white;" />
              <div style="font-size: 7px; margin-top: 2px;">🌐 kabejjasystems.store</div>
            </div>
            <div style="text-align: center;">
              <div style="font-weight: bold; font-size: 8px; margin-bottom: 4px;">Scan to WhatsApp</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=https://wa.me/256745368426" 
                   alt="WhatsApp QR" 
                   style="width: 70px; height: 70px; border: 1px solid #333; border-radius: 4px; padding: 2px; background: white;" />
              <div style="font-size: 7px; margin-top: 2px;">📱 +256745368426</div>
            </div>
          </div>
          
          <div style="border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px;">
            <div style="font-weight: bold; margin-bottom: 2px; font-size: 9px;">Talk to Earn for POS Systems!</div>
            <div style="font-size: 8px; color: #555;">Custom software solutions for your business</div>
          </div>
        </div>
      </div>
      ` : ''}
    </body>
    </html>
  `;
};

export const printReceipt = async (receiptData: ReceiptData, previewOnly: boolean = false): Promise<boolean> => {
  return new Promise((resolve) => {
    const printWindow = window.open('', '_blank', 'width=350,height=700');

    if (!printWindow) {
      console.error('Could not open print window');
      resolve(false);
      return;
    }

    const htmlContent = generateReceiptHTML(receiptData);
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    if (previewOnly) {
      resolve(true);
      return;
    }

    // Wait for all images to load before printing
    const waitForImages = async () => {
      const images = printWindow.document.querySelectorAll('img');
      const imagePromises = Array.from(images).map(img => {
        return new Promise<void>((resolveImg) => {
          if (img.complete && img.naturalHeight !== 0) {
            resolveImg();
            return;
          }
          img.onload = () => resolveImg();
          img.onerror = () => resolveImg(); // Continue even if image fails
        });
      });
      await Promise.all(imagePromises);
    };

    // Use requestAnimationFrame + setTimeout instead of onload for dynamically written content
    const initPrint = async () => {
      try {
        // Wait for images with timeout
        await Promise.race([
          waitForImages(),
          new Promise(r => setTimeout(r, 3000)) // 3 second timeout for images
        ]);

        // Additional delay for full content rendering
        await new Promise(r => setTimeout(r, 800));

        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          resolve(true);
        };
        // Fallback if onafterprint doesn't fire
        setTimeout(() => {
          printWindow.close();
          resolve(true);
        }, 3000);
      } catch (err) {
        console.error('Error waiting for images:', err);
        printWindow.print();
        setTimeout(() => {
          printWindow.close();
          resolve(true);
        }, 2000);
      }
    };

    // Wait for document to be ready using requestAnimationFrame
    if (printWindow.requestAnimationFrame) {
      printWindow.requestAnimationFrame(() => {
        printWindow.requestAnimationFrame(() => {
          initPrint();
        });
      });
    } else {
      // Fallback for browsers without requestAnimationFrame
      setTimeout(initPrint, 500);
    }
  });
};

export const shareViaWhatsApp = async (receiptData: ReceiptData, phoneNumber?: string): Promise<void> => {
  try {
    // Dynamically import html2pdf
    const html2pdf = (await import('html2pdf.js')).default;

    // Generate the receipt HTML
    const html = generateReceiptHTML(receiptData);

    // Create a temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    // Generate PDF
    const filename = `Receipt_${receiptData.receiptNumber}.pdf`;

    await html2pdf()
      .from(container)
      .set({
        margin: 5,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: false },
        jsPDF: { unit: 'mm', format: [80, 200], orientation: 'portrait' }
      })
      .save();

    // Cleanup
    document.body.removeChild(container);

    // Open WhatsApp with a message prompting to share the downloaded PDF
    const message = `Receipt #${receiptData.receiptNumber} from ${receiptData.businessInfo.name}. Please find the attached PDF receipt.`;
    const encodedMessage = encodeURIComponent(message);
    const url = phoneNumber
      ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    window.open(url, '_blank');
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    throw new Error('Failed to generate receipt PDF');
  }
};

export const autoPrintReceipt = async (saleId: string, supabase: any): Promise<void> => {
  try {
    // Fetch sale details
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      throw new Error('Could not fetch sale details');
    }

    // Fetch department-specific settings from settings table (not department_settings)
    let settings = null;
    if (sale.department_id) {
      const { data: deptSettings } = await supabase
        .from('settings')
        .select('*')
        .eq('department_id', sale.department_id)
        .maybeSingle();
      settings = deptSettings;
    }

    // Fallback to global settings if no department settings found
    if (!settings) {
      const { data: globalSettings } = await supabase
        .from('settings')
        .select('*')
        .is('department_id', null)
        .maybeSingle();
      settings = globalSettings;
    }

    // If still no settings, try any settings record
    if (!settings) {
      const { data: anySettings } = await supabase
        .from('settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      settings = anySettings;
    }

    // Fetch customer info if available
    let customerName, customerPhone;
    if (sale.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name, phone')
        .eq('id', sale.customer_id)
        .single();

      if (customer) {
        customerName = customer.name;
        customerPhone = customer.phone;
      }
    }

    // Generate QR code if WhatsApp number is available
    let qrCodeUrl;
    if (settings?.whatsapp_number) {
      try {
        const QRCode = (await import('qrcode')).default;
        const message = "Hello! I'd like to connect.";
        const whatsappUrl = `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
        qrCodeUrl = await QRCode.toDataURL(whatsappUrl, { width: 200, margin: 1 });
      } catch (err) {
        console.error('QR code generation failed:', err);
      }
    }

    const receiptData: ReceiptData = {
      receiptNumber: sale.receipt_number,
      items: sale.sale_items.map((item: any) => ({
        name: item.item_name || item.name,
        quantity: item.quantity,
        price: item.unit_price,
        subtotal: item.total || item.subtotal,
        scentMixture: item.scent_mixture,
      })),
      subtotal: sale.subtotal,
      tax: sale.tax || 0,
      total: sale.total,
      paymentMethod: sale.payment_method,
      date: new Date(sale.created_at).toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      cashierName: sale.cashier_name,
      customerName,
      customerPhone,
      businessInfo: {
        name: settings?.business_name || 'DOTCOM BROTHERS LTD',
        address: settings?.business_address || 'Kasangati opp Kasangati Police Station',
        phone: settings?.business_phone || '+256745368426',
        email: settings?.business_email,
        logo: settings?.logo_url,
        whatsapp: settings?.whatsapp_number || '+256745368426',
        website: settings?.website,
      },
      seasonalRemark: settings?.seasonal_remark,
      qrCodeUrl,
      showBackPage: settings?.show_back_page === true,
    };

    const printed = await printReceipt(receiptData, false);

    if (printed) {
      // Update sale as printed
      await supabase
        .from('sales')
        .update({
          printed: true,
          printed_at: new Date().toISOString()
        })
        .eq('id', saleId);
    }
  } catch (error) {
    console.error('Auto-print failed:', error);
    throw error;
  }
};
