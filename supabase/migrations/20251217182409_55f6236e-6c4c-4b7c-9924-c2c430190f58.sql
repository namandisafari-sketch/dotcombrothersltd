-- Add email report scheduling fields to settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS report_email_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS report_email_time text DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS report_email_frequency text DEFAULT 'daily';