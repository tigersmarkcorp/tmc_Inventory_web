-- Drop existing SELECT policy for activity_logs
DROP POLICY IF EXISTS "Superadmin can view all activity logs" ON public.activity_logs;

-- Create new policy allowing all authenticated users to view activity logs
CREATE POLICY "Authenticated users can view activity logs" 
ON public.activity_logs 
FOR SELECT 
TO authenticated
USING (true);