-- Add explicit RLS policies on storage.objects for value-icons bucket
-- restricting writes to service_role only. service_role bypasses RLS anyway,
-- but explicit policies satisfy the security scanner and document intent.

CREATE POLICY "value-icons service_role insert"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'value-icons');

CREATE POLICY "value-icons service_role update"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'value-icons')
WITH CHECK (bucket_id = 'value-icons');

CREATE POLICY "value-icons service_role delete"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'value-icons');

CREATE POLICY "value-icons public read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'value-icons');
