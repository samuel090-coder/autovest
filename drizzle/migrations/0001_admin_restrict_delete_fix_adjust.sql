ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'admin_adjustment';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS restricted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS restricted_reason text;

CREATE OR REPLACE FUNCTION public.tg_guard_profile_restriction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.restricted_at IS DISTINCT FROM OLD.restricted_at OR NEW.restricted_reason IS DISTINCT FROM OLD.restricted_reason)
     AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_profile_restriction ON public.profiles;
CREATE TRIGGER guard_profile_restriction BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_profile_restriction();

CREATE OR REPLACE FUNCTION public.admin_set_restriction(_user_id uuid, _restricted boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot restrict yourself'; END IF;
  UPDATE profiles SET restricted_at = CASE WHEN _restricted THEN now() ELSE NULL END,
    restricted_reason = CASE WHEN _restricted THEN nullif(trim(_reason), '') ELSE NULL END
  WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_restriction(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_purge_user_data(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot delete yourself'; END IF;
  UPDATE profiles SET referred_by = NULL WHERE referred_by = _user_id;
  UPDATE free_cash_codes SET created_by = NULL WHERE created_by = _user_id;
  DELETE FROM referral_earnings WHERE referrer_id = _user_id OR referee_id = _user_id;
  FOREACH t IN ARRAY ARRAY['notifications','push_subscriptions','user_activity','user_investments','bank_accounts','bonus_state','bonus_watches','free_cash_redemptions','lucky_draw_spins','lucky_draw_state','offer_claims','app_installs','payment_complaints','withdrawal_proofs','wallet_ledger','transactions','wallets','user_roles']
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', t) USING _user_id;
  END LOOP;
  DELETE FROM profiles WHERE id = _user_id;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_purge_user_data(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(_user_id uuid, _amount numeric, _reason text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _old numeric; _bal numeric; _applied numeric; _r text := coalesce(nullif(trim(_reason),''), 'Admin adjustment');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT balance INTO _old FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  _bal := GREATEST(0, _old + _amount);
  _applied := _bal - _old;
  IF _applied = 0 THEN RAISE EXCEPTION 'Balance is already zero'; END IF;
  UPDATE wallets SET balance = _bal, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO transactions (user_id, type, amount, status, meta)
  VALUES (_user_id, 'admin_adjustment', ABS(_applied), 'approved',
    jsonb_build_object('direction', CASE WHEN _applied > 0 THEN 'credit' ELSE 'debit' END, 'reason', _r, 'by', auth.uid()));
  PERFORM public.notify_user(_user_id, 'wallet',
    CASE WHEN _applied > 0 THEN 'Money added to your wallet 💰' ELSE 'Money deducted from your wallet' END,
    format('₦%s has been %s your wallet. Reason: %s. New balance: ₦%s.',
      to_char(ABS(_applied), 'FM999,999,999,990'),
      CASE WHEN _applied > 0 THEN 'added to' ELSE 'deducted from' END, _r, to_char(_bal, 'FM999,999,999,990')),
    '/wallet', NULL, 'admin-adj-' || gen_random_uuid()::text,
    jsonb_build_object('delta', _applied, 'reason', _r));
  RETURN _bal;
END $function$;