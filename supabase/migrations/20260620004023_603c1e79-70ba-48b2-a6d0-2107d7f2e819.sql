
-- Extend transaction_type with referral + claim
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'referral';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'claim';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bonus';

-- Investments: flash sale + max rounds + discount price + popup target route
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS is_flash_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flash_sale_price numeric,
  ADD COLUMN IF NOT EXISTS flash_sale_discount_pct integer,
  ADD COLUMN IF NOT EXISTS flash_sale_route text,
  ADD COLUMN IF NOT EXISTS max_rounds integer NOT NULL DEFAULT 2;

-- User investments: round tracking + completion timestamp
ALTER TABLE public.user_investments
  ADD COLUMN IF NOT EXISTS round integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Wallets: referral bonus pot + bound bank
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS referral_bonus numeric NOT NULL DEFAULT 0;

-- Bank accounts (one per user, can be re-bound)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holder_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_select_own" ON public.bank_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bank_insert_own" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bank_update_own" ON public.bank_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bank_delete_own" ON public.bank_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bank_admin_all" ON public.bank_accounts FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Referrals tracking
CREATE TABLE IF NOT EXISTS public.referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  tier integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_earnings TO authenticated;
GRANT ALL ON public.referral_earnings TO service_role;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_select_own" ON public.referral_earnings FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "ref_admin_all" ON public.referral_earnings FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Generate referral_code for users that don't have one (8-char)
UPDATE public.profiles SET referral_code = upper(substr(md5(id::text || random()::text), 1, 8)) WHERE referral_code IS NULL;

-- Trigger to auto-generate referral_code on insert if null
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substr(md5(NEW.id::text || random()::text), 1, 8));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_gen_ref_code ON public.profiles;
CREATE TRIGGER profiles_gen_ref_code BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.gen_referral_code();

-- Update handle_new_user to honor referral via raw_user_meta_data->>'referral_code'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_code text;
  ref_user uuid;
BEGIN
  ref_code := NEW.raw_user_meta_data->>'referral_code';
  IF ref_code IS NOT NULL AND length(ref_code) > 0 THEN
    SELECT id INTO ref_user FROM public.profiles WHERE upper(referral_code) = upper(ref_code) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, phone, full_name, referred_by)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'full_name', ref_user);

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);

  IF lower(NEW.email) = 'samuelsunday09066423764@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END $$;

-- Referral payout: when a recharge tx is approved, credit referrer 20% (tier 1)
CREATE OR REPLACE FUNCTION public.credit_referral_on_recharge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_user uuid;
  bonus numeric;
BEGIN
  IF NEW.type = 'recharge' AND NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT referred_by INTO ref_user FROM public.profiles WHERE id = NEW.user_id;
    IF ref_user IS NOT NULL THEN
      bonus := NEW.amount * 0.20;
      INSERT INTO public.referral_earnings (referrer_id, referee_id, source_transaction_id, tier, amount)
      VALUES (ref_user, NEW.user_id, NEW.id, 1, bonus);
      UPDATE public.wallets SET referral_bonus = referral_bonus + bonus WHERE user_id = ref_user;
      INSERT INTO public.transactions (user_id, type, amount, status, meta)
      VALUES (ref_user, 'referral', bonus, 'approved', jsonb_build_object('from', NEW.user_id, 'tier', 1));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tx_referral_credit ON public.transactions;
CREATE TRIGGER tx_referral_credit AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.credit_referral_on_recharge();

-- Claim function: validates round complete, starts round 2 OR pays out balance
CREATE OR REPLACE FUNCTION public.start_next_round(_uinv_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ui public.user_investments;
BEGIN
  SELECT * INTO ui FROM public.user_investments WHERE id = _uinv_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF ui.round >= ui.cycle_days THEN NULL; END IF;
  IF ui.completed_at IS NULL THEN RAISE EXCEPTION 'Round not complete yet'; END IF;
  IF ui.round >= (SELECT max_rounds FROM public.investments WHERE id = ui.investment_id) THEN
    RAISE EXCEPTION 'Max rounds reached';
  END IF;
  UPDATE public.user_investments
    SET round = round + 1,
        purchased_at = now(),
        completed_at = NULL,
        last_collected_at = now()
    WHERE id = _uinv_id;
  RETURN jsonb_build_object('ok', true, 'round', ui.round + 1);
END $$;

CREATE OR REPLACE FUNCTION public.claim_investment(_uinv_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ui public.user_investments;
  max_r integer;
  payout numeric;
BEGIN
  SELECT * INTO ui FROM public.user_investments WHERE id = _uinv_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF ui.completed_at IS NULL THEN RAISE EXCEPTION 'Not ready'; END IF;
  IF ui.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Already claimed'; END IF;
  SELECT max_rounds INTO max_r FROM public.investments WHERE id = ui.investment_id;
  IF ui.round < max_r THEN RAISE EXCEPTION 'Finish remaining rounds first'; END IF;
  payout := ui.total_income * ui.round;
  UPDATE public.user_investments SET claimed_at = now(), status = 'claimed' WHERE id = _uinv_id;
  UPDATE public.wallets SET balance = balance + payout,
                            cumulative_income = cumulative_income + payout
                            WHERE user_id = ui.user_id;
  INSERT INTO public.transactions (user_id, type, amount, status, meta)
  VALUES (ui.user_id, 'claim', payout, 'approved', jsonb_build_object('investment_id', ui.investment_id, 'rounds', ui.round));
  RETURN jsonb_build_object('ok', true, 'payout', payout);
END $$;

-- Allow authenticated to call functions
GRANT EXECUTE ON FUNCTION public.claim_investment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_next_round(uuid) TO authenticated;
