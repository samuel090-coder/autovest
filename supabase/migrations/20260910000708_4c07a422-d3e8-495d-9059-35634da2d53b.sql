
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text,text,text,text,jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_profile_created() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_transaction() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_user_investment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_wallet_ledger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_referral_earning() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_offer_claim() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_complaint() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_install() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_free_cash() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;
