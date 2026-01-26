-- Enable realtime for inventory_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;

-- Enable realtime for borrowed_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.borrowed_items;