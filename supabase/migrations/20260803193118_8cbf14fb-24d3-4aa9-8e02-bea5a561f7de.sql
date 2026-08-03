CREATE OR REPLACE FUNCTION public.issue_payment_token(_tx_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tk text;
  t public.transactions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO t FROM public.transactions WHERE id = _tx_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF t.status <> 'pending' THEN RAISE EXCEPTION 'Only pending payments can be approved'; END IF;
  tk := COALESCE(t.meta->>'payment_token', upper(substr(md5(random()::text || _tx_id::text), 1, 8)));
  UPDATE public.transactions
    SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('payment_token', tk, 'token_state', 'issued')
    WHERE id = _tx_id;
  RETURN tk;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_payment_token(_tx_id uuid, _token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.transactions;
BEGIN
  SELECT * INTO t FROM public.transactions WHERE id = _tx_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment request not found'; END IF;
  IF t.status = 'approved' THEN RAISE EXCEPTION 'This payment is already confirmed'; END IF;
  IF t.status = 'rejected' THEN RAISE EXCEPTION 'This payment was rejected. Please make a new payment.'; END IF;
  IF COALESCE(t.meta->>'payment_token', '') = '' THEN RAISE EXCEPTION 'No token issued yet. Contact support on Telegram.'; END IF;
  IF upper(trim(_token)) <> upper(t.meta->>'payment_token') THEN RAISE EXCEPTION 'Invalid payment token'; END IF;
  UPDATE public.transactions
    SET status = 'approved',
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('token_state', 'redeemed')
    WHERE id = _tx_id;
  RETURN jsonb_build_object('ok', true, 'amount', t.amount);
END $$;

GRANT EXECUTE ON FUNCTION public.issue_payment_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_payment_token(uuid, text) TO authenticated;