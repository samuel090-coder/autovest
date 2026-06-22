
-- ============ LUCKY DRAW ============
CREATE TABLE public.lucky_draw_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  spins_used int NOT NULL DEFAULT 0,
  base_spins int NOT NULL DEFAULT 10,
  bonus_spins int NOT NULL DEFAULT 0,
  lottery_balance numeric NOT NULL DEFAULT 0,
  total_won numeric NOT NULL DEFAULT 0,
  goal_amount numeric NOT NULL DEFAULT 100000,
  referrals_counted int NOT NULL DEFAULT 0,
  referral_target int NOT NULL DEFAULT 15,
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lucky_draw_state TO authenticated;
GRANT ALL ON public.lucky_draw_state TO service_role;
ALTER TABLE public.lucky_draw_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own draw state" ON public.lucky_draw_state FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.lucky_draw_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  kind text NOT NULL DEFAULT 'base', -- base | referral
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lucky_draw_spins TO authenticated;
GRANT ALL ON public.lucky_draw_spins TO service_role;
ALTER TABLE public.lucky_draw_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spins" ON public.lucky_draw_spins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own spins" ON public.lucky_draw_spins FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ FREE CASH CODES ============
CREATE TABLE public.free_cash_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  max_redemptions int NOT NULL DEFAULT 1,
  redeemed_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_cash_codes TO authenticated;
GRANT ALL ON public.free_cash_codes TO service_role;
ALTER TABLE public.free_cash_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage codes" ON public.free_cash_codes FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users read active codes" ON public.free_cash_codes FOR SELECT USING (is_active = true);

CREATE TABLE public.free_cash_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.free_cash_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);
GRANT SELECT, INSERT ON public.free_cash_redemptions TO authenticated;
GRANT ALL ON public.free_cash_redemptions TO service_role;
ALTER TABLE public.free_cash_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own redemptions" ON public.free_cash_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own redemption" ON public.free_cash_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ WITHDRAWAL PROOFS (certification feed) ============
CREATE TABLE public.withdrawal_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_masked text NOT NULL,
  amount numeric NOT NULL,
  caption text NOT NULL,
  image_url text,
  is_ai boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawal_proofs TO anon;
GRANT SELECT, INSERT ON public.withdrawal_proofs TO authenticated;
GRANT ALL ON public.withdrawal_proofs TO service_role;
ALTER TABLE public.withdrawal_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads proofs" ON public.withdrawal_proofs FOR SELECT USING (true);
CREATE POLICY "users insert own proofs" ON public.withdrawal_proofs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage proofs" ON public.withdrawal_proofs FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SETTINGS SEED ============
INSERT INTO public.site_settings (key, value) VALUES
  ('lucky_draw_rules', '"Invite your friends and enjoy more benefits! 🚀🚀\n\n1. Invite friends to play roulette on our platform and earn up to 100,000 Naira in rewards.\n\n2. Earn 20% commission for every successful referral deposit. For example, referring a friend to deposit 100,000 Naira will earn you 20,000 Naira, which can be withdrawn instantly. If your total monthly referral amount reaches 2,000,000 Naira, please contact customer service to claim your VIP bonus."'),
  ('cash_benefits', '{"video_url":"","headline":"Bonus Task","min_withdrawal":6000,"body":"We are proud of the success stories of our professional users! Invest and change your life."}'),
  ('paystack', '{"enabled":false,"public_key":"","mode":"live"}'),
  ('lucky_draw_config', '{"goal":100000,"base_spins":10,"referral_target":15,"base_curve":[8500,7200,9300,6500,11000,8800,7900,9600,8400,9800],"referral_reward_min":150,"referral_reward_max":650}')
ON CONFLICT (key) DO NOTHING;

