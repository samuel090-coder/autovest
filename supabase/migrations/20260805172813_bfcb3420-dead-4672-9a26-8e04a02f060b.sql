ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS welcome_bonus_claimed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_welcome_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  amt numeric := 500;
  already boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT welcome_bonus_claimed INTO already FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF already IS NULL THEN RAISE EXCEPTION 'No wallet'; END IF;
  IF already THEN RAISE EXCEPTION 'Welcome bonus already claimed'; END IF;
  UPDATE public.wallets
    SET welcome_bonus_claimed = true,
        balance = balance + amt,
        updated_at = now()
    WHERE user_id = uid;
  INSERT INTO public.transactions (user_id, type, amount, status, meta)
    VALUES (uid, 'bonus', amt, 'approved', jsonb_build_object('kind', 'welcome_bonus'));
  RETURN jsonb_build_object('ok', true, 'amount', amt);
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_bonus(_amount numeric, _bank_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  ba public.bank_accounts;
  active_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter an amount'; END IF;

  SELECT COUNT(*) INTO active_count
  FROM public.user_investments
  WHERE user_id = uid AND claimed_at IS NULL AND price_paid > 0;
  IF active_count = 0 THEN
    RAISE EXCEPTION 'You need an active investment before withdrawing reward money';
  END IF;

  SELECT * INTO ba FROM public.bank_accounts WHERE id = _bank_account_id AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bind your bank first'; END IF;

  SELECT bonus_balance INTO bal FROM public.wallets WHERE user_id = uid FOR UPDATE;
  IF bal IS NULL OR bal < _amount THEN RAISE EXCEPTION 'Insufficient reward balance'; END IF;

  UPDATE public.wallets SET bonus_balance = bonus_balance - _amount, updated_at = now() WHERE user_id = uid;

  INSERT INTO public.transactions (user_id, type, amount, status, meta)
  VALUES (uid, 'withdraw', _amount, 'pending', jsonb_build_object(
    'source', 'bonus',
    'bank_account_id', ba.id,
    'holder_name', ba.holder_name,
    'bank_name', ba.bank_name,
    'account_number', ba.account_number
  ));

  RETURN jsonb_build_object('ok', true, 'amount', _amount);
END $$;

CREATE OR REPLACE FUNCTION public.refund_on_withdraw_reject()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'withdraw' AND NEW.status = 'rejected'
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'rejected') THEN
    IF COALESCE(NEW.meta->>'source', '') = 'bonus' THEN
      UPDATE public.wallets SET bonus_balance = bonus_balance + NEW.amount WHERE user_id = NEW.user_id;
    ELSE
      UPDATE public.wallets SET balance = balance + NEW.amount WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  IF NEW.type = 'withdraw' AND NEW.status = 'approved'
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.wallets SET total_withdrawals = total_withdrawals + NEW.amount WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;