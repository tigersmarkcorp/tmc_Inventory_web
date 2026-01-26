-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('superadmin', 'admin', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE 
    WHEN role = 'superadmin' THEN 1
    WHEN role = 'admin' THEN 2
    WHEN role = 'viewer' THEN 3
  END
  LIMIT 1
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Only superadmin can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Only superadmin can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Only superadmin can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'superadmin'));

-- Update profiles table policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id 
  OR public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
);

-- Update inventory_items policies
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated users can insert inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated users can update inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Authenticated users can delete inventory" ON public.inventory_items;

CREATE POLICY "Users can view inventory based on role"
ON public.inventory_items
FOR SELECT
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'viewer')
);

CREATE POLICY "Only superadmin and admin can insert inventory"
ON public.inventory_items
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only superadmin and admin can update inventory"
ON public.inventory_items
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only superadmin and admin can delete inventory"
ON public.inventory_items
FOR DELETE
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
);

-- Update borrowed_items policies
DROP POLICY IF EXISTS "Authenticated users can view borrowed items" ON public.borrowed_items;
DROP POLICY IF EXISTS "Authenticated users can insert borrowed items" ON public.borrowed_items;
DROP POLICY IF EXISTS "Authenticated users can update borrowed items" ON public.borrowed_items;
DROP POLICY IF EXISTS "Authenticated users can delete borrowed items" ON public.borrowed_items;

CREATE POLICY "Users can view borrowed items based on role"
ON public.borrowed_items
FOR SELECT
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'viewer')
);

CREATE POLICY "Only superadmin and admin can insert borrowed items"
ON public.borrowed_items
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only superadmin and admin can update borrowed items"
ON public.borrowed_items
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only superadmin and admin can delete borrowed items"
ON public.borrowed_items
FOR DELETE
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
);