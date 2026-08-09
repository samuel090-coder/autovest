-- 1. WALLET AUDIT LEDGER -------------------------------------------------
CREATE TABLE public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field text NOT NULL,
  old_value numeric NOT NULL DEFAULT 0,
  new_value numeric NOT NULL DEFAULT 0,
  delta numeric NOT NULL DEFAULT 0,
  reason text,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ledger" ON public.wallet_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all ledger" ON public.wallet_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX wallet_ledger_user_idx ON public.wallet_ledger(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_wallet_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor text := coalesce(auth.uid()::text, 'system');
  _reason text := coalesce(current_setting('app.wallet_reason', true), 'unspecified');
BEGIN
  IF NEW.balance IS DISTINCT FROM OLD.balance THEN
    INSERT INTO public.wallet_ledger(user_id, field, old_value, new_value, delta, reason, actor)
    VALUES (NEW.user_id,'balance',OLD.balance,NEW.balance,NEW.balance-OLD.balance,_reason,_actor);
  END IF;
  IF NEW.bonus_balance IS DISTINCT FROM OLD.bonus_balance THEN
    INSERT INTO public.wallet_ledger(user_id, field, old_value, new_value, delta, reason, actor)
    VALUES (NEW.user_id,'bonus_balance',OLD.bonus_balance,NEW.bonus_balance,NEW.bonus_balance-OLD.bonus_balance,_reason,_actor);
  END IF;
  IF NEW.cumulative_income IS DISTINCT FROM OLD.cumulative_income THEN
    INSERT INTO public.wallet_ledger(user_id, field, old_value, new_value, delta, reason, actor)
    VALUES (NEW.user_id,'cumulative_income',OLD.cumulative_income,NEW.cumulative_income,NEW.cumulative_income-OLD.cumulative_income,_reason,_actor);
  END IF;
  IF NEW.total_withdrawals IS DISTINCT FROM OLD.total_withdrawals THEN
    INSERT INTO public.wallet_ledger(user_id, field, old_value, new_value, delta, reason, actor)
    VALUES (NEW.user_id,'total_withdrawals',OLD.total_withdrawals,NEW.total_withdrawals,NEW.total_withdrawals-OLD.total_withdrawals,_reason,_actor);
  END IF;
  IF NEW.referral_bonus IS DISTINCT FROM OLD.referral_bonus THEN
    INSERT INTO public.wallet_ledger(user_id, field, old_value, new_value, delta, reason, actor)
    VALUES (NEW.user_id,'referral_bonus',OLD.referral_bonus,NEW.referral_bonus,NEW.referral_bonus-OLD.referral_bonus,_reason,_actor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_wallet_changes ON public.wallets;
CREATE TRIGGER trg_log_wallet_changes
AFTER UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.log_wallet_changes();

-- 2. DEVICE FINGERPRINTING ------------------------------------------------
ALTER TABLE public.user_activity
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS is_pwa boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS user_activity_device_idx ON public.user_activity(device_id);

-- 3. PWA INSTALL REWARD ---------------------------------------------------
CREATE TABLE public.app_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  device_id text,
  reward_amount numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_installs TO authenticated;
GRANT ALL ON public.app_installs TO service_role;
ALTER TABLE public.app_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own install" ON public.app_installs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view installs" ON public.app_installs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.claim_install_bonus(_device_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _amount numeric := 100;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  IF EXISTS (SELECT 1 FROM public.app_installs WHERE user_id = _uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;
  IF _device_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.app_installs WHERE device_id = _device_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'device_already_rewarded');
  END IF;
  INSERT INTO public.app_installs(user_id, device_id, reward_amount) VALUES (_uid, _device_id, _amount);
  PERFORM set_config('app.wallet_reason', 'app_install_bonus', true);
  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE user_id = _uid;
  INSERT INTO public.transactions(user_id, type, amount, status, meta)
  VALUES (_uid, 'bonus', _amount, 'approved', jsonb_build_object('source','app_install'));
  RETURN jsonb_build_object('ok', true, 'amount', _amount);
END;
$$;

-- 4. EARN MORE OFFERS -----------------------------------------------------
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  reward_amount numeric NOT NULL,
  required_investment numeric NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.offers TO anon, authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active offers" ON public.offers FOR SELECT USING (is_active);
CREATE POLICY "Admins manage offers" ON public.offers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.offers(key, title, reward_amount, required_investment, description, sort_order) VALUES
 ('offer_500k','₦500,000 Mega Reward',500000,30000,'Buy and successfully run any investment product worth ₦30,000 or more. Once your purchase is active, claim ₦500,000 straight into your real balance.',1),
 ('offer_200k','₦200,000 Starter Reward',200000,16000,'Buy and successfully run any investment product worth ₦16,000 or more. Once your purchase is active, claim ₦200,000 straight into your real balance.',2);

CREATE TABLE public.offer_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offer_key text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, offer_key)
);
GRANT SELECT ON public.offer_claims TO authenticated;
GRANT ALL ON public.offer_claims TO service_role;
ALTER TABLE public.offer_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own offer claims" ON public.offer_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view offer claims" ON public.offer_claims FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.claim_offer(_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _offer public.offers%ROWTYPE;
  _qualified boolean;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  SELECT * INTO _offer FROM public.offers WHERE key = _key AND is_active;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Offer not available'); END IF;
  IF EXISTS (SELECT 1 FROM public.offer_claims WHERE user_id = _uid AND offer_key = _key) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already claimed');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_investments
    WHERE user_id = _uid AND price_paid >= _offer.required_investment
  ) INTO _qualified;
  IF NOT _qualified THEN
    RETURN jsonb_build_object('ok', false, 'error', 'requirement_not_met', 'required', _offer.required_investment);
  END IF;
  INSERT INTO public.offer_claims(user_id, offer_key, amount) VALUES (_uid, _key, _offer.reward_amount);
  PERFORM set_config('app.wallet_reason', 'offer_' || _key, true);
  UPDATE public.wallets SET balance = balance + _offer.reward_amount, updated_at = now() WHERE user_id = _uid;
  INSERT INTO public.transactions(user_id, type, amount, status, meta)
  VALUES (_uid, 'bonus', _offer.reward_amount, 'approved', jsonb_build_object('source','offer','offer_key',_key));
  RETURN jsonb_build_object('ok', true, 'amount', _offer.reward_amount);
END;
$$;