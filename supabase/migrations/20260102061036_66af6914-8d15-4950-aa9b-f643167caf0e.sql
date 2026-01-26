-- Add total_items column to track original quantity separately from current quantity
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS total_items integer NOT NULL DEFAULT 0;

-- Update existing rows to set total_items equal to current quantity
UPDATE public.inventory_items SET total_items = quantity WHERE total_items = 0;