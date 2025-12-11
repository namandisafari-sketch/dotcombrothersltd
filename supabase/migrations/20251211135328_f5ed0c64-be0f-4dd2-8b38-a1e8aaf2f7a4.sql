-- Add stock tracking columns to perfume_scents table
ALTER TABLE public.perfume_scents 
ADD COLUMN IF NOT EXISTS stock_ml numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS empty_bottle_weight_g numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_weight_g numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS density numeric DEFAULT 0.9;

-- Add comment to explain density
COMMENT ON COLUMN public.perfume_scents.density IS 'Density in g/ml - used to convert weight to volume. Default 0.9 for perfume oils';
COMMENT ON COLUMN public.perfume_scents.stock_ml IS 'Current stock in milliliters for this specific scent';
COMMENT ON COLUMN public.perfume_scents.empty_bottle_weight_g IS 'Weight of empty storage container in grams';
COMMENT ON COLUMN public.perfume_scents.current_weight_g IS 'Current weight of container with perfume in grams';