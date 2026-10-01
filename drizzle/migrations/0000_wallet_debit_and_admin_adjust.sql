-- Atomic investment purchase: debit + records in one transaction.
-- Fixes debits silently failing because users have no UPDATE policy on wallets.
CREATE OR REPLACE FUNCTION public.purchase_investment(_investment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inv record;
  _price numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _inv FROM investments WHERE id = _investment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment not found'; END IF;
  _price := coalesce(_inv.price, 0);

  IF _price = 0 AND EXISTS (
    SELECT 1 FROM user_investments WHERE user_id = _uid AND investment_id = _investment_id
  ) THEN
    RAISE EXCEPTION 'You have already claimed this free investment';
  END IF;

  IF _price > 0 THEN
    UPDATE wallets SET balance = balance - _price, updated_at = now()
    WHERE user_id = _uid AND balance >= _price;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance — please recharge'; END IF;
  END IF;

  INSERT INTO user_investments (user_id, investment_id, quantity, price_paid, daily_income, total_income, cycle_days)
  VALUES (_uid, _inv.id, 1, _price, _inv.daily_income, _inv.total_income, _inv.cycle_days);

  INSERT INTO transactions (user_id, type, amount, status, meta)
  VALUES (_uid, 'invest', _price, 'approved', jsonb_build_object('investment_id', _inv.id, 'name', _inv.name));

  RETURN jsonb_build_object('ok', true, 'price', _price, 'name', _inv.name, 'daily_income', _inv.daily_income);
END;
$$;

-- Self-service debit for withdrawals and similar flows.
CREATE OR REPLACE FUNCTION public.debit_wallet(_amount numeric, _reason text DEFAULT 'debit')
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _bal numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE wallets SET balance = balance - _amount, updated_at = now()
  WHERE user_id = _uid AND balance >= _amount
  RETURNING balance INTO _bal;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  RETURN _bal;
END;
$$;

-- Admin credit/debit of any wallet, with audit transaction + user notification.
-- _amount > 0 credits, _amount < 0 debits (never below zero).
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(_user_id uuid, _amount numeric, _reason text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bal numeric;
  _applied numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;

  UPDATE wallets
  SET balance = GREATEST(0, balance + _amount), updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO _bal;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;

  _applied := _amount;

  INSERT INTO transactions (user_id, type, amount, status, meta)
  VALUES (
    _user_id,
    'admin_adjustment',
    ABS(_applied),
    'approved',
    jsonb_build_object('direction', CASE WHEN _applied > 0 THEN 'credit' ELSE 'debit' END, 'reason', coalesce(_reason, 'Admin adjustment'), 'by', auth.uid())
  );

  PERFORM public.notify_user(
    _user_id,
    'wallet',
    CASE WHEN _applied > 0 THEN 'Money added to your wallet 💰' ELSE 'Money deducted from your wallet' END,
    format('%s %s has been %s your wallet. Reason: %s. New balance: ₦%s.',
      '₦', to_char(ABS(_applied), 'FM999,999,999,990'),
      CASE WHEN _applied > 0 THEN 'added to' ELSE 'deducted from' END,
      coalesce(_reason, 'Admin adjustment'),
      to_char(_bal, 'FM999,999,999,990')),
    '/wallet',
    NULL,
    'admin-adj-' || gen_random_uuid()::text,
    jsonb_build_object('delta', _applied, 'reason', coalesce(_reason, 'Admin adjustment'))
  );

  RETURN _bal;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_investment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.purchase_investment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_wallet(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;