import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Lock, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — InvestPro" },
      { name: "description", content: "Sign in or create your InvestPro account to start investing." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRef, setRegRef] = useState("");

  const { data: banners = [] } = useQuery({
    queryKey: ["login-banners"],
    queryFn: async () =>
      (await supabase
        .from("banners")
        .select("*")
        .in("key", ["login_register", "login_app_download", "login_support"])
        .eq("is_active", true)).data ?? [],
  });
  const byKey = (k: string) => banners.find((b: any) => b.key === k);
  const registerBanner = byKey("login_register");
  const appBanner = byKey("login_app_download");
  const supportBanner = byKey("login_support");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const r = p.get("ref");
    if (r) { setRegRef(r); setTab("register"); }
  }, []);

  // Phone+password → email synth using the phone as account identifier
  function phoneEmail(p: string) {
    return `${p.replace(/[^0-9]/g, "")}@investpro.local`;
  }
async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);

  // First try phone-based login
  let { error } = await supabase.auth.signInWithPassword({ 
    email: phoneEmail(phone), password 
  });

  // If that fails, look up their real email by phone number
  if (error) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("phone", phone.replace(/[^0-9]/g, ""))
      .maybeSingle();

    if (profile?.email) {
      const { error: error2 } = await supabase.auth.signInWithPassword({ 
        email: profile.email, password 
      });
      error = error2 ?? null;
    }
  }

  setLoading(false);
  if (error) return toast.error("Invalid phone number or password");
  toast.success("Welcome back");
  navigate({ to: "/" });
    }
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail || phoneEmail(phone),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: regName, phone, referral_code: regRef },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-red-600 px-4 py-4">
      {/* Register banner (admin-uploaded image only) */}
      {registerBanner?.image_url && (
        <a href={registerBanner.link ?? "#"} className="block overflow-hidden rounded-xl bg-white/10">
          <img src={registerBanner.image_url} alt={registerBanner.title ?? ""} className="h-32 w-full object-cover" />
        </a>
      )}

      {/* Login card */}
      <div className="mt-4 rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="mb-5 text-center text-2xl font-extrabold tracking-wider">
          {tab === "login" ? "LOG IN" : "REGISTER"}
        </h2>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3">
              <Phone className="h-5 w-5 text-red-500" />
              <span className="text-foreground/70">+234</span>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                inputMode="tel"
                required
                className="border-0 bg-transparent px-0 focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3">
              <Lock className="h-5 w-5 text-red-500" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="border-0 bg-transparent px-0 focus-visible:ring-0"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-red-600 text-base font-bold hover:bg-red-700">
              {loading ? "Signing in…" : "LOG IN"}
            </Button>
            <p className="pt-2 text-center text-sm text-muted-foreground">Don't have an account yet?</p>
            <Button type="button" variant="ghost" onClick={() => setTab("register")} className="mx-auto block rounded-full bg-blue-600 px-8 py-2 text-white hover:bg-blue-700 hover:text-white">
              Register →
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Full name" required className="h-12 rounded-xl bg-gray-100" />
            <div className="flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3">
              <span className="text-foreground/70">+234</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" required inputMode="tel" className="border-0 bg-transparent px-0 focus-visible:ring-0" />
            </div>
            <Input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} type="email" placeholder="Email (optional)" className="h-12 rounded-xl bg-gray-100" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password (min 6 chars)" minLength={6} required className="h-12 rounded-xl bg-gray-100" />
            <Input value={regRef} onChange={(e) => setRegRef(e.target.value)} placeholder="Referral code (optional)" className="h-12 rounded-xl bg-gray-100" />
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-red-600 text-base font-bold hover:bg-red-700">
              {loading ? "Creating…" : "Create account"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setTab("login")} className="w-full text-muted-foreground">
              ← Back to login
            </Button>
          </form>
        )}
      </div>

      {/* App download banner */}
      {appBanner?.image_url && (
        <a href={appBanner.link ?? "#"} className="mt-4 block overflow-hidden rounded-2xl">
          <img src={appBanner.image_url} alt={appBanner.title ?? "Download app"} className="w-full object-cover" />
        </a>
      )}
      {!appBanner?.image_url && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-blue-600 px-5 py-5 text-white">
          <div className="text-base font-semibold leading-tight">Download App and contact customer service for free cash!</div>
          <Button asChild className="ml-3 shrink-0 rounded-full bg-amber-300 text-black hover:bg-amber-400">
            <a href={appBanner?.link ?? "#"}><Download className="mr-1 h-4 w-4" /> APP Download</a>
          </Button>
        </div>
      )}

      {/* Support banner */}
      {supportBanner?.image_url && (
        <a href={supportBanner.link ?? "#"} className="mt-4 block overflow-hidden rounded-2xl">
          <img src={supportBanner.image_url} alt={supportBanner.title ?? "Support"} className="w-full object-cover" />
        </a>
      )}
    </div>
  );
}
