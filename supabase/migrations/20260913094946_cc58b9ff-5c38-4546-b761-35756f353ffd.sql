
-- 1. Prevent duplicate referral bonus per deposit
DELETE FROM public.referral_earnings a
USING public.referral_earnings b
WHERE a.ctid < b.ctid
  AND a.source_transaction_id IS NOT NULL
  AND a.source_transaction_id = b.source_transaction_id;

CREATE UNIQUE INDEX IF NOT EXISTS referral_earnings_source_tx_uniq
  ON public.referral_earnings (source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;

-- 2. Prevent duplicate pending recharges from repeated taps / refreshes
CREATE UNIQUE INDEX IF NOT EXISTS transactions_pending_recharge_idem
  ON public.transactions (user_id, (meta->>'idem'))
  WHERE type = 'recharge' AND status = 'pending' AND (meta->>'idem') IS NOT NULL;

-- 3. Masking helper
CREATE OR REPLACE FUNCTION public.mask_identity(_name text, _phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    NULLIF(
      CASE
        WHEN COALESCE(_name, '') <> '' THEN
          left(_name, LEAST(3, length(_name))) || repeat('*', GREATEST(length(_name) - 3, 1))
        WHEN COALESCE(_phone, '') <> '' THEN
          left(_phone, 4) || '****' || right(_phone, 3)
        ELSE NULL
      END, ''),
    'Member');
$$;

-- 4. Caller's referrals (registration vs qualification)
CREATE OR REPLACE FUNCTION public.get_my_referrals()
RETURNS TABLE (
  referee_id uuid,
  display_name text,
  joined_at timestamptz,
  has_deposited boolean,
  deposit_total numeric,
  bonus_earned numeric,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    public.mask_identity(p.full_name, p.phone),
    p.created_at,
    COALESCE(d.total, 0) > 0,
    COALESCE(d.total, 0),
    COALESCE(e.total, 0),
    CASE WHEN COALESCE(d.total, 0) > 0 THEN 'valid' ELSE 'pending_deposit' END
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT SUM(t.amount) AS total
    FROM public.transactions t
    WHERE t.user_id = p.id AND t.type = 'recharge' AND t.status = 'approved'
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT SUM(re.amount) AS total
    FROM public.referral_earnings re
    WHERE re.referrer_id = auth.uid() AND re.referee_id = p.id
  ) e ON true
  WHERE p.referred_by = auth.uid()
  ORDER BY p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_my_referral_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'valid', COUNT(*) FILTER (WHERE r.has_deposited),
    'pending', COUNT(*) FILTER (WHERE NOT r.has_deposited),
    'deposits', COALESCE(SUM(r.deposit_total), 0),
    'earnings', COALESCE(SUM(r.bonus_earned), 0)
  )
  FROM public.get_my_referrals() r;
$$;

CREATE OR REPLACE FUNCTION public.get_my_referrer()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'name', public.mask_identity(rp.full_name, rp.phone),
    'code', rp.referral_code
  )
  FROM public.profiles me
  JOIN public.profiles rp ON rp.id = me.referred_by
  WHERE me.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_referrals() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_referral_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_referrer() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mask_identity(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referrals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referrer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mask_identity(text, text) TO authenticated;

-- 5. Notify the referrer when someone registers with their code (private, only them)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref_code text;
  ref_user uuid;
  new_name text;
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

  IF ref_user IS NOT NULL THEN
    new_name := public.mask_identity(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
    PERFORM public.notify_user(
      ref_user,
      'referral',
      'Someone used your referral link! 🎉',
      new_name || ' has joined through your referral link. To start earning from this referral, ask them to make a deposit on their account to make the referral valid.',
      '/referrals',
      NULL,
      'ref-signup-' || NEW.id::text,
      jsonb_build_object('referee_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END $function$;

-- 6. Referral bonus: keep existing rule, add duplicate safety + "valid" notification
CREATE OR REPLACE FUNCTION public.credit_referral_on_recharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref_user uuid;
  bonus numeric;
  inserted boolean := false;
  prior integer;
  who text;
BEGIN
  IF NEW.type = 'recharge' AND NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT referred_by INTO ref_user FROM public.profiles WHERE id = NEW.user_id;
    IF ref_user IS NOT NULL THEN
      bonus := NEW.amount * 0.20;
      INSERT INTO public.referral_earnings (referrer_id, referee_id, source_transaction_id, tier, amount)
      VALUES (ref_user, NEW.user_id, NEW.id, 1, bonus)
      ON CONFLICT (source_transaction_id) DO NOTHING;
      GET DIAGNOSTICS prior = ROW_COUNT;
      inserted := prior > 0;

      IF inserted THEN
        UPDATE public.wallets SET referral_bonus = referral_bonus + bonus WHERE user_id = ref_user;
        INSERT INTO public.transactions (user_id, type, amount, status, meta)
        VALUES (ref_user, 'referral', bonus, 'approved', jsonb_build_object('from', NEW.user_id, 'tier', 1, 'source_tx', NEW.id));

        SELECT COUNT(*) INTO prior
        FROM public.transactions t
        WHERE t.user_id = NEW.user_id AND t.type = 'recharge' AND t.status = 'approved' AND t.id <> NEW.id;

        IF prior = 0 THEN
          SELECT public.mask_identity(p.full_name, p.phone) INTO who FROM public.profiles p WHERE p.id = NEW.user_id;
          PERFORM public.notify_user(
            ref_user,
            'referral',
            'Your referral is now valid ✅',
            COALESCE(who, 'Your referral') || ' has made their first deposit. Your referral bonus has been credited to your wallet.',
            '/referrals',
            NULL,
            'ref-valid-' || NEW.user_id::text,
            jsonb_build_object('referee_id', NEW.user_id)
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
