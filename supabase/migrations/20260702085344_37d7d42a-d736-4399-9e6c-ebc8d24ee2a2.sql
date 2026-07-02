
-- Bonus (Cash Benefits) videos + watch state
CREATE TABLE public.bonus_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  poster_url TEXT,
  duration_seconds INT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bonus_videos TO authenticated, anon;
GRANT ALL ON public.bonus_videos TO service_role;
ALTER TABLE public.bonus_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active bonus videos" ON public.bonus_videos FOR SELECT USING (is_active = true);
CREATE POLICY "admin manages bonus videos" ON public.bonus_videos FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.bonus_watches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.bonus_videos(id) ON DELETE CASCADE,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);
GRANT SELECT, INSERT ON public.bonus_watches TO authenticated;
GRANT ALL ON public.bonus_watches TO service_role;
ALTER TABLE public.bonus_watches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own watches" ON public.bonus_watches FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.bonus_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  next_available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bonus_state TO authenticated;
GRANT ALL ON public.bonus_state TO service_role;
ALTER TABLE public.bonus_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own bonus state" ON public.bonus_state FOR SELECT USING (auth.uid() = user_id);

-- RPC: claim a bonus watch. Rewards ₦27 (or configured), sets 1h cooldown,
-- and clears the inviter's cooldown so they can watch immediately.
CREATE OR REPLACE FUNCTION public.complete_bonus_watch(_video_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  reward NUMERIC := 27;
  cooldown_sec INT := 3600;
  cfg JSONB;
  now_ts TIMESTAMPTZ := now();
  next_ts TIMESTAMPTZ;
  already UUID;
  inviter UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT value INTO cfg FROM site_settings WHERE key = 'cash_benefits';
  IF cfg ? 'reward_amount' THEN reward := (cfg->>'reward_amount')::NUMERIC; END IF;
  IF cfg ? 'cooldown_seconds' THEN cooldown_sec := (cfg->>'cooldown_seconds')::INT; END IF;

  -- Enforce cooldown
  SELECT next_available_at INTO next_ts FROM bonus_state WHERE user_id = uid;
  IF next_ts IS NOT NULL AND next_ts > now_ts THEN
    RAISE EXCEPTION 'cooldown';
  END IF;

  -- Prevent double reward on the same video
  SELECT id INTO already FROM bonus_watches WHERE user_id = uid AND video_id = _video_id;
  IF already IS NOT NULL THEN
    RAISE EXCEPTION 'already watched';
  END IF;

  INSERT INTO bonus_watches(user_id, video_id, reward_amount) VALUES (uid, _video_id, reward);

  UPDATE wallets SET balance = balance + reward, cumulative_income = cumulative_income + reward, updated_at = now_ts
    WHERE user_id = uid;
  INSERT INTO transactions(user_id, type, amount, status, meta)
    VALUES (uid, 'bonus', reward, 'approved', jsonb_build_object('kind','bonus_video','video_id',_video_id));

  INSERT INTO bonus_state(user_id, next_available_at, updated_at)
    VALUES (uid, now_ts + make_interval(secs => cooldown_sec), now_ts)
    ON CONFLICT (user_id) DO UPDATE SET next_available_at = EXCLUDED.next_available_at, updated_at = now_ts;

  -- Speed up inviter: clear their cooldown so they can watch immediately.
  SELECT referred_by INTO inviter FROM profiles WHERE id = uid;
  IF inviter IS NOT NULL THEN
    INSERT INTO bonus_state(user_id, next_available_at, updated_at)
      VALUES (inviter, now_ts, now_ts)
      ON CONFLICT (user_id) DO UPDATE SET next_available_at = LEAST(bonus_state.next_available_at, now_ts), updated_at = now_ts;
  END IF;

  RETURN jsonb_build_object('reward', reward, 'next_available_at', now_ts + make_interval(secs => cooldown_sec));
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_bonus_watch(UUID) TO authenticated;
