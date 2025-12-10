-- Add missing columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS internal_barcode text,
ADD COLUMN IF NOT EXISTS selling_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_stock numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pricing_tiers jsonb DEFAULT '{}'::jsonb;

-- Add missing columns to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS invoice_number text,
ADD COLUMN IF NOT EXISTS is_invoice boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS change_amount numeric DEFAULT 0;

-- Add missing column to sale_items table
ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS bottle_cost numeric;

-- Create function to generate sequential receipt numbers
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_number integer;
    result text;
BEGIN
    -- Get the count of existing receipts to generate next number
    SELECT COALESCE(MAX(
        CASE 
            WHEN receipt_number ~ '^RCP-[0-9]+$' 
            THEN CAST(SUBSTRING(receipt_number FROM 5) AS integer)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM public.sales;
    
    -- Format as RCP-000001
    result := 'RCP-' || LPAD(next_number::text, 6, '0');
    
    RETURN result;
END;
$$;

-- Create function to get or create master perfume product
CREATE OR REPLACE FUNCTION public.get_or_create_master_perfume()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id uuid;
BEGIN
    -- Try to find existing "Oil Perfume" product
    SELECT id INTO master_id
    FROM public.products
    WHERE name = 'Oil Perfume'
    AND tracking_type = 'ml'
    LIMIT 1;
    
    -- If not found, return NULL (the product should be created manually)
    -- This prevents auto-creation which might not have correct department_id
    RETURN master_id;
END;
$$;