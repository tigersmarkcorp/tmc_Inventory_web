-- Add condition column to inventory_items table
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT 'Brand New';

-- Add comment for clarity
COMMENT ON COLUMN inventory_items.condition IS 'Item condition: Brand New, Good, Fair, or Defected';