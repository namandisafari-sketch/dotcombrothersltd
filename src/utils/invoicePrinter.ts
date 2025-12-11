interface InvoiceData {
  invoiceNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    packingCost?: number;
    customerType?: string;
    scentMixture?: string;
    isPerfumeRefill?: boolean;
    scentBreakdown?: Array<{ scent: string; ml: number }>;
    totalMl?: number;
    pricePerMl?: number;
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
    website?: string;
    whatsapp?: string;
  };
  paymentTerms?: string;
  qrCodeUrl?: string;
}

export const generateInvoiceHTML = (data: InvoiceData): string => {
  const discount = data.subtotal - data.total + (data.tax || 0);
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Invoice - ${data.businessInfo.name}</title>
      <style>
        @page {
          size: A4;
          margin: 20mm;
        }

        body {
          font-family: "Arial", sans-serif;
          background: #fff;
          margin: 0;
          padding: 0;
        }

        .invoice-container {
          width: 210mm;
          min-height: 297mm;
          background: #fff;
          margin: auto;
          padding: 25px 35px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #333;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .logo {
          width: 100px;
          height: 100px;
          object-fit: contain;
          border: 2px solid #333;
          border-radius: 8px;
          padding: 5px;
        }

        .company-info h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          color: #333;
          font-weight: bold;
          text-transform: uppercase;
        }

        .company-info p {
          margin: 3px 0;
          color: #555;
          font-size: 13px;
        }

        .invoice-badge {
          background: #333;
          color: white;
          padding: 15px 25px;
          border-radius: 8px;
          text-align: center;
        }

        .invoice-badge h2 {
          margin: 0;
          font-size: 32px;
          font-weight: bold;
        }

        .section-title {
          font-size: 16px;
          margin-top: 30px;
          margin-bottom: 15px;
          font-weight: bold;
          color: #333;
          border-left: 5px solid #333;
          padding-left: 12px;
          text-transform: uppercase;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }

        .info-box {
          background: #f8f8f8;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #ddd;
        }

        .info-box h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #666;
          text-transform: uppercase;
          font-weight: 600;
        }

        .info-box p {
          margin: 6px 0;
          font-size: 14px;
          color: #333;
        }

        .info-box strong {
          font-weight: 600;
          color: #000;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }

        table th {
          background: #333;
          color: white;
          padding: 14px 12px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
        }

        table td {
          padding: 14px 12px;
          border-bottom: 1px solid #ddd;
          font-size: 14px;
          color: #333;
        }

        table tbody tr:hover {
          background-color: #f8f8f8;
        }

        .scent-name {
          font-weight: 600;
          color: #000;
          font-size: 15px;
        }

        .customer-type-badge {
          display: inline-block;
          background: #333;
          color: white;
          padding: 3px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          margin-left: 8px;
        }

        .totals-section {
          margin-top: 40px;
          display: flex;
          justify-content: flex-end;
        }

        .totals {
          width: 400px;
          border: 2px solid #333;
          border-radius: 8px;
          overflow: hidden;
        }

        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 20px;
          font-size: 14px;
          border-bottom: 1px solid #ddd;
        }

        .totals-row:last-child {
          border-bottom: none;
        }

        .totals-row.grand {
          background: #333;
          color: white;
          font-weight: bold;
          font-size: 18px;
          padding: 16px 20px;
        }

        .totals-row .label {
          font-weight: 600;
        }

        .qr-section {
          margin-top: 50px;
          padding: 25px;
          background: #f8f8f8;
          border-radius: 8px;
          text-align: center;
        }

        .qr-section h3 {
          margin: 0 0 10px 0;
          font-size: 18px;
          color: #333;
        }

        .qr-section img {
          width: 130px;
          height: 130px;
          margin: 15px auto;
          border: 3px solid #333;
          border-radius: 8px;
          padding: 5px;
          background: white;
        }

        .cta {
          display: inline-block;
          background: #333;
          color: white;
          padding: 10px 25px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          margin-top: 15px;
        }

        .footer {
          margin-top: 60px;
          padding-top: 25px;
          border-top: 2px solid #ddd;
          text-align: center;
        }

        .footer h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #333;
        }

        .footer p {
          margin: 5px 0;
          font-size: 13px;
          color: #666;
        }
      </style>
    </head>

    <body>
    <div class="invoice-container">

      <!-- HEADER -->
      <div class="header">
        <div class="header-left">
          ${data.businessInfo.logo ? `<img src="${data.businessInfo.logo}" alt="Logo" class="logo" />` : ''}
          <div class="company-info">
            <h1>${data.businessInfo.name}</h1>
            <p>📍 ${data.businessInfo.address}</p>
            <p>☎ ${data.businessInfo.phone}${data.businessInfo.email ? ` | ✉ ${data.businessInfo.email}` : ''}</p>
            ${data.businessInfo.website ? `<p>🌐 ${data.businessInfo.website}</p>` : ''}
          </div>
        </div>
        <div class="invoice-badge">
          <h2>INVOICE</h2>
        </div>
      </div>

      <!-- INFO GRID -->
      <div class="info-grid">
        <div class="info-box">
          <h3>Invoice Details</h3>
          <p><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
          <p><strong>Date:</strong> ${data.date}</p>
          <p><strong>Cashier:</strong> ${data.cashierName || 'Staff'}</p>
        </div>
        <div class="info-box">
          <h3>Bill To</h3>
          <p><strong>${data.customerName || 'Walk-in Customer'}</strong></p>
          ${data.customerPhone ? `<p>📞 ${data.customerPhone}</p>` : ''}
        </div>
      </div>

      <!-- ITEMS -->
      <h3 class="section-title">Items</h3>
      <table>
        <thead>
          <tr>
            <th>Product / Scent</th>
            <th style="text-align: center;">Quantity (ml)</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => {
            // If it's a perfume refill with scent breakdown, show each scent on its own row
            if (item.isPerfumeRefill && item.scentBreakdown && item.scentBreakdown.length > 0) {
              const totalMl = item.scentBreakdown.reduce((sum, s) => sum + s.ml, 0);
              const pricePerMl = item.pricePerMl || 0;
              
              return item.scentBreakdown.map((scent, idx) => `
                <tr${idx === 0 ? '' : ' style="border-top: none;"'}>
                  <td>
                    <div class="scent-name">${scent.scent}${idx === 0 && item.customerType ? ` <span class="customer-type-badge">${item.customerType}</span>` : ''}</div>
                  </td>
                  <td style="text-align: center; font-weight: 600;">${scent.ml} ml</td>
                  <td style="text-align: right;">-</td>
                  <td style="text-align: right; font-weight: 600;">-</td>
                </tr>
              `).join('') + `
                <tr style="background-color: #f8f8f8; border-top: 2px solid #333;">
                  <td style="text-align: right; font-weight: 600; padding-right: 20px;">Total</td>
                  <td style="text-align: center; font-weight: 600;">${totalMl} ml</td>
                  <td style="text-align: right; font-weight: 600;">${pricePerMl.toLocaleString()} UGX/ml</td>
                  <td style="text-align: right; font-weight: 600;">${item.subtotal.toLocaleString()} UGX</td>
                </tr>
              `;
            } else {
              // Regular item display
              return `
                <tr>
                  <td>
                    <div class="scent-name">${item.name}</div>
                    ${item.customerType ? `<span class="customer-type-badge">${item.customerType}</span>` : ''}
                    ${item.scentMixture ? `<div style="margin-top: 8px; font-size: 13px; color: #666;">Scent: ${item.scentMixture}</div>` : ''}
                  </td>
                  <td style="text-align: center; font-weight: 600;">${item.quantity} ml</td>
                  <td style="text-align: right;">${(item.isPerfumeRefill && item.packingCost ? item.packingCost : item.price).toLocaleString()} UGX</td>
                  <td style="text-align: right; font-weight: 600;">${item.subtotal.toLocaleString()} UGX</td>
                </tr>
              `;
            }
          }).join('')}
        </tbody>
      </table>

      <!-- TOTALS -->
      <div class="totals-section">
        <div class="totals">
          <div class="totals-row">
            <span class="label">Subtotal:</span>
            <span>${data.subtotal.toLocaleString()} UGX</span>
          </div>
          ${discount > 0 ? `
            <div class="totals-row">
              <span class="label">Discount:</span>
              <span>${discount.toLocaleString()} UGX</span>
            </div>
          ` : ''}
          <div class="totals-row grand">
            <span>TOTAL AMOUNT</span>
            <span>${data.total.toLocaleString()} UGX</span>
          </div>
          <div class="totals-row">
            <span class="label">Payment Method:</span>
            <span>${data.paymentMethod}</span>
          </div>
          <div class="totals-row">
            <span class="label">Served By:</span>
            <span>${data.cashierName || 'Staff'}</span>
          </div>
        </div>
      </div>

      ${data.qrCodeUrl ? `
        <!-- QR SECTION -->
        <div class="qr-section">
          <h3>Connect With Us</h3>
          <p style="font-size: 15px; color: #555;">Scan to chat on WhatsApp</p>
          <img src="${data.qrCodeUrl}" alt="WhatsApp QR Code" />
          <p style="font-weight: 600; color: #333;">WhatsApp: ${data.businessInfo.whatsapp || data.businessInfo.phone}</p>
          ${data.businessInfo.website ? `<a href="${data.businessInfo.website}" class="cta">Visit Our Website</a>` : ''}
        </div>
      ` : ''}

      <!-- FOOTER -->
      <div class="footer">
        <h3>🎉 Thank You For Your Business! 🎉</h3>
        <p>We appreciate your patronage and look forward to serving you again.</p>
        <p style="margin-top: 15px;">For inquiries: ${data.businessInfo.phone}${data.businessInfo.email ? ` | ${data.businessInfo.email}` : ''}</p>
      </div>

    </div>
    
    <!-- Back Page - System Info (prints on second page) -->
    <div style="page-break-before: always; padding: 40px; text-align: center;">
      <div style="border: 2px dashed #333; border-radius: 12px; padding: 30px; max-width: 500px; margin: 0 auto;">
        <div style="font-size: 14px; color: #666; margin-bottom: 15px;">✂️ BACK PAGE ✂️</div>
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">POWERED BY</div>
        <div style="font-weight: bold; font-size: 24px; margin-bottom: 8px; color: #000;">KABEJJA SYSTEMS</div>
        <div style="margin-bottom: 20px; font-size: 14px; color: #555;">In partnership with DOTCOM BROTHERS LTD</div>
        
        <div style="display: flex; justify-content: center; gap: 30px; margin: 25px 0;">
          <div style="text-align: center;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 8px;">Scan to Visit Website</div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://www.kabejjasystems.store" 
                 alt="Website QR" 
                 style="width: 120px; height: 120px; border: 2px solid #333; border-radius: 8px; padding: 5px; background: white;" />
            <div style="font-size: 11px; margin-top: 5px;">🌐 kabejjasystems.store</div>
          </div>
          <div style="text-align: center;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 8px;">Scan to WhatsApp</div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://wa.me/256745368426" 
                 alt="WhatsApp QR" 
                 style="width: 120px; height: 120px; border: 2px solid #333; border-radius: 8px; padding: 5px; background: white;" />
            <div style="font-size: 11px; margin-top: 5px;">📞 +256745368426</div>
          </div>
        </div>
        
        <div style="border-top: 1px dashed #333; padding-top: 15px; margin-top: 15px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">Talk to Earn for POS Systems!</div>
          <div style="font-size: 12px; color: #666;">Custom software solutions for your business</div>
        </div>
      </div>
    </div>
    </body>
    </html>
  `;
};

export const printInvoice = async (invoiceData: InvoiceData, previewOnly: boolean = false): Promise<boolean> => {
  return new Promise((resolve) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    
    if (!printWindow) {
      console.error('Could not open print window');
      resolve(false);
      return;
    }

    printWindow.document.write(generateInvoiceHTML(invoiceData));
    printWindow.document.close();

    if (previewOnly) {
      resolve(true);
      return;
    }

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          resolve(true);
        };
        // Fallback if onafterprint doesn't fire
        setTimeout(() => {
          printWindow.close();
          resolve(true);
        }, 1000);
      }, 250);
    };
  });
};

export const shareInvoiceViaWhatsApp = async (invoiceData: InvoiceData, phoneNumber?: string): Promise<void> => {
  try {
    // Dynamically import html2pdf
    const html2pdf = (await import('html2pdf.js')).default;
    
    // Generate the invoice HTML
    const html = generateInvoiceHTML(invoiceData);
    
    // Create a temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    // Generate PDF
    const filename = `Invoice_${invoiceData.invoiceNumber}.pdf`;
    
    await html2pdf()
      .from(container)
      .set({
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .save();
    
    // Cleanup
    document.body.removeChild(container);
    
    // Open WhatsApp with a message prompting to share the downloaded PDF
    const message = `Invoice #${invoiceData.invoiceNumber} from ${invoiceData.businessInfo.name}. Please find the attached PDF invoice.`;
    const encodedMessage = encodeURIComponent(message);
    const url = phoneNumber 
      ? `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;
    
    window.open(url, '_blank');
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw new Error('Failed to generate invoice PDF');
  }
};
