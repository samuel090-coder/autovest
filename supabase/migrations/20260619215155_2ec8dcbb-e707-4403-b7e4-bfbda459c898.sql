
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.investment_category AS ENUM ('welfare', 'product');
CREATE TYPE public.transaction_type AS ENUM ('recharge', 'withdraw', 'invest', 'income');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'approved', 'rejected');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  referral_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Admin can see all roles
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- WALLETS
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  cumulative_income NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_withdrawals NUMERIC(18,2) NOT NULL DEFAULT 0,
  team_size INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_select_own" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wallet_admin_all" ON public.wallets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- INVESTMENTS
CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  price NUMERIC(18,2) NOT NULL,
  cycle_days INT NOT NULL,
  daily_income NUMERIC(18,2) NOT NULL,
  total_income NUMERIC(18,2) NOT NULL,
  description TEXT,
  category public.investment_category NOT NULL DEFAULT 'product',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_hot BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.investments TO authenticated, anon;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_public_read" ON public.investments FOR SELECT TO authenticated, anon USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "inv_admin_write" ON public.investments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- USER INVESTMENTS
CREATE TABLE public.user_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  price_paid NUMERIC(18,2) NOT NULL,
  daily_income NUMERIC(18,2) NOT NULL,
  total_income NUMERIC(18,2) NOT NULL,
  cycle_days INT NOT NULL,
  collected_income NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_collected_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.user_investments TO authenticated;
GRANT ALL ON public.user_investments TO service_role;
ALTER TABLE public.user_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uinv_select_own" ON public.user_investments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "uinv_insert_own" ON public.user_investments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uinv_admin_all" ON public.user_investments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_select_own" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tx_insert_own" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx_admin_all" ON public.transactions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- BANNERS
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  image_url TEXT,
  title TEXT,
  subtitle TEXT,
  link TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO authenticated, anon;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners_public_read" ON public.banners FOR SELECT TO authenticated, anon USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "banners_admin_write" ON public.banners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SITE SETTINGS
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO authenticated, anon;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.site_settings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "settings_admin_write" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- HANDLE NEW USER: profile, wallet, role (admin if matches designated email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.wallets (user_id) VALUES (NEW.id);

  IF lower(NEW.email) = 'samuelsunday09066423764@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default banners
INSERT INTO public.banners (key, title, subtitle, sort_order) VALUES
  ('lucky_draw', 'LUCKY DRAW', 'Click here to enter the lottery tour', 1),
  ('welfare_hero', 'Welfare Product', 'VIP car', 2),
  ('support_badge', 'Customer Service', 'Support Center', 3);
