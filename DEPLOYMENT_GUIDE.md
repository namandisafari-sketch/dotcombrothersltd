# Complete Deployment & Data Migration Guide

## Table of Contents
1. [Self-Hosted Supabase Configuration](#self-hosted-supabase-configuration)
2. [Deployment Options](#deployment-options)
3. [Data Migration](#data-migration)
4. [User Migration](#user-migration)
5. [Troubleshooting](#troubleshooting)

---

## Self-Hosted Supabase Configuration

### Your Self-Hosted Instance Details
- **Supabase API URL**: `http://172.234.31.22:8000`
- **Supabase Studio**: `http://172.234.31.22:3000`
- **Dashboard Username**: `KABEJJA`

### Environment Variables for Deployment

Set these environment variables in your hosting platform (Vercel, Netlify, VPS, etc.):

```bash
VITE_SELF_HOSTED_SUPABASE_URL=http://172.234.31.22:8000
VITE_SELF_HOSTED_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UiLAogICAgImlhdCI6IDE2NzU0MDAwMDAsCiAgICAiZXhwIjogMTc5OTUzNTYwMAp9.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
```

---

## Deployment Options

### Option 1: Deploy to Vercel (Recommended)

1. **Connect GitHub Repository**
   - Push your code to GitHub
   - Go to [vercel.com](https://vercel.com) and import the repository

2. **Set Environment Variables**
   - In Vercel project settings → Environment Variables
   - Add the two variables above

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Option 2: Deploy to Your VPS (Linode)

1. **Build the Application**
   ```bash
   npm install
   npm run build
   ```

2. **Set Environment Variables**
   Create a `.env.production` file:
   ```bash
   VITE_SELF_HOSTED_SUPABASE_URL=http://172.234.31.22:8000
   VITE_SELF_HOSTED_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Serve with Nginx**
   ```nginx
   server {
       listen 80;
       server_name dotcombrothersltd.com;
       root /var/www/shelf-buzi-pos/dist;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       # Proxy Supabase API calls
       location /supabase/ {
           proxy_pass http://172.234.31.22:8000/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Option 3: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SELF_HOSTED_SUPABASE_URL
ARG VITE_SELF_HOSTED_SUPABASE_ANON_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build \
  --build-arg VITE_SELF_HOSTED_SUPABASE_URL=http://172.234.31.22:8000 \
  --build-arg VITE_SELF_HOSTED_SUPABASE_ANON_KEY=your-anon-key \
  -t shelf-buzi-pos .

docker run -d -p 80:80 shelf-buzi-pos
```

---

## Data Migration

### Step 1: Export Data from Lovable Cloud

Access Lovable Cloud backend to export your data. You can export tables individually or use the SQL below:

```sql
-- Export all table data as JSON
-- Run this in your Lovable Cloud SQL editor or export via UI

-- Export departments
SELECT json_agg(t) FROM departments t;

-- Export products
SELECT json_agg(t) FROM products t;

-- Export customers
SELECT json_agg(t) FROM customers t;

-- Export sales
SELECT json_agg(t) FROM sales t;

-- Export sale_items
SELECT json_agg(t) FROM sale_items t;

-- Export categories
SELECT json_agg(t) FROM categories t;

-- Export settings
SELECT json_agg(t) FROM settings t;

-- Continue for other tables...
```

### Step 2: Create Tables in Self-Hosted Supabase

Open Supabase Studio at `http://172.234.31.22:3000` and run this schema:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier', 'staff');
CREATE TYPE public.credit_status AS ENUM ('pending', 'approved', 'partial', 'settled', 'rejected');
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'mobile_money', 'credit');
CREATE TYPE public.sale_status AS ENUM ('completed', 'voided', 'pending');
CREATE TYPE public.tracking_type AS ENUM ('quantity', 'ml');

-- Departments table
CREATE TABLE public.departments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_mobile_money BOOLEAN DEFAULT false,
    is_perfume_department BOOLEAN DEFAULT false,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Categories table
CREATE TABLE public.categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Suppliers table
CREATE TABLE public.suppliers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Products table
CREATE TABLE public.products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC DEFAULT 0,
    cost_price NUMERIC,
    current_stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    barcode TEXT,
    sku TEXT,
    category_id UUID REFERENCES public.categories(id),
    department_id UUID REFERENCES public.departments(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    is_active BOOLEAN DEFAULT true,
    tracking_type tracking_type DEFAULT 'quantity',
    total_ml NUMERIC,
    cost_per_ml NUMERIC,
    retail_price_per_ml NUMERIC,
    wholesale_price_per_ml NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customers table
CREATE TABLE public.customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC,
    outstanding_balance NUMERIC DEFAULT 0,
    notes TEXT,
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sales table
CREATE TABLE public.sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_number TEXT NOT NULL,
    receipt_number TEXT,
    customer_id UUID REFERENCES public.customers(id),
    department_id UUID REFERENCES public.departments(id),
    cashier_id UUID,
    cashier_name TEXT,
    subtotal NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    amount_paid NUMERIC,
    change_amount NUMERIC,
    payment_method payment_method DEFAULT 'cash',
    status sale_status DEFAULT 'completed',
    is_invoice BOOLEAN DEFAULT false,
    is_loan BOOLEAN DEFAULT false,
    notes TEXT,
    remarks TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID,
    void_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Sale items table
CREATE TABLE public.sale_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    ml_amount NUMERIC,
    price_per_ml NUMERIC,
    bottle_cost NUMERIC,
    customer_type TEXT,
    scent_mixture TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles table (for auth users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    role app_role DEFAULT 'staff',
    department_id UUID REFERENCES public.departments(id),
    nav_permissions TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Settings table
CREATE TABLE public.settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    department_id UUID REFERENCES public.departments(id),
    business_name TEXT,
    business_address TEXT,
    business_phone TEXT,
    business_email TEXT,
    currency TEXT DEFAULT 'UGX',
    tax_rate NUMERIC DEFAULT 0,
    receipt_footer TEXT,
    logo_url TEXT,
    receipt_logo_url TEXT,
    admin_email TEXT,
    whatsapp_number TEXT,
    seasonal_remark TEXT,
    show_back_page BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add other tables as needed (expenses, credits, perfume_scents, etc.)
-- Refer to your Lovable Cloud schema for complete list
```

### Step 3: Import Data

Use Supabase Studio SQL Editor or the API:

```javascript
// Example: Import using Node.js script
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'http://172.234.31.22:8000',
  'your-service-role-key'  // Use service role for imports
);

// Import departments
const departments = require('./exported-departments.json');
await supabase.from('departments').insert(departments);

// Import products
const products = require('./exported-products.json');
await supabase.from('products').insert(products);

// Continue for other tables...
```

### Step 4: Enable Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create policies (example for authenticated users)
CREATE POLICY "Enable read access for authenticated users" ON public.departments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users" ON public.products
    FOR SELECT TO authenticated USING (true);

-- Add similar policies for other tables
-- Adjust based on your security requirements
```

---

## User Migration

### Step 1: Create Admin User in Self-Hosted Supabase

Access Supabase Studio at `http://172.234.31.22:3000`:

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter admin email and password
4. Note the user ID

Then add the admin role:
```sql
-- Replace 'user-uuid-here' with the actual user ID
INSERT INTO public.profiles (id, email, full_name, is_active)
VALUES ('user-uuid-here', 'admin@dotcombrothersltd.com', 'Admin User', true);

INSERT INTO public.user_roles (user_id, role)
VALUES ('user-uuid-here', 'admin');
```

### Step 2: Create Other Staff Users

Use the staff management feature in the app or create manually:

```sql
-- Example: Create staff user profile after they sign up
INSERT INTO public.profiles (id, email, full_name, is_active)
VALUES ('new-user-uuid', 'staff@email.com', 'Staff Name', true);

INSERT INTO public.user_roles (user_id, role, department_id, nav_permissions)
VALUES ('new-user-uuid', 'cashier', 'department-uuid', ARRAY['dashboard', 'sales', 'inventory']);
```

---

## Troubleshooting

### "Unexpected token '<'" Error During Sign-In

This error means the server is returning HTML (like an error page) instead of JSON.

**Common Causes & Fixes:**

1. **Supabase URL is incorrect or unreachable**
   ```bash
   # Test if Supabase is accessible
   curl http://172.234.31.22:8000/auth/v1/health
   # Should return JSON, not HTML
   ```

2. **Environment variables not set during build**
   ```bash
   # When building, ensure these are set:
   export VITE_SELF_HOSTED_SUPABASE_URL=http://172.234.31.22:8000
   export VITE_SELF_HOSTED_SUPABASE_ANON_KEY=your-anon-key
   npm run build
   ```

3. **Kong/GoTrue not properly configured**
   - Access Supabase Studio → Auth → Settings
   - Ensure Site URL is set to your deployment domain
   - Restart the auth service: `docker restart supabase-auth`

4. **Mixed client usage (FIXED in latest update)**
   - All auth-related code now uses the unified Supabase client
   - Ensure you have the latest code from the repository

5. **Test authentication endpoint directly:**
   ```bash
   curl -X POST 'http://172.234.31.22:8000/auth/v1/token?grant_type=password' \
     -H "apikey: your-anon-key" \
     -H "Content-Type: application/json" \
     -d '{"email":"test@email.com","password":"testpass"}'
   # Should return JSON (even if error), NOT HTML
   ```

### CORS Errors
- **Cause**: Browser blocking cross-origin requests
- **Fix**: Configure Kong in your self-hosted Supabase:
  ```yaml
  # In kong.yml, add your domain to allowed origins
  plugins:
    - name: cors
      config:
        origins:
          - http://172.234.31.22
          - https://dotcombrothersltd.com
        methods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        headers:
          - Authorization
          - Content-Type
          - apikey
  ```

### Authentication Not Working
1. Verify JWT_SECRET matches in your `.env`
2. Check that ANON_KEY is correctly set
3. Ensure auto-confirm is enabled for email signups:
   - Access Studio → Authentication → Settings
   - Disable email confirmation requirement for testing

### Database Connection Issues
1. Verify PostgreSQL is running: `systemctl status postgresql`
2. Check PostgREST is running: `systemctl status postgrest`
3. Verify Kong is routing correctly: `curl http://172.234.31.22:8000/rest/v1/`

### SSL/HTTPS Issues
For production, set up SSL:
```bash
# Using certbot with nginx
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d dotcombrothersltd.com
```

---

## Quick Reference

| Service | URL |
|---------|-----|
| Supabase API | http://172.234.31.22:8000 |
| Supabase Studio | http://172.234.31.22:3000 |
| PostgREST | http://172.234.31.22:3001 |
| Kong Admin | http://172.234.31.22:8001 |

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify all environment variables are set
3. Test the Supabase connection directly:
   ```bash
   curl http://172.234.31.22:8000/rest/v1/departments \
     -H "apikey: your-anon-key"
   ```
