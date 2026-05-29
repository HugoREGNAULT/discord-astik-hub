-- 1. Add image_url to config_values
ALTER TABLE public.config_values
ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Create public storage bucket for value icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('value-icons', 'value-icons', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies: public read, authenticated write
DROP POLICY IF EXISTS "Value icons are publicly readable" ON storage.objects;
CREATE POLICY "Value icons are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'value-icons');

DROP POLICY IF EXISTS "Authenticated can upload value icons" ON storage.objects;
CREATE POLICY "Authenticated can upload value icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'value-icons');

DROP POLICY IF EXISTS "Authenticated can update value icons" ON storage.objects;
CREATE POLICY "Authenticated can update value icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'value-icons');

DROP POLICY IF EXISTS "Authenticated can delete value icons" ON storage.objects;
CREATE POLICY "Authenticated can delete value icons"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'value-icons');