-- Create activity_logs table to track user productivity
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);

-- Enable Row Level Security
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only superadmin can view all activity logs
CREATE POLICY "Superadmin can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Allow authenticated users to insert activity logs
CREATE POLICY "Authenticated users can insert activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow superadmin to delete old logs
CREATE POLICY "Superadmin can delete activity logs"
ON public.activity_logs
FOR DELETE
USING (has_role(auth.uid(), 'superadmin'::app_role));