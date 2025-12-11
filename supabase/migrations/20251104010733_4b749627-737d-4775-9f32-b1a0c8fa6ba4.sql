-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true);

-- Create RLS policies for item-images bucket
CREATE POLICY "Authenticated users can upload item images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'item-images' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Anyone can view item images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'item-images');

CREATE POLICY "Authenticated users can update item images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'item-images' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete item images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'item-images' AND
  auth.role() = 'authenticated'
);