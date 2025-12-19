import { supabaseClient as supabase } from "@/lib/supabase";

// ============= AUTH =============
export const authApi = {
  signUp: async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    return data;
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  }
};

// ============= DEPARTMENTS =============
export const departmentsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  create: async (department: { name: string; description?: string; is_active?: boolean }) => {
    const { data, error } = await supabase
      .from('departments')
      .insert(department)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, department: Partial<{ name: string; description: string; is_active: boolean }>) => {
    const { data, error } = await supabase
      .from('departments')
      .update(department)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= CUSTOMERS =============
export const customersApi = {
  getAll: async (departmentId?: string) => {
    let query = supabase.from('customers').select('*').order('name');
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  getCount: async (departmentId?: string) => {
    let query = supabase.from('customers').select('id', { count: 'exact', head: true });
    if (departmentId) query = query.eq('department_id', departmentId);
    const { count, error } = await query;
    if (error) throw error;
    return { count };
  },

  create: async (customer: { name: string; email?: string; phone?: string; address?: string; notes?: string; department_id?: string }) => {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, customer: Partial<{ name: string; email: string; phone: string; address: string; notes: string }>) => {
    const { data, error } = await supabase
      .from('customers')
      .update(customer)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= PRODUCTS =============
export const productsApi = {
  getAll: async (departmentId?: string) => {
    let query = supabase.from('products').select('*, categories(name)').order('name');
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  getLowStock: async (departmentId?: string) => {
    let query = supabase
      .from('products')
      .select('*')
      .lt('stock', supabase.rpc ? 5 : 5); // Default min_stock fallback
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    // Filter client-side for min_stock comparison
    return data?.filter(p => (p.stock || 0) < (p.min_stock || 5)) || [];
  },

  getCount: async (departmentId?: string) => {
    let query = supabase.from('products').select('id', { count: 'exact', head: true });
    if (departmentId) query = query.eq('department_id', departmentId);
    const { count, error } = await query;
    if (error) throw error;
    return { count };
  },

  create: async (product: any) => {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, product: any) => {
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= PRODUCT VARIANTS =============
export const productVariantsApi = {
  getAll: async (productId?: string) => {
    let query = supabase.from('product_variants').select('*');
    if (productId) query = query.eq('product_id', productId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  create: async (variant: any) => {
    const { data, error } = await supabase
      .from('product_variants')
      .insert(variant)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, variant: any) => {
    const { data, error } = await supabase
      .from('product_variants')
      .update(variant)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= SALES =============
export const salesApi = {
  getAll: async (params?: { startDate?: string; endDate?: string; status?: string; departmentId?: string }) => {
    let query = supabase.from('sales').select('*, customers(name)').order('created_at', { ascending: false });
    if (params?.departmentId) query = query.eq('department_id', params.departmentId);
    if (params?.status) query = query.eq('status', params.status as 'completed' | 'pending' | 'voided');
    if (params?.startDate) query = query.gte('created_at', params.startDate);
    if (params?.endDate) query = query.lte('created_at', params.endDate);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  getToday: async (departmentId?: string) => {
    const today = new Date().toISOString().split('T')[0];
    let query = supabase
      .from('sales')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    
    const totalSales = data?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0;
    return { sales: data, totalSales, count: data?.length || 0 };
  },

  getRecent: async (departmentId?: string, limit: number = 10) => {
    let query = supabase
      .from('sales')
      .select('*, customers(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (saleData: { sale: any; items: any[] }) => {
    // Create sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(saleData.sale)
      .select()
      .single();
    if (saleError) throw saleError;

    // Create sale items
    const itemsWithSaleId = saleData.items.map(item => ({
      ...item,
      sale_id: sale.id
    }));
    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(itemsWithSaleId);
    if (itemsError) throw itemsError;

    // Update stock for each item
    for (const item of saleData.items) {
      if (item.product_id) {
        const { data: product } = await supabase
          .from('products')
          .select('stock, total_ml, tracking_type')
          .eq('id', item.product_id)
          .single();
        
        if (product) {
          if (product.tracking_type === 'ml' && item.ml_amount) {
            await supabase
              .from('products')
              .update({ total_ml: (product.total_ml || 0) - item.ml_amount })
              .eq('id', item.product_id);
          } else {
            await supabase
              .from('products')
              .update({ stock: (product.stock || 0) - item.quantity })
              .eq('id', item.product_id);
          }
        }
      }
      if (item.variant_id) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock')
          .eq('id', item.variant_id)
          .single();
        
        if (variant) {
          await supabase
            .from('product_variants')
            .update({ stock: (variant.stock || 0) - item.quantity })
            .eq('id', item.variant_id);
        }
      }
    }

    return sale;
  },

  voidSale: async (id: string, voidReason: string, voidedBy: string) => {
    const { data, error } = await supabase
      .from('sales')
      .update({
        status: 'voided',
        void_reason: voidReason,
        voided_by: voidedBy,
        voided_at: new Date().toISOString()
      } as any)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= SALE ITEMS =============
export const saleItemsApi = {
  getBySale: async (saleId: string) => {
    const { data, error } = await supabase
      .from('sale_items')
      .select('*, products(name), product_variants(name), services(name)')
      .eq('sale_id', saleId);
    if (error) throw error;
    return data;
  }
};

// ============= SERVICES =============
export const servicesApi = {
  getAll: async (departmentId?: string) => {
    let query = supabase.from('services').select('*').order('name');
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (service: any) => {
    const { data, error } = await supabase
      .from('services')
      .insert(service)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, service: any) => {
    const { data, error } = await supabase
      .from('services')
      .update(service)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= CATEGORIES =============
export const categoriesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  create: async (category: { name: string; department_id?: string }) => {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= SETTINGS =============
export const settingsApi = {
  get: async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  getDepartmentSettings: async (departmentId: string) => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('department_id', departmentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  update: async (id: string, settings: any) => {
    const { data, error } = await supabase
      .from('settings')
      .update(settings)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  upsert: async (settings: any) => {
    const { data, error } = await supabase
      .from('settings')
      .upsert(settings)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= EXPENSES =============
export const expensesApi = {
  getAll: async (params?: { departmentId?: string; startDate?: string; endDate?: string }) => {
    let query = supabase.from('expenses').select('*').order('created_at', { ascending: false });
    if (params?.departmentId) query = query.eq('department_id', params.departmentId);
    if (params?.startDate) query = query.gte('expense_date', params.startDate);
    if (params?.endDate) query = query.lte('expense_date', params.endDate);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (expense: any) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, expense: any) => {
    const { data, error } = await supabase
      .from('expenses')
      .update(expense)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= CREDITS =============
export const creditsApi = {
  getAll: async (params?: { department_id?: string; is_admin?: boolean }) => {
    let query = supabase.from('credits').select('*, customers(name)').order('created_at', { ascending: false });
    if (params?.department_id && !params?.is_admin) {
      query = query.eq('department_id', params.department_id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (credit: any) => {
    const { data, error } = await supabase
      .from('credits')
      .insert(credit)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateStatus: async (id: string, status: 'pending' | 'approved' | 'partial' | 'settled' | 'rejected') => {
    const { data, error } = await supabase
      .from('credits')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  settle: async (id: string) => {
    const { data: credit } = await supabase
      .from('credits')
      .select('amount')
      .eq('id', id)
      .single();
    
    const { data, error } = await supabase
      .from('credits')
      .update({ status: 'settled', paid_amount: credit?.amount || 0 })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= INBOX =============
export const inboxApi = {
  getAll: async (params?: { department_id?: string; is_admin?: boolean }) => {
    let query = supabase.from('inbox').select('*').order('created_at', { ascending: false });
    if (params?.department_id && !params?.is_admin) {
      query = query.eq('department_id', params.department_id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  markAsRead: async (id: string) => {
    const { data, error } = await supabase
      .from('inbox')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  create: async (message: any) => {
    const { data, error } = await supabase
      .from('inbox')
      .insert(message)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= PERFUME SCENTS =============
export const perfumeScentsApi = {
  getAll: async (departmentId?: string) => {
    let query = supabase.from('perfume_scents').select('*').order('name');
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (scent: any) => {
    const { data, error } = await supabase
      .from('perfume_scents')
      .insert(scent)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, scent: any) => {
    const { data, error } = await supabase
      .from('perfume_scents')
      .update(scent)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('perfume_scents')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= USER ROLES =============
export const userRolesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*, profiles(full_name, email)');
    if (error) throw error;
    return data;
  },

  getByUser: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  update: async (userId: string, roleData: { role: 'admin' | 'manager' | 'cashier' | 'staff'; department_id?: string; nav_permissions?: string[] }) => {
    const { data, error } = await supabase
      .from('user_roles')
      .update(roleData)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= PROFILES =============
export const profilesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, user_roles(role, department_id, nav_permissions)');
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, user_roles(role, department_id, nav_permissions)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  update: async (id: string, profile: { full_name?: string; avatar_url?: string; is_active?: boolean }) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= LANDING PAGE CONTENT =============
export const landingPageContentApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('landing_page_content')
      .select('*');
    if (error) throw error;
    return data;
  },

  update: async (id: string, content: any) => {
    const { data, error } = await supabase
      .from('landing_page_content')
      .update(content)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= SERVICE SHOWCASE =============
export const serviceShowcaseApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('service_showcase')
      .select('*')
      .order('display_order');
    if (error) throw error;
    return data;
  },

  create: async (service: any) => {
    const { data, error } = await supabase
      .from('service_showcase')
      .insert(service)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, service: any) => {
    const { data, error } = await supabase
      .from('service_showcase')
      .update(service)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('service_showcase')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= STOCK CHECKING =============
export const stockApi = {
  checkVariantStock: async (variantId: string, quantity: number) => {
    const variant = await productVariantsApi.getById(variantId);
    if (!variant) {
      return { available: false, message: "Variant not found" };
    }
    const available = (variant.stock || 0) >= quantity;
    return {
      available,
      message: available ? undefined : `Only ${variant.stock} units available`,
    };
  },

  checkProductStock: async (productId: string, quantity: number, trackingType?: string, totalMl?: number) => {
    const product = await productsApi.getById(productId);
    if (!product) {
      return { available: false, message: "Product not found" };
    }
    
    if (trackingType === 'ml' && totalMl !== undefined) {
      const availableMl = product.total_ml || product.stock || 0;
      const available = availableMl >= totalMl;
      return {
        available,
        message: available ? undefined : `Only ${availableMl}ml available`,
      };
    }
    
    const available = (product.stock || 0) >= quantity;
    return {
      available,
      message: available ? undefined : `Only ${product.stock} units available`,
    };
  }
};

// ============= RECONCILIATIONS =============
export const reconciliationsApi = {
  getAll: async (params?: { departmentId?: string; startDate?: string; endDate?: string; status?: string }) => {
    let query = supabase.from('reconciliations').select('*').order('date', { ascending: false });
    if (params?.departmentId) query = query.eq('department_id', params.departmentId);
    if (params?.startDate) query = query.gte('date', params.startDate);
    if (params?.endDate) query = query.lte('date', params.endDate);
    if (params?.status) query = query.eq('status', params.status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (reconciliation: any) => {
    const { data, error } = await supabase
      .from('reconciliations')
      .insert(reconciliation)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, reconciliation: any) => {
    const { data, error } = await supabase
      .from('reconciliations')
      .update(reconciliation)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= SUSPENDED REVENUE =============
export const suspendedRevenueApi = {
  getAll: async (departmentId?: string) => {
    let query = supabase.from('suspended_revenue').select('*').order('created_at', { ascending: false });
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (record: any) => {
    const { data, error } = await supabase
      .from('suspended_revenue')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, record: any) => {
    const { data, error } = await supabase
      .from('suspended_revenue')
      .update(record)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= INTERNAL USAGE =============
export const internalUsageApi = {
  getAll: async (departmentId?: string) => {
    let query = supabase.from('internal_stock_usage').select('*, products(name, unit), departments:department_id(name)').order('created_at', { ascending: false });
    if (departmentId) query = query.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  create: async (usage: any) => {
    const { data, error } = await supabase
      .from('internal_stock_usage')
      .insert(usage)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from('internal_stock_usage')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// ============= SUPPLIERS =============
export const suppliersApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  create: async (supplier: any) => {
    const { data, error } = await supabase
      .from('suppliers')
      .insert(supplier)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, supplier: any) => {
    const { data, error } = await supabase
      .from('suppliers')
      .update(supplier)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// ============= INTERDEPARTMENTAL INBOX =============
export const interdepartmentalInboxApi = {
  create: async (message: any) => {
    const { data, error } = await supabase
      .from('interdepartmental_inbox')
      .insert(message)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
