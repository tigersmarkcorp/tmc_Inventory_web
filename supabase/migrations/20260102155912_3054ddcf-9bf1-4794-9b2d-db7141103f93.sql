
-- Create table for used/given items
CREATE TABLE public.used_given_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('used', 'given')),
  recipient_name TEXT,
  recipient_department TEXT,
  reason TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  image_url TEXT,
  unit_price NUMERIC,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.used_given_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view used/given items based on role"
ON public.used_given_items FOR SELECT
USING (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'viewer'::app_role)
);

CREATE POLICY "Only superadmin and admin can insert used/given items"
ON public.used_given_items FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only superadmin and admin can update used/given items"
ON public.used_given_items FOR UPDATE
USING (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only superadmin and admin can delete used/given items"
ON public.used_given_items FOR DELETE
USING (
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_used_given_items_updated_at
BEFORE UPDATE ON public.used_given_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
