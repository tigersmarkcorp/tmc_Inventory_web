-- supabase/migrations/20251226000000_add_restore_borrowed_quantity_function.sql

-- Create the restore_borrowed_quantity function if it doesn't exist
CREATE OR REPLACE FUNCTION restore_borrowed_quantity(item_id UUID, qty_to_add INT)
RETURNS VOID AS $$
DECLARE
  new_qty INT;
BEGIN
  -- Safely update quantity and get the new value
  UPDATE inventory_items
  SET quantity = quantity + qty_to_add
  WHERE id = item_id
  RETURNING quantity INTO new_qty;

  -- Update status based on new quantity
  UPDATE inventory_items
  SET status = CASE
    WHEN new_qty = 0 THEN 'Out of Stock'
    WHEN new_qty < 30 THEN 'Low Stock'
    ELSE 'In Stock'
  END
  WHERE id = item_id;
END;
$$ LANGUAGE plpgsql;

-- Grant usage (needed for RLS if enabled)
GRANT EXECUTE ON FUNCTION restore_borrowed_quantity(UUID, INT) TO authenticated, anon;
