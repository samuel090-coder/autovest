ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS bonus_balance numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.lucky_claim()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st public.lucky_draw_state;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO st FROM public.lucky_draw_state WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No draw state'; END IF;
  IF st.lottery_balance < st.goal_amount THEN RAISE EXCEPTION 'Reach % to withdraw', st.goal_amount; END IF;
  UPDATE public.wallets SET bonus_balance = bonus_balance + st.lottery_balance WHERE user_id = uid;
  INSERT INTO public.transactions (user_id, type, amount, status, meta)
    VALUES (uid, 'lottery_claim', st.lottery_balance, 'approved', jsonb_build_object('won', st.total_won, 'credited_to', 'bonus_balance'));
  UPDATE public.lucky_draw_state SET claimed_at = now(), lottery_balance = 0 WHERE user_id = uid;
  RETURN jsonb_build_object('ok', true, 'credited', st.lottery_balance);
END $$;