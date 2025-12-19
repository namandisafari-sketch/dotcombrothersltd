-- Cash drawer shifts table for float tracking
CREATE TABLE public.cash_drawer_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES public.departments(id),
  opened_by UUID,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  opening_float NUMERIC NOT NULL DEFAULT 0,
  closed_by UUID,
  closed_at TIMESTAMP WITH TIME ZONE,
  closing_cash NUMERIC,
  expected_cash NUMERIC,
  discrepancy NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Multi-currency cash counts table
CREATE TABLE public.currency_cash_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES public.cash_drawer_shifts(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'UGX',
  amount NUMERIC NOT NULL DEFAULT 0,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  amount_in_base NUMERIC NOT NULL DEFAULT 0,
  count_type TEXT NOT NULL DEFAULT 'closing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Daily closing checklists table
CREATE TABLE public.closing_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES public.cash_drawer_shifts(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id),
  completed_by UUID,
  cash_counted BOOLEAN DEFAULT false,
  cash_verified BOOLEAN DEFAULT false,
  discrepancy_explained BOOLEAN DEFAULT false,
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_drawer_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_cash_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_checklists ENABLE ROW LEVEL SECURITY;

-- RLS policies for cash_drawer_shifts
CREATE POLICY "Cash drawer shifts viewable by authenticated" ON public.cash_drawer_shifts
  FOR SELECT USING (true);
CREATE POLICY "Staff can manage cash drawer shifts" ON public.cash_drawer_shifts
  FOR ALL USING (true);

-- RLS policies for currency_cash_counts
CREATE POLICY "Currency cash counts viewable by authenticated" ON public.currency_cash_counts
  FOR SELECT USING (true);
CREATE POLICY "Staff can manage currency cash counts" ON public.currency_cash_counts
  FOR ALL USING (true);

-- RLS policies for closing_checklists
CREATE POLICY "Closing checklists viewable by authenticated" ON public.closing_checklists
  FOR SELECT USING (true);
CREATE POLICY "Staff can manage closing checklists" ON public.closing_checklists
  FOR ALL USING (true);