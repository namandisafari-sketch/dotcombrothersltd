import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create client with user's token for auth check
    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the calling user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roles } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roles) {
      throw new Error('Only admins can create users');
    }

    // Create service role client for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, password, fullName, role, departmentId, navPermissions } = await req.json();

    if (!email || !password || !fullName || !role) {
      throw new Error('Missing required fields: email, password, fullName, and role are required.');
    }

    // Department is required for non-admin users
    if (role !== 'admin' && !departmentId) {
      throw new Error('Department is required for non-admin users.');
    }

    console.log(`Creating user: ${email}`);

    // Create user account
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    console.log(`User created with ID: ${authData.user.id}`);

    // First delete all existing roles, then insert the new one
    const { error: deleteError } = await supabaseClient
      .from('user_roles')
      .delete()
      .eq('user_id', authData.user.id);

    if (deleteError) {
      console.error('Role deletion error:', deleteError);
    }

    // Insert new role (we deleted existing ones above)
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role,
        department_id: departmentId || null,
      });

    if (roleError) {
      console.error('Role creation error:', roleError);
      throw roleError;
    }

    // Department is stored in user_roles, not in profiles
    // Profile is auto-created by the handle_new_user trigger

    // Insert navigation permissions if provided and user is not admin
    if (navPermissions && Array.isArray(navPermissions) && navPermissions.length > 0 && role !== 'admin') {
      // Deduplicate permissions using Set
      const uniquePermissions = Array.from(new Set(navPermissions));
      const permissions = uniquePermissions.map((path: string) => ({
        user_id: authData.user.id,
        nav_path: path,
      }));
      
      const { error: permError } = await supabaseClient
        .from('user_nav_permissions')
        .insert(permissions);
      
      if (permError) {
        console.error('Navigation permissions error:', permError);
        // Don't fail the entire operation for permissions error
      }
    }

    console.log(`User setup complete: ${email}`);

    return new Response(
      JSON.stringify({ success: true, userId: authData.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-staff-user:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create user. Please contact support.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
