
CREATE OR REPLACE FUNCTION public.start_next_round(_uinv_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ui public.user_investments;
  max_r integer;
  end_at timestamptz;
BEGIN
  SELECT * INTO ui FROM public.user_investments WHERE id = _uinv_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF ui.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Already claimed'; END IF;
  end_at := ui.purchased_at + (ui.cycle_days || ' days')::interval;
  IF now() < end_at THEN RAISE EXCEPTION 'Round not complete yet'; END IF;
  SELECT max_rounds INTO max_r FROM public.investments WHERE id = ui.investment_id;
  IF ui.round >= max_r THEN RAISE EXCEPTION 'Max rounds reached'; END IF;
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
  end_at timestamptz;
BEGIN
  SELECT * INTO ui FROM public.user_investments WHERE id = _uinv_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF ui.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Already claimed'; END IF;
  SELECT max_rounds INTO max_r FROM public.investments WHERE id = ui.investment_id;
  IF ui.round < max_r THEN RAISE EXCEPTION 'Finish remaining rounds first'; END IF;
  end_at := ui.purchased_at + (ui.cycle_days || ' days')::interval;
  IF now() < end_at THEN RAISE EXCEPTION 'Final round not complete yet'; END IF;
  payout := ui.total_income * ui.round;
  UPDATE public.user_investments SET claimed_at = now(), status = 'claimed', completed_at = now() WHERE id = _uinv_id;
  UPDATE public.wallets SET balance = balance + payout, cumulative_income = cumulative_income + payout WHERE user_id = ui.user_id;
  INSERT INTO public.transactions (user_id, type, amount, status, meta)
  VALUES (ui.user_id, 'claim', payout, 'approved', jsonb_build_object('investment_id', ui.investment_id, 'rounds', ui.round));
  RETURN jsonb_build_object('ok', true, 'payout', payout);
END $$;

-- Allow users to refund a rejected withdrawal: trigger refunds balance on reject
CREATE OR REPLACE FUNCTION public.refund_on_withdraw_reject()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'withdraw' AND NEW.status = 'rejected'
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.wallets SET balance = balance + NEW.amount WHERE user_id = NEW.user_id;
  END IF;
  IF NEW.type = 'withdraw' AND NEW.status = 'approved'
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.wallets SET total_withdrawals = total_withdrawals + NEW.amount WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tx_withdraw_refund ON public.transactions;
CREATE TRIGGER tx_withdraw_refund AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.refund_on_withdraw_reject();

GRANT EXECUTE ON FUNCTION public.claim_investment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_next_round(uuid) TO authenticated;
