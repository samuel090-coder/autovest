CREATE TABLE public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null default 'page_view',
  path text,
  label text,
  meta jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  country text,
  region text,
  city text,
  created_at timestamptz not null default now()
);
CREATE INDEX idx_user_activity_user ON public.user_activity(user_id, created_at DESC);
CREATE INDEX idx_user_activity_ip ON public.user_activity(ip);
GRANT SELECT, INSERT ON public.user_activity TO authenticated;
GRANT ALL ON public.user_activity TO service_role;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_insert_own" ON public.user_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activity_select_admin" ON public.user_activity FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "activity_select_own" ON public.user_activity FOR SELECT TO authenticated USING (auth.uid() = user_id);