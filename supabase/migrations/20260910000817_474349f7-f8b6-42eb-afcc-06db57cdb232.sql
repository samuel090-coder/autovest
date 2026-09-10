
CREATE OR REPLACE FUNCTION public.audience_user_ids(_audience text)
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p
  WHERE CASE _audience
    WHEN 'all' THEN true
    WHEN 'active_investors' THEN EXISTS (SELECT 1 FROM public.user_investments ui WHERE ui.user_id=p.id AND ui.claimed_at IS NULL)
    WHEN 'completed_investments' THEN EXISTS (SELECT 1 FROM public.user_investments ui WHERE ui.user_id=p.id AND ui.claimed_at IS NOT NULL)
    WHEN 'no_investment' THEN NOT EXISTS (SELECT 1 FROM public.user_investments ui WHERE ui.user_id=p.id)
    WHEN 'inactive' THEN NOT EXISTS (SELECT 1 FROM public.user_activity a WHERE a.user_id=p.id AND a.created_at > now() - interval '7 days')
    WHEN 'with_balance' THEN EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id=p.id AND w.balance > 0)
    WHEN 'pending_deposits' THEN EXISTS (SELECT 1 FROM public.transactions t WHERE t.user_id=p.id AND t.type='recharge' AND t.status='pending')
    ELSE false END;
$$;
REVOKE EXECUTE ON FUNCTION public.audience_user_ids(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.audience_user_ids(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_send_broadcast(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.notification_broadcasts; n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO b FROM public.notification_broadcasts WHERE id = _id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'broadcast not found'; END IF;
  IF b.status = 'sent' THEN RETURN jsonb_build_object('ok', false, 'error', 'already sent'); END IF;

  INSERT INTO public.notifications(user_id, category, title, body, image_url, url, dedupe_key, broadcast_id, data)
  SELECT a.user_id, 'announcement', b.title, b.body, b.image_url, b.url, 'bc:'||b.id, b.id,
         jsonb_build_object('action_label', b.action_label)
  FROM public.audience_user_ids(b.audience) a
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.notification_broadcasts SET status='sent', sent_at=now(), recipients=n WHERE id=_id;
  RETURN jsonb_build_object('ok', true, 'recipients', n);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_send_broadcast(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_scheduled_broadcasts()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0; c int;
BEGIN
  FOR r IN SELECT * FROM public.notification_broadcasts
           WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now() LOOP
    INSERT INTO public.notifications(user_id, category, title, body, image_url, url, dedupe_key, broadcast_id, data)
    SELECT a.user_id, 'announcement', r.title, r.body, r.image_url, r.url, 'bc:'||r.id, r.id,
           jsonb_build_object('action_label', r.action_label)
    FROM public.audience_user_ids(r.audience) a
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS c = ROW_COUNT;
    UPDATE public.notification_broadcasts SET status='sent', sent_at=now(), recipients=c WHERE id=r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.run_scheduled_broadcasts() FROM anon, authenticated, public;

-- Event-driven push delivery: ping the dispatcher the moment a notification is created.
CREATE OR REPLACE FUNCTION public.tg_dispatch_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--f3614010-968d-4a48-8e02-7b152c419317.lovable.app/api/public/hooks/push-dispatch',
    headers := jsonb_build_object('Content-Type','application/json','x-dispatch-secret','7COzYjWdy3xzTWSLTzH9soyYYtjm1C2b'),
    body := jsonb_build_object('id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_dispatch_push() FROM anon, authenticated, public;
DROP TRIGGER IF EXISTS dispatch_push ON public.notifications;
CREATE TRIGGER dispatch_push AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.tg_dispatch_push();

-- Hourly backstop: send due scheduled announcements and retry failed deliveries.
CREATE OR REPLACE FUNCTION public.notifications_hourly_maintenance()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.run_scheduled_broadcasts();
  IF EXISTS (SELECT 1 FROM public.notifications WHERE push_state IN ('pending','retry') AND push_attempts < 5) THEN
    PERFORM net.http_post(
      url := 'https://project--f3614010-968d-4a48-8e02-7b152c419317.lovable.app/api/public/hooks/push-dispatch',
      headers := jsonb_build_object('Content-Type','application/json','x-dispatch-secret','7COzYjWdy3xzTWSLTzH9soyYYtjm1C2b'),
      body := '{}'::jsonb);
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notifications_hourly_maintenance() FROM anon, authenticated, public;

SELECT cron.schedule('notif-hourly-maintenance', '0 * * * *', $$SELECT public.notifications_hourly_maintenance();$$)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='notif-hourly-maintenance');
