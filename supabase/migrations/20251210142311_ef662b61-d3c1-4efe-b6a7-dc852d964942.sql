-- Create perfume_pricing_config table for storing bottle pricing and cost configurations
CREATE TABLE IF NOT EXISTS public.perfume_pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  retail_bottle_pricing jsonb DEFAULT '{"sizes": []}'::jsonb,
  wholesale_bottle_pricing jsonb DEFAULT '{"sizes": []}'::jsonb,
  bottle_cost_config jsonb DEFAULT '{"ranges": []}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(department_id)
);

-- Enable RLS
ALTER TABLE public.perfume_pricing_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Perfume pricing config viewable by authenticated"
ON public.perfume_pricing_config
FOR SELECT
USING (true);

CREATE POLICY "Staff can manage perfume pricing config"
ON public.perfume_pricing_config
FOR ALL
USING (true);