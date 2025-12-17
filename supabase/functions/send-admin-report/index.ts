import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DepartmentSummary {
  name: string;
  todaySales: number;
  todayRevenue: number;
  pendingCredits: number;
  lowStockCount: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting admin report generation...");

    // Get settings to check if email reports are enabled
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("*")
      .is("department_id", null)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    if (!settings?.report_email_enabled) {
      console.log("Email reports are disabled");
      return new Response(
        JSON.stringify({ message: "Email reports are disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminEmail = settings.admin_report_email;
    if (!adminEmail) {
      console.log("No admin report email configured");
      return new Response(
        JSON.stringify({ message: "No admin report email configured. Please set it in Settings." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all departments
    const { data: departments, error: deptError } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true);

    if (deptError) {
      console.error("Error fetching departments:", deptError);
      throw new Error("Failed to fetch departments");
    }

    const today = new Date().toISOString().split("T")[0];
    const departmentSummaries: DepartmentSummary[] = [];

    for (const dept of departments || []) {
      // Get today's sales for department
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("total")
        .eq("department_id", dept.id)
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59`)
        .eq("status", "completed");

      if (salesError) {
        console.error(`Error fetching sales for ${dept.name}:`, salesError);
        continue;
      }

      const todaySales = sales?.length || 0;
      const todayRevenue = sales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;

      // Get pending credits
      const { data: credits, error: creditsError } = await supabase
        .from("credits")
        .select("amount")
        .eq("department_id", dept.id)
        .eq("status", "pending");

      const pendingCredits = credits?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      // Get low stock count
      const { data: lowStock, error: stockError } = await supabase
        .from("products")
        .select("id")
        .eq("department_id", dept.id)
        .eq("is_archived", false)
        .lt("current_stock", 5);

      const lowStockCount = lowStock?.length || 0;

      departmentSummaries.push({
        name: dept.name,
        todaySales,
        todayRevenue,
        pendingCredits,
        lowStockCount,
      });
    }

    // Calculate totals
    const totalRevenue = departmentSummaries.reduce((sum, d) => sum + d.todayRevenue, 0);
    const totalSales = departmentSummaries.reduce((sum, d) => sum + d.todaySales, 0);
    const totalPendingCredits = departmentSummaries.reduce((sum, d) => sum + d.pendingCredits, 0);

    // Generate HTML email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .summary-box { background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .department { border-left: 4px solid #667eea; padding-left: 15px; margin-bottom: 15px; }
          .metric { display: inline-block; margin-right: 20px; }
          .metric-value { font-size: 24px; font-weight: bold; color: #667eea; }
          .metric-label { font-size: 12px; color: #666; }
          .warning { color: #e74c3c; }
          h1 { margin: 0; font-size: 24px; }
          h2 { color: #333; font-size: 18px; margin-top: 0; }
          h3 { color: #667eea; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Daily Business Report</h1>
            <p style="margin:0;opacity:0.9;">${settings.business_name || "Your Business"}</p>
            <p style="margin:0;opacity:0.8;font-size:14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <div class="content">
            <div class="summary-box">
              <h2>📈 Today's Overview</h2>
              <div class="metric">
                <div class="metric-value">UGX ${totalRevenue.toLocaleString()}</div>
                <div class="metric-label">Total Revenue</div>
              </div>
              <div class="metric">
                <div class="metric-value">${totalSales}</div>
                <div class="metric-label">Total Sales</div>
              </div>
              <div class="metric">
                <div class="metric-value ${totalPendingCredits > 0 ? 'warning' : ''}">UGX ${totalPendingCredits.toLocaleString()}</div>
                <div class="metric-label">Pending Credits</div>
              </div>
            </div>

            <h2>🏢 Department Breakdown</h2>
            ${departmentSummaries.map(dept => `
              <div class="department">
                <h3>${dept.name}</h3>
                <p>
                  <strong>Sales:</strong> ${dept.todaySales} transactions<br>
                  <strong>Revenue:</strong> UGX ${dept.todayRevenue.toLocaleString()}<br>
                  ${dept.pendingCredits > 0 ? `<span class="warning"><strong>Pending Credits:</strong> UGX ${dept.pendingCredits.toLocaleString()}</span><br>` : ''}
                  ${dept.lowStockCount > 0 ? `<span class="warning"><strong>Low Stock Items:</strong> ${dept.lowStockCount}</span>` : ''}
                </p>
              </div>
            `).join("")}

            <p style="text-align:center;color:#666;font-size:12px;margin-top:30px;">
              This is an automated report from ${settings.business_name || "Your Business"}.<br>
              You can manage these settings in your dashboard.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(`Sending report to ${adminEmail}...`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settings.business_name || "Business"} <onboarding@resend.dev>`,
        to: [adminEmail],
        subject: `📊 Daily Report - ${new Date().toLocaleDateString()} - UGX ${totalRevenue.toLocaleString()}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
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
