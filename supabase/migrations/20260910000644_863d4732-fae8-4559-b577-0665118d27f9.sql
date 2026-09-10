
-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  image_url text,
  icon_url text,
  url text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  broadcast_id uuid,
  read_at timestamptz,
  push_state text NOT NULL DEFAULT 'pending',
  push_attempts int NOT NULL DEFAULT 0,
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_uidx ON public.notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_push_idx ON public.notifications(push_state, created_at) WHERE push_state IN ('pending','retry');

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notifications read" ON public.notifications;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "own notifications delete" ON public.notifications;
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_id text,
  user_agent text,
  is_pwa boolean NOT NULL DEFAULT false,
  failure_count int NOT NULL DEFAULT 0,
  disabled_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id) WHERE disabled_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own push subs" ON public.push_subscriptions;
CREATE POLICY "own push subs" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  image_url text,
  url text,
  action_label text,
  audience text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients int NOT NULL DEFAULT 0,
  delivered int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_broadcasts TO authenticated;
GRANT ALL ON public.notification_broadcasts TO service_role;
ALTER TABLE public.notification_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage broadcasts" ON public.notification_broadcasts;
CREATE POLICY "admins manage broadcasts" ON public.notification_broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ HELPER ============
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _category text, _title text, _body text,
  _url text DEFAULT NULL, _image_url text DEFAULT NULL, _dedupe_key text DEFAULT NULL,
  _data jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(user_id, category, title, body, url, image_url, dedupe_key, data)
  VALUES (_user_id, _category, _title, coalesce(_body,''), _url, _image_url, _dedupe_key, coalesce(_data,'{}'::jsonb))
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(_ids uuid[] DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.notifications SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL AND (_ids IS NULL OR id = ANY(_ids));
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END; $$;

-- ============ EVENT TRIGGERS ============
CREATE OR REPLACE FUNCTION public.tg_notify_profile_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_user(NEW.id, 'account', 'Welcome to AutoVest 🎉',
    'Your account is ready. Claim your ₦500 welcome bonus and start earning today.',
    '/', NULL, 'welcome:'||NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_profile_created ON public.profiles;
CREATE TRIGGER notify_profile_created AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_profile_created();

CREATE OR REPLACE FUNCTION public.tg_notify_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE amt text := '₦'||to_char(NEW.amount, 'FM999,999,999,990');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'recharge' THEN
      PERFORM public.notify_user(NEW.user_id,'deposit','Deposit submitted',
        'We received your deposit request of '||amt||'. It will be credited once confirmed.',
        '/wallet',NULL,'tx-new:'||NEW.id);
    ELSIF NEW.type = 'withdraw' THEN
      PERFORM public.notify_user(NEW.user_id,'withdrawal','Withdrawal request submitted',
        'Your withdrawal of '||amt||' is being processed. You will be notified once approved.',
        '/withdraw',NULL,'tx-new:'||NEW.id);
    ELSIF NEW.type = 'invest' THEN
      PERFORM public.notify_user(NEW.user_id,'investment','Investment created',
        'Your investment of '||amt||' is now active and earning.',
        '/orders',NULL,'tx-new:'||NEW.id);
    ELSIF NEW.type = 'referral' THEN
      PERFORM public.notify_user(NEW.user_id,'referral','Referral commission received',
        'You earned '||amt||' from your team.','/team',NULL,'tx-new:'||NEW.id);
    ELSIF NEW.type IN ('bonus','free_cash','lottery_claim','claim','income') THEN
      PERFORM public.notify_user(NEW.user_id,'reward','Reward credited',
        amt||' has been added to your account.','/wallet',NULL,'tx-new:'||NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      IF NEW.type = 'withdraw' THEN
        PERFORM public.notify_user(NEW.user_id,'withdrawal','Withdrawal approved ✅',
          'Your withdrawal of '||amt||' has been credited to your bank account. Kindly check your bank.',
          '/withdraw',NULL,'tx-approved:'||NEW.id);
      ELSIF NEW.type = 'recharge' THEN
        PERFORM public.notify_user(NEW.user_id,'deposit','Deposit approved ✅',
          amt||' has been credited to your balance. Happy investing!',
          '/wallet',NULL,'tx-approved:'||NEW.id);
      ELSE
        PERFORM public.notify_user(NEW.user_id,'account','Request approved',
          'Your request of '||amt||' was approved.','/wallet',NULL,'tx-approved:'||NEW.id);
      END IF;
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.notify_user(NEW.user_id,'account','Request declined',
        'Your '||NEW.type||' request of '||amt||' was declined. Please contact support or try again.',
        '/wallet',NULL,'tx-rejected:'||NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_transaction_ins ON public.transactions;
CREATE TRIGGER notify_transaction_ins AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_transaction();
DROP TRIGGER IF EXISTS notify_transaction_upd ON public.transactions;
CREATE TRIGGER notify_transaction_upd AFTER UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_transaction();

CREATE OR REPLACE FUNCTION public.tg_notify_user_investment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv_name text; inv_img text;
BEGIN
  SELECT name, image_url INTO inv_name, inv_img FROM public.investments WHERE id = NEW.investment_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.user_id,'investment','Investment activated 🚀',
      coalesce(inv_name,'Your investment')||' is running. Track your live earnings on the Orders page.',
      '/orders', inv_img, 'uinv-new:'||NEW.id);
    RETURN NEW;
  END IF;
  IF NEW.round IS DISTINCT FROM OLD.round THEN
    PERFORM public.notify_user(NEW.user_id,'investment','Round '||NEW.round||' started',
      coalesce(inv_name,'Your investment')||' has started a new earning round.',
      '/orders', inv_img, 'uinv-round:'||NEW.id||':'||NEW.round);
  END IF;
  IF NEW.claimed_at IS NOT NULL AND OLD.claimed_at IS NULL THEN
    PERFORM public.notify_user(NEW.user_id,'investment','Investment completed 🎉',
      'Your payout from '||coalesce(inv_name,'your investment')||' has been credited to your balance.',
      '/wallet', inv_img, 'uinv-claim:'||NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_uinv_ins ON public.user_investments;
CREATE TRIGGER notify_uinv_ins AFTER INSERT ON public.user_investments
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_user_investment();
DROP TRIGGER IF EXISTS notify_uinv_upd ON public.user_investments;
CREATE TRIGGER notify_uinv_upd AFTER UPDATE ON public.user_investments
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_user_investment();

CREATE OR REPLACE FUNCTION public.tg_notify_wallet_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE amt text;
BEGIN
  IF NEW.delta IS NULL OR NEW.delta = 0 THEN RETURN NEW; END IF;
  amt := '₦'||to_char(abs(NEW.delta), 'FM999,999,999,990');
  IF NEW.delta > 0 THEN
    PERFORM public.notify_user(NEW.user_id,'wallet','Wallet credited',
      amt||' was added to your '||replace(NEW.field,'_',' ')||'. New balance: ₦'||to_char(NEW.new_value,'FM999,999,999,990')||'.',
      '/wallet',NULL,'ledger:'||NEW.id);
  ELSE
    PERFORM public.notify_user(NEW.user_id,'wallet','Wallet debited',
      amt||' was deducted from your '||replace(NEW.field,'_',' ')||'. New balance: ₦'||to_char(NEW.new_value,'FM999,999,999,990')||'.',
      '/wallet',NULL,'ledger:'||NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_wallet_ledger ON public.wallet_ledger;
CREATE TRIGGER notify_wallet_ledger AFTER INSERT ON public.wallet_ledger
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_wallet_ledger();

CREATE OR REPLACE FUNCTION public.tg_notify_referral_earning()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_user(NEW.referrer_id,'referral','Referral bonus received 💰',
    'You earned ₦'||to_char(NEW.amount,'FM999,999,999,990')||' from a level '||NEW.tier||' team member.',
    '/team',NULL,'ref:'||NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_referral_earning ON public.referral_earnings;
CREATE TRIGGER notify_referral_earning AFTER INSERT ON public.referral_earnings
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_referral_earning();

CREATE OR REPLACE FUNCTION public.tg_notify_offer_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_user(NEW.user_id,'reward','Offer reward credited 🎁',
    '₦'||to_char(NEW.amount,'FM999,999,999,990')||' offer reward has been credited to your real balance.',
    '/earn-more',NULL,'offer:'||NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_offer_claim ON public.offer_claims;
CREATE TRIGGER notify_offer_claim AFTER INSERT ON public.offer_claims
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_offer_claim();

CREATE OR REPLACE FUNCTION public.tg_notify_complaint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.user_id,'support','Support update',
      'Your payment complaint is now '||NEW.status||coalesce('. Note: '||NEW.admin_note,'')||'.',
      '/recharge',NULL,'complaint:'||NEW.id||':'||NEW.status);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_complaint ON public.payment_complaints;
CREATE TRIGGER notify_complaint AFTER UPDATE ON public.payment_complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_complaint();

CREATE OR REPLACE FUNCTION public.tg_notify_install()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_user(NEW.user_id,'reward','App install bonus 🎁',
    '₦'||to_char(NEW.reward_amount,'FM999,999,990')||' has been credited for installing the AutoVest app.',
    '/wallet',NULL,'install:'||NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_install ON public.app_installs;
CREATE TRIGGER notify_install AFTER INSERT ON public.app_installs
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_install();

CREATE OR REPLACE FUNCTION public.tg_notify_free_cash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_user(NEW.user_id,'reward','Free cash claimed',
    '₦'||to_char(NEW.amount,'FM999,999,990')||' free cash added to your balance.',
    '/free-cash',NULL,'freecash:'||NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_free_cash ON public.free_cash_redemptions;
CREATE TRIGGER notify_free_cash AFTER INSERT ON public.free_cash_redemptions
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_free_cash();
