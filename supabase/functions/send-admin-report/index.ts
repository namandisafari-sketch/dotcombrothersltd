import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DepartmentFinancials {
  id: string;
  name: string;
  type: string;
  revenue: number;
  cashSales: number;
  creditSales: number;
  mobileMoneySales: number;
  cardSales: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netIncome: number;
  inventory: number;
  receivables: number;
  salesCount: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  lowStockItems: string[];
}

// Helper function to check if report should be sent based on frequency
function shouldSendScheduledReport(frequency: string, lastSentAt: string | null): { shouldSend: boolean; period: string } {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay(); // 0 = Sunday
  const currentDate = now.getUTCDate();
  
  // Only send reports between 5-7 AM UTC (adjust for your timezone)
  if (currentHour < 5 || currentHour > 7) {
    return { shouldSend: false, period: "current" };
  }
  
  // Check if already sent today
  if (lastSentAt) {
    const lastSent = new Date(lastSentAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastSentDay = new Date(lastSent.getFullYear(), lastSent.getMonth(), lastSent.getDate());
    
    if (lastSentDay >= today) {
      return { shouldSend: false, period: "current" };
    }
  }
  
  switch (frequency) {
    case "daily":
      return { shouldSend: true, period: "current" };
    case "weekly":
      // Send on Monday (day 1)
      if (currentDay === 1) {
        return { shouldSend: true, period: "current" };
      }
      return { shouldSend: false, period: "current" };
    case "monthly":
      // Send on 1st of month
      if (currentDate === 1) {
        return { shouldSend: true, period: "previous" };
      }
      return { shouldSend: false, period: "current" };
    default:
      return { shouldSend: false, period: "current" };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let testMode = false;
    let reportPeriod = "current"; // current, previous, ytd
    let scheduledMode = false; // Called by cron job
    let forceMode = false; // Force send regardless of schedule
    
    try {
      const body = await req.json();
      testMode = body?.testMode === true;
      reportPeriod = body?.period || "current";
      scheduledMode = body?.scheduled === true;
      forceMode = body?.force === true;
    } catch {
      // No body or invalid JSON
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting comprehensive admin financial report generation...", { testMode, reportPeriod, scheduledMode, forceMode });

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .is("department_id", null)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    // Check if reports are enabled
    if (!testMode && !forceMode && !settings?.report_email_enabled) {
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

    // If this is a scheduled call, check if we should actually send based on frequency
    if (scheduledMode && !forceMode && !testMode) {
      const frequency = settings?.report_email_frequency || "daily";
      const lastSentAt = settings?.settings_json?.last_report_sent_at || null;
      
      const { shouldSend, period } = shouldSendScheduledReport(frequency, lastSentAt);
      
      if (!shouldSend) {
        console.log(`Scheduled report check: Not time to send yet. Frequency: ${frequency}`);
        return new Response(
          JSON.stringify({ 
            message: `Not scheduled to send. Frequency: ${frequency}`,
            nextCheck: "Will check again on next cron run"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Use the period determined by schedule
      reportPeriod = period;
      console.log(`Scheduled report: Sending ${frequency} report for period: ${reportPeriod}`);
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (reportPeriod === "previous") {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
      endDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59);
      periodLabel = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (reportPeriod === "ytd") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = now;
      periodLabel = `Year to Date (${now.getFullYear()})`;
    } else if (reportPeriod === "daily") {
      // Yesterday's report for daily
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
      periodLabel = yesterday.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } else if (reportPeriod === "weekly") {
      // Last 7 days
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      periodLabel = `Week of ${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    } else {
      // Default: current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      periodLabel = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    console.log(`Report period: ${periodLabel} (${startStr} to ${endStr})`);

    // Fetch all required data
    const [
      { data: departments },
      { data: sales },
      { data: saleItems },
      { data: expenses },
      { data: products },
      { data: customers },
      { data: credits },
      { data: reconciliations }
    ] = await Promise.all([
      supabase.from("departments").select("*").eq("is_active", true),
      supabase.from("sales").select("*").gte("created_at", startStr).lte("created_at", endStr),
      supabase.from("sale_items").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("products").select("*").eq("is_archived", false),
      supabase.from("customers").select("*"),
      supabase.from("credits").select("*"),
      supabase.from("reconciliations").select("*").order("date", { ascending: false }).limit(10)
    ]);

    // Filter sales by status
    const validSales = (sales || []).filter((s: any) => s.status !== 'voided');
    
    // Filter expenses by date range
    const filteredExpenses = (expenses || []).filter((e: any) => {
      const expenseDate = new Date(e.expense_date || e.created_at);
      return expenseDate >= startDate && expenseDate <= endDate;
    });

    // Build department financial data
    const departmentData: DepartmentFinancials[] = [];

    for (const dept of departments || []) {
      const deptSales = validSales.filter((s: any) => s.department_id === dept.id);
      const deptExpenses = filteredExpenses.filter((e: any) => e.department_id === dept.id);
      const deptProducts = (products || []).filter((p: any) => p.department_id === dept.id);
      const deptCustomers = (customers || []).filter((c: any) => c.department_id === dept.id);

      // Revenue calculations
      const revenue = deptSales.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const cashSales = deptSales.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const creditSales = deptSales.filter((s: any) => s.payment_method === 'credit').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const mobileMoneySales = deptSales.filter((s: any) => s.payment_method === 'mobile_money').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const cardSales = deptSales.filter((s: any) => s.payment_method === 'card').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const expenseTotal = deptExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      
      // COGS estimation (60% of revenue or based on cost prices if available)
      const cogs = revenue * 0.6;
      
      // Inventory value
      const inventory = deptProducts.reduce((sum: number, p: any) => {
        const stock = Number(p.stock || 0);
        const costPrice = Number(p.cost_price || p.price * 0.6 || 0);
        return sum + (stock * costPrice);
      }, 0);
      
      // Customer receivables
      const receivables = deptCustomers.reduce((sum: number, c: any) => sum + Number(c.outstanding_balance || 0), 0);

      // Top selling items
      const saleIds = deptSales.map((s: any) => s.id);
      const deptSaleItems = (saleItems || []).filter((si: any) => saleIds.includes(si.sale_id));
      const itemMap = new Map<string, { quantity: number; revenue: number }>();
      
      for (const item of deptSaleItems) {
        const existing = itemMap.get(item.name) || { quantity: 0, revenue: 0 };
        itemMap.set(item.name, {
          quantity: existing.quantity + (item.quantity || 1),
          revenue: existing.revenue + (item.total || 0)
        });
      }
      
      const topItems = Array.from(itemMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Low stock items
      const lowStockItems = deptProducts
        .filter((p: any) => (p.stock || 0) < (p.min_stock || 5) && p.is_active)
        .map((p: any) => `${p.name} (${p.stock || 0})`)
        .slice(0, 5);

      // Department type
      let deptType = "Regular";
      if (dept.is_perfume_department) deptType = "Perfume";
      if (dept.is_mobile_money) deptType = "Mobile Money";

      departmentData.push({
        id: dept.id,
        name: dept.name,
        type: deptType,
        revenue,
        cashSales,
        creditSales,
        mobileMoneySales,
        cardSales,
        cogs,
        grossProfit: revenue - cogs,
        expenses: expenseTotal,
        netIncome: revenue - cogs - expenseTotal,
        inventory,
        receivables,
        salesCount: deptSales.length,
        topItems,
        lowStockItems
      });
    }

    // Filter departments with activity
    const activeDepartments = departmentData.filter(d => d.revenue > 0 || d.expenses > 0 || d.inventory > 0);

    // Calculate totals for Income Statement
    const totalRevenue = validSales.reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const totalCashSales = validSales.filter((s: any) => s.payment_method === 'cash').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const totalCreditSales = validSales.filter((s: any) => s.payment_method === 'credit').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const totalMobileMoneySales = validSales.filter((s: any) => s.payment_method === 'mobile_money').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const totalCardSales = validSales.filter((s: any) => s.payment_method === 'card').reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
    const totalCogs = totalRevenue * 0.6;
    const grossProfit = totalRevenue - totalCogs;
    const totalExpenses = filteredExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
    const netIncome = grossProfit - totalExpenses;

    // Group expenses by category
    const expensesByCategory: Record<string, number> = {};
    for (const expense of filteredExpenses) {
      const category = expense.category || 'Other';
      expensesByCategory[category] = (expensesByCategory[category] || 0) + Number(expense.amount || 0);
    }

    // Balance Sheet calculations
    const latestReconciliation = reconciliations?.[0];
    const cashOnHand = latestReconciliation ? Number(latestReconciliation.reported_cash || 0) : 0;
    
    const inventoryValue = (products || []).reduce((sum: number, p: any) => {
      const stock = Number(p.stock || 0);
      const costPrice = Number(p.cost_price || p.price * 0.6 || 0);
      return sum + (stock * costPrice);
    }, 0);
    
    const accountsReceivable = (customers || []).reduce((sum: number, c: any) => sum + Number(c.outstanding_balance || 0), 0);
    
    const totalCreditsReceivable = (credits || [])
      .filter((c: any) => c.status !== 'settled' && c.transaction_type === 'interdepartmental')
      .reduce((sum: number, c: any) => sum + Number(c.amount || 0) - Number(c.paid_amount || 0), 0);
    
    const totalCreditsPayable = (credits || [])
      .filter((c: any) => c.status !== 'settled' && c.transaction_type === 'customer_credit')
      .reduce((sum: number, c: any) => sum + Number(c.amount || 0) - Number(c.paid_amount || 0), 0);
    
    const totalCurrentAssets = cashOnHand + (totalMobileMoneySales + totalCardSales) + accountsReceivable + inventoryValue + totalCreditsReceivable;
    const retainedEarnings = totalCurrentAssets - totalCreditsPayable;

    // Cash Flow calculations
    const operatingCashFlow = totalCashSales - totalExpenses;
    const financingCashFlow = totalCreditsReceivable - totalCreditsPayable;
    const netCashChange = operatingCashFlow + financingCashFlow;

    const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;
    const endDateFormatted = endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    // Build comprehensive email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
          .header h1 { margin: 0 0 5px 0; font-size: 26px; }
          .header .subtitle { opacity: 0.9; margin: 0; }
          .header .date { opacity: 0.7; font-size: 14px; margin: 5px 0 0 0; }
          .content { background: white; padding: 25px; border-radius: 0 0 12px 12px; }
          
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px; }
          .summary-card { padding: 15px; border-radius: 8px; text-align: center; }
          .summary-card.revenue { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; }
          .summary-card.expenses { background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); color: white; }
          .summary-card.profit { background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; }
          .summary-card.net { background: linear-gradient(135deg, #007bff 0%, #17a2b8 100%); color: white; }
          .summary-card .label { font-size: 11px; text-transform: uppercase; opacity: 0.9; }
          .summary-card .value { font-size: 22px; font-weight: bold; margin: 5px 0; }
          .summary-card .sub { font-size: 11px; opacity: 0.8; }
          
          .report-section { margin-bottom: 35px; page-break-inside: avoid; }
          .section-header { font-size: 18px; font-weight: 600; color: #1a1a2e; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 3px solid #007bff; display: flex; align-items: center; gap: 10px; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th { background: #f8f9fa; padding: 12px 10px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #495057; border-bottom: 2px solid #dee2e6; }
          th.right { text-align: right; }
          td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
          td.right { text-align: right; }
          td.indent { padding-left: 30px; }
          td.bold { font-weight: 600; }
          tr.section-row { background: #f8f9fa; }
          tr.section-row td { font-weight: 600; color: #1a1a2e; }
          tr.total-row { border-top: 2px solid #333; background: #e9ecef; }
          tr.total-row td { font-weight: 700; }
          tr.subtotal-row { border-top: 1px solid #333; }
          tr.subtotal-row td { font-weight: 600; }
          .positive { color: #28a745; }
          .negative { color: #dc3545; }
          
          .dept-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
          .dept-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
          .dept-name { font-weight: 600; font-size: 15px; color: #1a1a2e; }
          .dept-badge { background: #e3e8ff; color: #4a5568; padding: 3px 10px; border-radius: 20px; font-size: 11px; }
          .dept-badge.perfume { background: #fef3cd; color: #856404; }
          .dept-badge.mobile { background: #d4edda; color: #155724; }
          .dept-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
          .dept-stat { text-align: center; padding: 8px; background: #f8f9fa; border-radius: 6px; }
          .dept-stat-value { font-size: 16px; font-weight: 600; color: #1a1a2e; }
          .dept-stat-label { font-size: 10px; color: #666; text-transform: uppercase; }
          .dept-mini { margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; }
          .dept-mini-title { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 5px; font-weight: 600; }
          .dept-mini-items { font-size: 12px; color: #444; }
          .low-stock { color: #dc3545; }
          
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Financial Reports</h1>
            <p class="subtitle">${settings?.business_name || "Your Business"}</p>
            <p class="date">For the period: ${periodLabel} | Generated: ${now.toLocaleString()}</p>
          </div>
          
          <div class="content">
            <!-- Summary Cards -->
            <div class="summary-grid">
              <div class="summary-card revenue">
                <div class="label">Total Revenue</div>
                <div class="value">${formatCurrency(totalRevenue)}</div>
                <div class="sub">${validSales.length} transactions</div>
              </div>
              <div class="summary-card expenses">
                <div class="label">Total Expenses</div>
                <div class="value">${formatCurrency(totalExpenses)}</div>
                <div class="sub">${filteredExpenses.length} records</div>
              </div>
              <div class="summary-card profit">
                <div class="label">Gross Profit</div>
                <div class="value">${formatCurrency(grossProfit)}</div>
                <div class="sub">${((grossProfit / (totalRevenue || 1)) * 100).toFixed(1)}% margin</div>
              </div>
              <div class="summary-card net">
                <div class="label">Net Income</div>
                <div class="value">${formatCurrency(netIncome)}</div>
                <div class="sub">${((netIncome / (totalRevenue || 1)) * 100).toFixed(1)}% net margin</div>
              </div>
            </div>
            
            <!-- 1. Department Summary Report -->
            <div class="report-section">
              <div class="section-header">🏢 Financial Summary by Department</div>
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th class="right">Revenue</th>
                    <th class="right">COGS</th>
                    <th class="right">Gross Profit</th>
                    <th class="right">Expenses</th>
                    <th class="right">Net Income</th>
                    <th class="right">Inventory</th>
                    <th class="right">Receivables</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeDepartments.map(dept => `
                    <tr>
                      <td class="bold">${dept.name}</td>
                      <td class="right positive">${dept.revenue.toLocaleString()}</td>
                      <td class="right negative">(${dept.cogs.toLocaleString()})</td>
                      <td class="right ${dept.grossProfit >= 0 ? 'positive' : 'negative'}">${dept.grossProfit.toLocaleString()}</td>
                      <td class="right negative">(${dept.expenses.toLocaleString()})</td>
                      <td class="right bold ${dept.netIncome >= 0 ? 'positive' : 'negative'}">${dept.netIncome.toLocaleString()}</td>
                      <td class="right">${dept.inventory.toLocaleString()}</td>
                      <td class="right">${dept.receivables.toLocaleString()}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td class="bold">TOTAL</td>
                    <td class="right positive">${activeDepartments.reduce((s, d) => s + d.revenue, 0).toLocaleString()}</td>
                    <td class="right negative">(${activeDepartments.reduce((s, d) => s + d.cogs, 0).toLocaleString()})</td>
                    <td class="right ${grossProfit >= 0 ? 'positive' : 'negative'}">${activeDepartments.reduce((s, d) => s + d.grossProfit, 0).toLocaleString()}</td>
                    <td class="right negative">(${activeDepartments.reduce((s, d) => s + d.expenses, 0).toLocaleString()})</td>
                    <td class="right bold ${netIncome >= 0 ? 'positive' : 'negative'}">${activeDepartments.reduce((s, d) => s + d.netIncome, 0).toLocaleString()}</td>
                    <td class="right">${activeDepartments.reduce((s, d) => s + d.inventory, 0).toLocaleString()}</td>
                    <td class="right">${activeDepartments.reduce((s, d) => s + d.receivables, 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
              
              <!-- Revenue by Payment Method -->
              <h4 style="margin-top: 25px; margin-bottom: 15px; color: #1a1a2e;">Revenue by Payment Method</h4>
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th class="right">Cash</th>
                    <th class="right">Credit</th>
                    <th class="right">Mobile Money</th>
                    <th class="right">Card</th>
                    <th class="right">Total</th>
                    <th class="right">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeDepartments.map(dept => `
                    <tr>
                      <td class="bold">${dept.name}</td>
                      <td class="right">${dept.cashSales.toLocaleString()}</td>
                      <td class="right">${dept.creditSales.toLocaleString()}</td>
                      <td class="right">${dept.mobileMoneySales.toLocaleString()}</td>
                      <td class="right">${dept.cardSales.toLocaleString()}</td>
                      <td class="right bold">${dept.revenue.toLocaleString()}</td>
                      <td class="right">${dept.salesCount}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td class="bold">TOTAL</td>
                    <td class="right">${activeDepartments.reduce((s, d) => s + d.cashSales, 0).toLocaleString()}</td>
                    <td class="right">${activeDepartments.reduce((s, d) => s + d.creditSales, 0).toLocaleString()}</td>
                    <td class="right">${activeDepartments.reduce((s, d) => s + d.mobileMoneySales, 0).toLocaleString()}</td>
                    <td class="right">${activeDepartments.reduce((s, d) => s + d.cardSales, 0).toLocaleString()}</td>
                    <td class="right bold">${activeDepartments.reduce((s, d) => s + d.revenue, 0).toLocaleString()}</td>
                    <td class="right">${activeDepartments.reduce((s, d) => s + d.salesCount, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- 2. Income Statement -->
            <div class="report-section">
              <div class="section-header">📈 Income Statement</div>
              <p style="color: #666; font-size: 13px; margin-bottom: 15px;">For the period ending ${endDateFormatted}</p>
              <table>
                <thead>
                  <tr>
                    <th style="width: 60%;">Description</th>
                    <th class="right">Amount (UGX)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="section-row">
                    <td>REVENUE</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td class="indent">Cash Sales</td>
                    <td class="right">${totalCashSales.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td class="indent">Credit Sales</td>
                    <td class="right">${totalCreditSales.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td class="indent">Mobile Money Sales</td>
                    <td class="right">${totalMobileMoneySales.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td class="indent">Card Sales</td>
                    <td class="right">${totalCardSales.toLocaleString()}</td>
                  </tr>
                  <tr class="subtotal-row">
                    <td class="bold">Total Revenue</td>
                    <td class="right bold positive">${totalRevenue.toLocaleString()}</td>
                  </tr>
                  
                  <tr class="section-row">
                    <td>COST OF GOODS SOLD</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td class="indent">Cost of Goods Sold (Est.)</td>
                    <td class="right negative">(${totalCogs.toLocaleString()})</td>
                  </tr>
                  <tr class="subtotal-row">
                    <td class="bold">Gross Profit</td>
                    <td class="right bold ${grossProfit >= 0 ? 'positive' : 'negative'}">${grossProfit.toLocaleString()}</td>
                  </tr>
                  
                  <tr class="section-row">
                    <td>OPERATING EXPENSES</td>
                    <td></td>
                  </tr>
                  ${Object.entries(expensesByCategory).map(([category, amount]) => `
                    <tr>
                      <td class="indent">${category}</td>
                      <td class="right negative">(${(amount as number).toLocaleString()})</td>
                    </tr>
                  `).join('')}
                  <tr class="subtotal-row">
                    <td class="indent bold">Total Operating Expenses</td>
                    <td class="right bold negative">(${totalExpenses.toLocaleString()})</td>
                  </tr>
                  
                  <tr class="total-row">
                    <td class="bold" style="font-size: 15px;">NET INCOME</td>
                    <td class="right bold ${netIncome >= 0 ? 'positive' : 'negative'}" style="font-size: 15px;">${netIncome.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- 3. Balance Sheet -->
            <div class="report-section">
              <div class="section-header">📋 Balance Sheet</div>
              <p style="color: #666; font-size: 13px; margin-bottom: 15px;">As of ${endDateFormatted}</p>
              <div class="two-col">
                <!-- Assets -->
                <div>
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 60%;">ASSETS</th>
                        <th class="right">Amount (UGX)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="section-row">
                        <td>Current Assets</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td class="indent">Cash on Hand</td>
                        <td class="right">${cashOnHand.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td class="indent">Mobile Money/Bank</td>
                        <td class="right">${(totalMobileMoneySales + totalCardSales).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td class="indent">Accounts Receivable</td>
                        <td class="right">${accountsReceivable.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td class="indent">Inventory</td>
                        <td class="right">${inventoryValue.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td class="indent">Interdepartmental Receivables</td>
                        <td class="right">${totalCreditsReceivable.toLocaleString()}</td>
                      </tr>
                      <tr class="total-row">
                        <td class="bold">Total Current Assets</td>
                        <td class="right bold positive">${totalCurrentAssets.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <!-- Liabilities & Equity -->
                <div>
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 60%;">LIABILITIES & EQUITY</th>
                        <th class="right">Amount (UGX)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="section-row">
                        <td>Current Liabilities</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td class="indent">Accounts Payable</td>
                        <td class="right">${totalCreditsPayable.toLocaleString()}</td>
                      </tr>
                      <tr class="subtotal-row">
                        <td class="bold">Total Liabilities</td>
                        <td class="right bold negative">${totalCreditsPayable.toLocaleString()}</td>
                      </tr>
                      
                      <tr class="section-row">
                        <td>Equity</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td class="indent">Retained Earnings</td>
                        <td class="right">${retainedEarnings.toLocaleString()}</td>
                      </tr>
                      <tr class="total-row">
                        <td class="bold">Total Liabilities & Equity</td>
                        <td class="right bold">${totalCurrentAssets.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <!-- 4. Cash Flow Statement -->
            <div class="report-section">
              <div class="section-header">💰 Cash Flow Statement</div>
              <p style="color: #666; font-size: 13px; margin-bottom: 15px;">For the period ending ${endDateFormatted}</p>
              <table>
                <thead>
                  <tr>
                    <th style="width: 60%;">Description</th>
                    <th class="right">Amount (UGX)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="section-row">
                    <td>CASH FLOWS FROM OPERATING ACTIVITIES</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td class="indent">↑ Cash received from customers</td>
                    <td class="right positive">${totalCashSales.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td class="indent">↓ Cash paid for operating expenses</td>
                    <td class="right negative">(${totalExpenses.toLocaleString()})</td>
                  </tr>
                  <tr class="subtotal-row">
                    <td class="indent bold">Net Cash from Operating Activities</td>
                    <td class="right bold ${operatingCashFlow >= 0 ? 'positive' : 'negative'}">${operatingCashFlow.toLocaleString()}</td>
                  </tr>
                  
                  <tr class="section-row">
                    <td>CASH FLOWS FROM FINANCING ACTIVITIES</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td class="indent">↑ Interdepartmental loans received</td>
                    <td class="right positive">${totalCreditsReceivable.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td class="indent">↓ Interdepartmental loans paid</td>
                    <td class="right negative">(${totalCreditsPayable.toLocaleString()})</td>
                  </tr>
                  <tr class="subtotal-row">
                    <td class="indent bold">Net Cash from Financing Activities</td>
                    <td class="right bold ${financingCashFlow >= 0 ? 'positive' : 'negative'}">${financingCashFlow.toLocaleString()}</td>
                  </tr>
                  
                  <tr class="total-row">
                    <td class="bold" style="font-size: 15px;">NET CHANGE IN CASH</td>
                    <td class="right bold ${netCashChange >= 0 ? 'positive' : 'negative'}" style="font-size: 15px;">${netCashChange.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Department Details with Top Items & Low Stock -->
            ${activeDepartments.length > 0 ? `
            <div class="report-section">
              <div class="section-header">🏪 Department Details</div>
              ${activeDepartments.map(dept => `
                <div class="dept-card">
                  <div class="dept-header">
                    <span class="dept-name">${dept.name}</span>
                    <span class="dept-badge ${dept.type === 'Perfume' ? 'perfume' : dept.type === 'Mobile Money' ? 'mobile' : ''}">${dept.type}</span>
                  </div>
                  <div class="dept-stats">
                    <div class="dept-stat">
                      <div class="dept-stat-value positive">${formatCurrency(dept.revenue)}</div>
                      <div class="dept-stat-label">Revenue</div>
                    </div>
                    <div class="dept-stat">
                      <div class="dept-stat-value negative">${formatCurrency(dept.expenses)}</div>
                      <div class="dept-stat-label">Expenses</div>
                    </div>
                    <div class="dept-stat">
                      <div class="dept-stat-value ${dept.netIncome >= 0 ? 'positive' : 'negative'}">${formatCurrency(dept.netIncome)}</div>
                      <div class="dept-stat-label">Net Income</div>
                    </div>
                    <div class="dept-stat">
                      <div class="dept-stat-value">${dept.salesCount}</div>
                      <div class="dept-stat-label">Sales</div>
                    </div>
                  </div>
                  ${dept.topItems.length > 0 ? `
                    <div class="dept-mini">
                      <div class="dept-mini-title">🏆 Top Selling Items</div>
                      <div class="dept-mini-items">
                        ${dept.topItems.map((item, i) => `${i + 1}. ${item.name} (×${item.quantity}) - ${formatCurrency(item.revenue)}`).join('<br>')}
                      </div>
                    </div>
                  ` : ''}
                  ${dept.lowStockItems.length > 0 ? `
                    <div class="dept-mini">
                      <div class="dept-mini-title">⚠️ Low Stock Alert</div>
                      <div class="dept-mini-items low-stock">${dept.lowStockItems.join(', ')}</div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            ` : ''}
            
            <div class="footer">
              <p>This is an automated financial report from ${settings?.business_name || "Your Business"}.</p>
              <p>Report Period: ${periodLabel} | Generated: ${now.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`Sending comprehensive financial report to ${adminEmail}...`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settings?.business_name || "Business"} <reports@dotcombrothersltd.com>`,
        to: [adminEmail],
        subject: `📊 Financial Reports - ${periodLabel} | Revenue: ${formatCurrency(totalRevenue)} | Net Income: ${formatCurrency(netIncome)}`,
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

    // Update last sent timestamp in settings for scheduled reports
    if (scheduledMode || forceMode) {
      const existingJson = settings?.settings_json || {};
      const updatedJson = {
        ...existingJson,
        last_report_sent_at: now.toISOString(),
        last_report_period: periodLabel
      };
      
      await supabase
        .from("settings")
        .update({ settings_json: updatedJson })
        .is("department_id", null);
      
      console.log("Updated last report sent timestamp");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Financial reports sent successfully",
        emailId: responseData.id,
        period: periodLabel,
        scheduled: scheduledMode,
        frequency: settings?.report_email_frequency || "daily",
        summary: {
          totalRevenue,
          totalExpenses,
          grossProfit,
          netIncome,
          departmentCount: activeDepartments.length
        }
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
