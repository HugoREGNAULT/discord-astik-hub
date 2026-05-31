CREATE INDEX IF NOT EXISTS idx_logs_payload_gin
ON public.logs USING gin (payload jsonb_path_ops);