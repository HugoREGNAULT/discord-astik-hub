ALTER TABLE public.members
  ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'former', 'away', 'left'));

ALTER TABLE public.donations
  ADD CONSTRAINT donations_status_check
  CHECK (status IN ('active', 'validated', 'cancelled', 'expired'));

ALTER TABLE public.points_ledger
  ADD CONSTRAINT points_ledger_action_type_check
  CHECK (action_type IN ('add', 'remove', 'set', 'donation'));

ALTER TABLE public.config_values
  ADD CONSTRAINT config_values_category_check
  CHECK (category IN ('item', 'action', 'other', 'money'));