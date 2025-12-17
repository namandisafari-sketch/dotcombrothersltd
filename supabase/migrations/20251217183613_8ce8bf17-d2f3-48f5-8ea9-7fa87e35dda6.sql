-- Add separate email field for admin reports
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS admin_report_email text;