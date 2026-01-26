-- Add signature_url column to borrowed_items table
ALTER TABLE public.borrowed_items
ADD COLUMN signature_url text;