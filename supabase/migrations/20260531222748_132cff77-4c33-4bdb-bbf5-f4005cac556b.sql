CREATE POLICY "value-icons authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'value-icons');

CREATE POLICY "value-icons authenticated update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'value-icons')
WITH CHECK (bucket_id = 'value-icons');

CREATE POLICY "value-icons authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'value-icons');