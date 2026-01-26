-- Create profiles table for usernames
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create inventory_items table
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  unit_price DECIMAL(10,2),
  image_url TEXT,
  reorder_point INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Create policies for inventory_items
CREATE POLICY "Authenticated users can view inventory"
  ON public.inventory_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert inventory"
  ON public.inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory"
  ON public.inventory_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete inventory"
  ON public.inventory_items FOR DELETE
  TO authenticated
  USING (true);

-- Create borrowed_items table
CREATE TABLE public.borrowed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  borrower_name TEXT NOT NULL,
  borrower_department TEXT,
  quantity INTEGER NOT NULL,
  borrow_date DATE NOT NULL,
  return_date DATE NOT NULL,
  actual_return_date DATE,
  status TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.borrowed_items ENABLE ROW LEVEL SECURITY;

-- Create policies for borrowed_items
CREATE POLICY "Authenticated users can view borrowed items"
  ON public.borrowed_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert borrowed items"
  ON public.borrowed_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update borrowed items"
  ON public.borrowed_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete borrowed items"
  ON public.borrowed_items FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_borrowed_items_updated_at
  BEFORE UPDATE ON public.borrowed_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert sample inventory data
INSERT INTO public.inventory_items (name, category, quantity, status, location, description, unit_price, reorder_point, image_url) VALUES
('Portland Cement', 'Materials', 450, 'In Stock', 'Warehouse A', 'High-quality Portland cement for construction', 250.00, 100, '/placeholder.svg'),
('Steel Rebar', 'Materials', 380, 'In Stock', 'Warehouse B', 'Reinforcement steel bars', 150.00, 50, '/placeholder.svg'),
('Welding Rods', 'Consumables', 15, 'Low Stock', 'Storage Room 1', 'Professional welding electrodes', 45.00, 20, '/placeholder.svg'),
('Safety Helmets', 'Safety Gear', 156, 'In Stock', 'Warehouse A', 'ANSI-approved safety helmets', 85.00, 30, '/placeholder.svg'),
('Circuit Breakers', 'Equipment', 8, 'Low Stock', 'Storage Room 2', 'Industrial circuit breakers', 320.00, 15, '/placeholder.svg'),
('Power Drill', 'Tools', 45, 'In Stock', 'Tool Room', 'Heavy-duty cordless drill', 450.00, 10, '/placeholder.svg'),
('Paint Brushes', 'Tools', 289, 'In Stock', 'Warehouse C', 'Professional painting brushes set', 25.00, 50, '/placeholder.svg'),
('Safety Goggles', 'Safety Gear', 18, 'Low Stock', 'Warehouse A', 'Impact-resistant safety goggles', 35.00, 20, '/placeholder.svg'),
('Concrete Mixer', 'Equipment', 12, 'In Stock', 'Warehouse B', 'Industrial concrete mixer', 8500.00, 5, '/placeholder.svg'),
('Angle Grinder', 'Tools', 34, 'In Stock', 'Tool Room', 'Heavy-duty angle grinder', 650.00, 10, '/placeholder.svg');

-- Insert sample borrowed items data
INSERT INTO public.borrowed_items (item_name, borrower_name, borrower_department, quantity, borrow_date, return_date, status, description, image_url) VALUES
('Power Generator', 'John Martinez', 'Construction', 1, '2025-01-10', '2025-01-20', 'Active', 'Diesel generator for construction site', '/placeholder.svg'),
('Angle Grinder', 'Maria Santos', 'Maintenance', 2, '2025-01-05', '2025-01-12', 'Overdue', 'Needed for metal cutting work', '/placeholder.svg'),
('Concrete Mixer', 'Pedro Reyes', 'Construction', 1, '2025-01-14', '2025-01-21', 'Active', 'For foundation work at site B', '/placeholder.svg'),
('Welding Machine', 'Ana Cruz', 'Fabrication', 1, '2025-01-12', '2025-01-19', 'Active', 'Structural steel welding project', '/placeholder.svg');