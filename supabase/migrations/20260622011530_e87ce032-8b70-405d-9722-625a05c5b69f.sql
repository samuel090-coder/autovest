
-- Credit wallet when recharge gets approved
CREATE OR REPLACE FUNCTION public.credit_wallet_on_recharge_approve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'recharge' AND NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.wallets SET balance = balance + NEW.amount WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_credit_wallet_on_recharge ON public.transactions;
CREATE TRIGGER trg_credit_wallet_on_recharge
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.credit_wallet_on_recharge_approve();

-- Schedule AI proof generator every 30 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('generate-ai-proof');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'generate-ai-proof',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://project--f3614010-968d-4a48-8e02-7b152c419317.lovable.app/api/public/hooks/generate-proof',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