-- ============ LUCKY DRAW RPCS ============
CREATE OR REPLACE FUNCTION public.lucky_spin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  st public.lucky_draw_state;
  cfg jsonb;
  base_curve jsonb;
  total_spins int;
  win numeric;
  kind text := 'base';
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT value INTO cfg FROM public.site_settings WHERE key = 'lucky_draw_config';
  base_curve := COALESCE(cfg->'base_curve','[8500,7200,9300,6500,11000,8800,7900,9600,8400,9800]'::jsonb);

  INSERT INTO public.lucky_draw_state (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO st FROM public.lucky_draw_state WHERE user_id = uid FOR UPDATE;

  total_spins := st.base_spins + st.bonus_spins;
  IF st.spins_used >= total_spins THEN RAISE EXCEPTION 'No spins left'; END IF;

  IF st.spins_used < st.base_spins THEN
    win := (base_curve->>st.spins_used)::numeric;
    kind := 'base';
  ELSE
    -- referral spin: small random
    win := floor(((COALESCE((cfg->>'referral_reward_min')::numeric,150)) +
                 random() * (COALESCE((cfg->>'referral_reward_max')::numeric,650) - COALESCE((cfg->>'referral_reward_min')::numeric,150))))::numeric;
    kind := 'referral';
  END IF;

  UPDATE public.lucky_draw_state
    SET spins_used = spins_used + 1,
        lottery_balance = lottery_balance + win,
        total_won = total_won + win,
        updated_at = now()
    WHERE user_id = uid;

  INSERT INTO public.lucky_draw_spins (user_id, amount, kind) VALUES (uid, win, kind);

  RETURN jsonb_build_object('ok', true, 'amount', win, 'kind', kind);
END $$;
GRANT EXECUTE ON FUNCTION public.lucky_spin() TO authenticated;

-- Recalc bonus spins from real referral count (called when a referee signs up / on demand)
CREATE OR REPLACE FUNCTION public.lucky_sync_referrals()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  cnt int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COUNT(*) INTO cnt FROM public.profiles WHERE referred_by = uid;
  INSERT INTO public.lucky_draw_state (user_id, bonus_spins, referrals_counted)
    VALUES (uid, cnt, cnt)
  ON CONFLICT (user_id) DO UPDATE SET bonus_spins = EXCLUDED.bonus_spins, referrals_counted = EXCLUDED.referrals_counted, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'bonus_spins', cnt);
END $$;
GRANT EXECUTE ON FUNCTION public.lucky_sync_referrals() TO authenticated;

-- Claim lottery: move lottery_balance into real wallet (only if goal reached)
CREATE OR REPLACE FUNCTION public.lucky_claim()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  st public.lucky_draw_state;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO st FROM public.lucky_draw_state WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No draw state'; END IF;
  IF st.lottery_balance < st.goal_amount THEN RAISE EXCEPTION 'Reach % to withdraw', st.goal_amount; END IF;
  UPDATE public.wallets SET balance = balance + st.lottery_balance WHERE user_id = uid;
  INSERT INTO public.transactions (user_id, type, amount, status, meta)
    VALUES (uid, 'lottery_claim', st.lottery_balance, 'approved', jsonb_build_object('won', st.total_won));
  UPDATE public.lucky_draw_state SET claimed_at = now(), lottery_balance = 0 WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'credited', st.lottery_balance);
END $$;
GRANT EXECUTE ON FUNCTION public.lucky_claim() TO authenticated;

-- ============ FREE CASH RPC ============
CREATE OR REPLACE FUNCTION public.redeem_free_cash(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.free_cash_codes;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO c FROM public.free_cash_codes WHERE upper(code) = upper(_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid code'; END IF;
  IF NOT c.is_active THEN RAISE EXCEPTION 'Code inactive'; END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RAISE EXCEPTION 'Code expired'; END IF;
  IF c.redeemed_count >= c.max_redemptions THEN RAISE EXCEPTION 'Code fully redeemed'; END IF;
  IF EXISTS (SELECT 1 FROM public.free_cash_redemptions WHERE code_id = c.id AND user_id = uid) THEN
    RAISE EXCEPTION 'Already redeemed';
  END IF;
  INSERT INTO public.free_cash_redemptions (code_id, user_id, amount) VALUES (c.id, uid, c.amount);
  UPDATE public.free_cash_codes SET redeemed_count = redeemed_count + 1 WHERE id = c.id;
  UPDATE public.wallets SET balance = balance + c.amount WHERE user_id = uid;
  INSERT INTO public.transactions (user_id, type, amount, status, meta)
    VALUES (uid, 'free_cash', c.amount, 'approved', jsonb_build_object('code', c.code));
  RETURN jsonb_build_object('ok', true, 'amount', c.amount);
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_free_cash(text) TO authenticated;
