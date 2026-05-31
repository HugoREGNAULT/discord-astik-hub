CREATE TABLE public.staff_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assignee_discord_id text,
  assignee_username text,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  created_by_discord_id text,
  created_by_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz,
  display_order int NOT NULL DEFAULT 0
);

GRANT SELECT ON public.staff_tasks TO authenticated;
GRANT ALL ON public.staff_tasks TO service_role;

ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_tasks readable by authenticated"
ON public.staff_tasks FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_staff_tasks_status ON public.staff_tasks(status);
CREATE INDEX idx_staff_tasks_assignee ON public.staff_tasks(assignee_discord_id);