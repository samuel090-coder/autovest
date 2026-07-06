
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.payment_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  screenshot_url text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_complaints TO authenticated;
GRANT ALL ON public.payment_complaints TO service_role;

ALTER TABLE public.payment_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own complaints" ON public.payment_complaints
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own complaints" ON public.payment_complaints
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update complaints" ON public.payment_complaints
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_complaints_updated
  BEFORE UPDATE ON public.payment_complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users upload own complaint proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'complaint-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own complaint proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'complaint-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
