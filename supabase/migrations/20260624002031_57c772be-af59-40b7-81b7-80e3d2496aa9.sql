
-- 1. Missing enum values used by RPCs
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'free_cash';
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'lottery_claim';

-- 2. Message inbox table (announcements / free cash drops / congrats)
CREATE TABLE IF NOT EXISTS public.post_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('announcement','free_cash','congrats')),
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.post_messages TO authenticated;
GRANT SELECT ON public.post_messages TO anon;
GRANT ALL ON public.post_messages TO service_role;

ALTER TABLE public.post_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads messages" ON public.post_messages;
CREATE POLICY "anyone reads messages" ON public.post_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins write messages" ON public.post_messages;
CREATE POLICY "admins write messages" ON public.post_messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS post_messages_created_idx ON public.post_messages (created_at DESC);

-- 3. Reschedule the proof generator cron (already exists -> rebuild)
DO $$
BEGIN
  PERFORM cron.unschedule('generate-withdrawal-proof');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- run every 5 minutes; the edge endpoint itself randomly skips ~30% of runs to space posts to 4-9 min
SELECT cron.schedule(
  'generate-withdrawal-proof',
  '*/5 * * * *',
  $$SELECT net.http_post(url := 'https://vision-invest-dash.lovable.app/api/public/hooks/generate-proof', headers := '{"Content-Type":"application/json"}'::jsonb) AS request_id;$$
);
