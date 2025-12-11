-- Add receipt_logo_url column to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS receipt_logo_url text;