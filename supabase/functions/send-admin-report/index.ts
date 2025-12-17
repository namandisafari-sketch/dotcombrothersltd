import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentBreakdown {
  cash: number;
  mobile_money: number;
  card: number;
  credit: number;
}

interface DepartmentFlow {
  name: string;
  type: string;
  // Revenue & Sales
  todaySales: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueChange: number;
  // Payment breakdown
  paymentBreakdown: PaymentBreakdown;
  // Expenses
  todayExpenses: number;
  // Net cash flow
  netCashFlow: number;
  // Credits
  pendingCredits: number;
  newCreditsToday: number;
  creditsSettledToday: number;
  // Stock
  lowStockCount: number;
  lowStockItems: string[];
  // Top items
  topItems: { name: string; quantity: number; revenue: number }[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let testMode = false;
    try {
      const body = await req.json();
      testMode = body?.testMode === true;
    } catch {
      // No body or invalid JSON
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting enhanced admin report generation...", { testMode });

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .is("department_id", null)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    if (!testMode && !settings?.report_email_enabled) {
      console.log("Email reports are disabled");
      return new Response(
        JSON.stringify({ message: "Email reports are disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminEmail = settings?.admin_report_email;
    if (!adminEmail) {
      console.log("No admin report email configured");
      return new Response(
        JSON.stringify({ message: "No admin report email configured. Please set it in Settings." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: departments, error: deptError } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true);

    if (deptError) {
      console.error("Error fetching departments:", deptError);
      throw new Error("Failed to fetch departments");
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const departmentFlows: DepartmentFlow[] = [];

    for (const dept of departments || []) {
      // Determine department type
      let deptType = "Regular";
      if (dept.is_perfume_department) deptType = "Perfume";
      if (dept.is_mobile_money) deptType = "Mobile Money";

      // Get today's sales with payment method
      const { data: todaySales } = await supabase
        .from("sales")
        .select("id, total, payment_method")
        .eq("department_id", dept.id)
        .gte("created_at", `${todayStr}T00:00:00`)
        .lt("created_at", `${todayStr}T23:59:59`)
        .eq("status", "completed");

      // Get yesterday's sales for comparison
      const { data: yesterdaySales } = await supabase
        .from("sales")
        .select("total")
        .eq("department_id", dept.id)
        .gte("created_at", `${yesterdayStr}T00:00:00`)
        .lt("created_at", `${yesterdayStr}T23:59:59`)
        .eq("status", "completed");

      // Get today's sale items for top sellers
      const saleIds = todaySales?.map(s => s.id) || [];
      let topItems: { name: string; quantity: number; revenue: number }[] = [];
      
      if (saleIds.length > 0) {
        const { data: saleItems } = await supabase
          .from("sale_items")
          .select("name, quantity, total")
          .in("sale_id", saleIds);

        if (saleItems) {
          const itemMap = new Map<string, { quantity: number; revenue: number }>();
          for (const item of saleItems) {
            const existing = itemMap.get(item.name) || { quantity: 0, revenue: 0 };
            itemMap.set(item.name, {
              quantity: existing.quantity + (item.quantity || 1),
              revenue: existing.revenue + (item.total || 0)
            });
          }
          topItems = Array.from(itemMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
        }
      }

      // Calculate payment breakdown
      const paymentBreakdown: PaymentBreakdown = { cash: 0, mobile_money: 0, card: 0, credit: 0 };
      for (const sale of todaySales || []) {
        const method = sale.payment_method || 'cash';
        if (method in paymentBreakdown) {
          paymentBreakdown[method as keyof PaymentBreakdown] += sale.total || 0;
        }
      }

      // Get today's expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount")
        .eq("department_id", dept.id)
        .gte("expense_date", todayStr)
        .lte("expense_date", todayStr)
        .eq("status", "approved");

      const todayExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      // Get pending credits
      const { data: pendingCreditsData } = await supabase
        .from("credits")
        .select("amount")
        .eq("department_id", dept.id)
        .eq("status", "pending");

      // Get new credits created today
      const { data: newCredits } = await supabase
        .from("credits")
        .select("amount")
        .eq("department_id", dept.id)
        .gte("created_at", `${todayStr}T00:00:00`)
        .lt("created_at", `${todayStr}T23:59:59`);

      // Get credits settled today
      const { data: settledCredits } = await supabase
        .from("credits")
        .select("amount")
        .eq("department_id", dept.id)
        .eq("status", "settled")
        .gte("approved_at", `${todayStr}T00:00:00`)
        .lt("approved_at", `${todayStr}T23:59:59`);

      // Get low stock items
      const { data: lowStock } = await supabase
        .from("products")
        .select("name, stock, min_stock")
        .eq("department_id", dept.id)
        .eq("is_archived", false)
        .eq("is_active", true);

      const lowStockItems = (lowStock || [])
        .filter(p => (p.stock || 0) < (p.min_stock || 5))
        .map(p => `${p.name} (${p.stock || 0} left)`)
        .slice(0, 5);

      const todayRevenue = todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
      const yesterdayRevenue = yesterdaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
      const revenueChange = yesterdayRevenue > 0 
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100) 
        : (todayRevenue > 0 ? 100 : 0);

      // Net cash flow = Cash received - Expenses - Credits given
      const cashReceived = paymentBreakdown.cash + paymentBreakdown.mobile_money + paymentBreakdown.card;
      const netCashFlow = cashReceived - todayExpenses;

      departmentFlows.push({
        name: dept.name,
        type: deptType,
        todaySales: todaySales?.length || 0,
        todayRevenue,
        yesterdayRevenue,
        revenueChange,
        paymentBreakdown,
        todayExpenses,
        netCashFlow,
        pendingCredits: pendingCreditsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0,
        newCreditsToday: newCredits?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0,
        creditsSettledToday: settledCredits?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0,
        lowStockCount: lowStockItems.length,
        lowStockItems,
        topItems,
      });
    }

    // Calculate totals
    const totalRevenue = departmentFlows.reduce((sum, d) => sum + d.todayRevenue, 0);
    const totalYesterdayRevenue = departmentFlows.reduce((sum, d) => sum + d.yesterdayRevenue, 0);
    const totalSales = departmentFlows.reduce((sum, d) => sum + d.todaySales, 0);
    const totalExpenses = departmentFlows.reduce((sum, d) => sum + d.todayExpenses, 0);
    const totalPendingCredits = departmentFlows.reduce((sum, d) => sum + d.pendingCredits, 0);
    const totalNetCashFlow = departmentFlows.reduce((sum, d) => sum + d.netCashFlow, 0);
    const totalCash = departmentFlows.reduce((sum, d) => sum + d.paymentBreakdown.cash, 0);
    const totalMobileMoney = departmentFlows.reduce((sum, d) => sum + d.paymentBreakdown.mobile_money, 0);
    const totalCard = departmentFlows.reduce((sum, d) => sum + d.paymentBreakdown.card, 0);
    const totalCredit = departmentFlows.reduce((sum, d) => sum + d.paymentBreakdown.credit, 0);
    const overallChange = totalYesterdayRevenue > 0 
      ? ((totalRevenue - totalYesterdayRevenue) / totalYesterdayRevenue * 100) 
      : (totalRevenue > 0 ? 100 : 0);

    const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;
    const formatChange = (change: number) => {
      const sign = change >= 0 ? '+' : '';
      return `${sign}${change.toFixed(1)}%`;
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f0f2f5; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .header h1 { margin: 0 0 5px 0; font-size: 26px; }
          .header .subtitle { opacity: 0.9; margin: 0; }
          .header .date { opacity: 0.7; font-size: 14px; margin: 5px 0 0 0; }
          .content { background: white; padding: 25px; border-radius: 0 0 12px 12px; }
          
          .overview-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }
          .overview-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; }
          .overview-card.secondary { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
          .overview-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
          .overview-card.info { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
          .overview-card .label { font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
          .overview-card .value { font-size: 28px; font-weight: bold; margin: 5px 0; }
          .overview-card .change { font-size: 13px; opacity: 0.9; }
          .change.positive { color: #a8f0c6; }
          .change.negative { color: #ffb3b3; }
          
          .section { margin-bottom: 25px; }
          .section-title { font-size: 18px; color: #1a1a2e; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee; display: flex; align-items: center; gap: 10px; }
          
          .flow-box { background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 15px; }
          .flow-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee; }
          .flow-row:last-child { border-bottom: none; }
          .flow-label { color: #666; }
          .flow-value { font-weight: 600; }
          .flow-value.positive { color: #28a745; }
          .flow-value.negative { color: #dc3545; }
          
          .payment-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .payment-item { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
          .payment-item .icon { font-size: 20px; margin-bottom: 5px; }
          .payment-item .amount { font-weight: bold; color: #1a1a2e; }
          .payment-item .label { font-size: 11px; color: #666; text-transform: uppercase; }
          
          .department { background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 20px; margin-bottom: 15px; }
          .department-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .department-name { font-size: 16px; font-weight: 600; color: #1a1a2e; }
          .department-type { background: #e3e8ff; color: #4a5568; padding: 3px 10px; border-radius: 20px; font-size: 11px; }
          .department-type.perfume { background: #fef3cd; color: #856404; }
          .department-type.mobile { background: #d4edda; color: #155724; }
          
          .stats-row { display: flex; gap: 20px; margin-bottom: 15px; flex-wrap: wrap; }
          .stat { flex: 1; min-width: 100px; }
          .stat-value { font-size: 20px; font-weight: bold; color: #1a1a2e; }
          .stat-label { font-size: 11px; color: #666; text-transform: uppercase; }
          .stat-change { font-size: 12px; }
          .stat-change.up { color: #28a745; }
          .stat-change.down { color: #dc3545; }
          
          .mini-section { margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
          .mini-title { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
          .top-items { font-size: 13px; color: #444; }
          .top-item { display: flex; justify-content: space-between; padding: 4px 0; }
          .low-stock { color: #dc3545; font-size: 13px; }
          
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Business Flow Report</h1>
            <p class="subtitle">${settings?.business_name || "Your Business"}</p>
            <p class="date">${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          
          <div class="content">
            <!-- Overview Cards -->
            <div class="overview-grid">
              <div class="overview-card">
                <div class="label">Total Revenue</div>
                <div class="value">${formatCurrency(totalRevenue)}</div>
                <div class="change ${overallChange >= 0 ? 'positive' : 'negative'}">${formatChange(overallChange)} vs yesterday</div>
              </div>
              <div class="overview-card secondary">
                <div class="label">Net Cash Flow</div>
                <div class="value">${formatCurrency(totalNetCashFlow)}</div>
                <div class="change">Cash in minus expenses</div>
              </div>
              <div class="overview-card info">
                <div class="label">Total Transactions</div>
                <div class="value">${totalSales}</div>
                <div class="change">${departmentFlows.length} departments active</div>
              </div>
              <div class="overview-card warning">
                <div class="label">Total Expenses</div>
                <div class="value">${formatCurrency(totalExpenses)}</div>
                <div class="change">${totalPendingCredits > 0 ? `+ ${formatCurrency(totalPendingCredits)} pending credits` : 'No pending credits'}</div>
              </div>
            </div>
            
            <!-- Payment Methods Breakdown -->
            <div class="section">
              <div class="section-title">💳 Payment Methods</div>
              <div class="payment-grid">
                <div class="payment-item">
                  <div class="icon">💵</div>
                  <div class="amount">${formatCurrency(totalCash)}</div>
                  <div class="label">Cash</div>
                </div>
                <div class="payment-item">
                  <div class="icon">📱</div>
                  <div class="amount">${formatCurrency(totalMobileMoney)}</div>
                  <div class="label">Mobile Money</div>
                </div>
                <div class="payment-item">
                  <div class="icon">💳</div>
                  <div class="amount">${formatCurrency(totalCard)}</div>
                  <div class="label">Card</div>
                </div>
                <div class="payment-item">
                  <div class="icon">📋</div>
                  <div class="amount">${formatCurrency(totalCredit)}</div>
                  <div class="label">Credit</div>
                </div>
              </div>
            </div>
            
            <!-- Cash Flow Summary -->
            <div class="section">
              <div class="section-title">💰 Cash Flow Summary</div>
              <div class="flow-box">
                <div class="flow-row">
                  <span class="flow-label">Money In (Cash + Mobile + Card)</span>
                  <span class="flow-value positive">${formatCurrency(totalCash + totalMobileMoney + totalCard)}</span>
                </div>
                <div class="flow-row">
                  <span class="flow-label">Money Out (Expenses)</span>
                  <span class="flow-value negative">- ${formatCurrency(totalExpenses)}</span>
                </div>
                <div class="flow-row">
                  <span class="flow-label">Credit Sales (Money Owed)</span>
                  <span class="flow-value">${formatCurrency(totalCredit)}</span>
                </div>
                <div class="flow-row" style="font-size: 16px; padding-top: 12px; margin-top: 5px; border-top: 2px solid #ddd;">
                  <span class="flow-label"><strong>Net Cash Position</strong></span>
                  <span class="flow-value ${totalNetCashFlow >= 0 ? 'positive' : 'negative'}"><strong>${formatCurrency(totalNetCashFlow)}</strong></span>
                </div>
              </div>
            </div>
            
            <!-- Department Breakdown -->
            <div class="section">
              <div class="section-title">🏢 Department Performance</div>
              ${departmentFlows.map(dept => `
                <div class="department">
                  <div class="department-header">
                    <span class="department-name">${dept.name}</span>
                    <span class="department-type ${dept.type === 'Perfume' ? 'perfume' : dept.type === 'Mobile Money' ? 'mobile' : ''}">${dept.type}</span>
                  </div>
                  
                  <div class="stats-row">
                    <div class="stat">
                      <div class="stat-value">${formatCurrency(dept.todayRevenue)}</div>
                      <div class="stat-label">Revenue</div>
                      <div class="stat-change ${dept.revenueChange >= 0 ? 'up' : 'down'}">${formatChange(dept.revenueChange)}</div>
                    </div>
                    <div class="stat">
                      <div class="stat-value">${dept.todaySales}</div>
                      <div class="stat-label">Sales</div>
                    </div>
                    <div class="stat">
                      <div class="stat-value ${dept.netCashFlow >= 0 ? '' : 'negative'}">${formatCurrency(dept.netCashFlow)}</div>
                      <div class="stat-label">Net Cash</div>
                    </div>
                    ${dept.todayExpenses > 0 ? `
                    <div class="stat">
                      <div class="stat-value" style="color: #dc3545;">${formatCurrency(dept.todayExpenses)}</div>
                      <div class="stat-label">Expenses</div>
                    </div>
                    ` : ''}
                  </div>
                  
                  ${dept.topItems.length > 0 ? `
                  <div class="mini-section">
                    <div class="mini-title">🏆 Top Selling Items</div>
                    <div class="top-items">
                      ${dept.topItems.map((item, i) => `
                        <div class="top-item">
                          <span>${i + 1}. ${item.name} (×${item.quantity})</span>
                          <span>${formatCurrency(item.revenue)}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                  ` : ''}
                  
                  ${dept.lowStockCount > 0 ? `
                  <div class="mini-section">
                    <div class="mini-title">⚠️ Low Stock Alert</div>
                    <div class="low-stock">${dept.lowStockItems.join(', ')}</div>
                  </div>
                  ` : ''}
                  
                  ${(dept.pendingCredits > 0 || dept.newCreditsToday > 0) ? `
                  <div class="mini-section">
                    <div class="mini-title">📋 Credit Status</div>
                    <div style="font-size: 13px;">
                      ${dept.pendingCredits > 0 ? `<div>Pending: ${formatCurrency(dept.pendingCredits)}</div>` : ''}
                      ${dept.newCreditsToday > 0 ? `<div>New Today: ${formatCurrency(dept.newCreditsToday)}</div>` : ''}
                      ${dept.creditsSettledToday > 0 ? `<div style="color: #28a745;">Settled Today: ${formatCurrency(dept.creditsSettledToday)}</div>` : ''}
                    </div>
                  </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            
            <div class="footer">
              <p>This is an automated report from ${settings?.business_name || "Your Business"}.</p>
              <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`Sending enhanced report to ${adminEmail}...`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settings?.business_name || "Business"} <onboarding@resend.dev>`,
        to: [adminEmail],
        subject: `📊 Business Flow Report - ${today.toLocaleDateString()} - ${formatCurrency(totalRevenue)} (${formatChange(overallChange)})`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const responseData = await emailResponse.json();
    console.log("Email sent successfully:", responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Report sent successfully",
        emailId: responseData.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-admin-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
