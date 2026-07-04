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


  const { data: appDl } = useQuery({
    queryKey: ["app-download"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "app_download").maybeSingle();
      return (data?.value as { url?: string; version?: string } | null) ?? null;
    },
  });

  const { data: banners = [] } = useQuery({
    queryKey: ["auth-banners"],
    queryFn: async () =>
      (await supabase.from("banners").select("key,title,subtitle,image_url,link").eq("is_active", true)
        .in("key", ["login_register", "login_app_download", "login_support"])).data ?? [],
  });
  const registerBanner = banners.find((b) => b.key === "login_register");
  const appBanner = banners.find((b) => b.key === "login_app_download");
  const supportBanner = banners.find((b) => b.key === "login_support");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const r = p.get("ref");
    if (r) { setRegRef(r); setTab("register"); }
  }, []);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    // 1) If admin configured an APK URL, download it in-page (no navigation)
    const apkUrl = appDl?.url?.trim();
    if (apkUrl) {
      try {
        toast.info("Downloading app…");
        const res = await fetch(apkUrl, { mode: "cors" });
        if (!res.ok) throw new Error("download failed");
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = `InvestPro${appDl?.version ? "-" + appDl.version : ""}.apk`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
        toast.success("Download started");
        return;
      } catch {
        // CORS or network blocked direct fetch → fall back to a forced-download link
        const a = document.createElement("a");
        a.href = apkUrl;
        a.download = `InvestPro${appDl?.version ? "-" + appDl.version : ""}.apk`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
    }
    // 2) Otherwise fall back to native PWA install prompt
    if (!deferredPrompt) { toast.info("Tap browser menu → 'Add to Home Screen'"); return; }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") toast.success("App installed!");
    setDeferredPrompt(null);
  }

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
    email: phoneEmail(phone),   // ← ALWAYS use phone-based email
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { full_name: regName, phone, email: regEmail, referral_code: regRef },
    },
  });
  setLoading(false);
  if (error) return toast.error(error.message);
  toast.success("Account created");
  navigate({ to: "/" });
}

  return (
    <div className="min-h-screen bg-red-600 px-4 py-6 space-y-4">
      {/* Top register banner (admin-uploadable: login_register) */}
      {registerBanner?.image_url ? (
        <a
          href={registerBanner.link || "#"}
          onClick={(e) => { if (!registerBanner.link) { e.preventDefault(); setTab("register"); } }}
          className="block overflow-hidden rounded-2xl shadow-lg"
        >
          <img
            src={registerBanner.image_url}
            alt={registerBanner.title ?? "Register now"}
            className="h-auto w-full object-cover"
          />
        </a>
      ) : null}

      {/* Login card */}
      <div className="rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="mb-5 text-center text-2xl font-extrabold tracking-wider">
          {tab === "login" ? "LOG IN" : "REGISTER"}
        </h2>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex h-12 items-center gap-3 rounded-xl bg-gray-100 px-4">
              <Phone className="h-5 w-5 shrink-0 text-red-500" />
              <span className="shrink-0 text-foreground/70">+234</span>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                inputMode="tel"
                required
                className="h-full flex-1 border-0 bg-transparent px-0 text-base focus-visible:ring-0"
              />
            </div>
            <div className="flex h-12 items-center gap-3 rounded-xl bg-gray-100 px-4">
              <Lock className="h-5 w-5 shrink-0 text-red-500" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="h-full flex-1 border-0 bg-transparent px-0 text-base focus-visible:ring-0"
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

      {/* App download card — background image is admin-uploadable via banner key `login_app_download` */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 shadow-lg"
        style={
          appBanner?.image_url
            ? { backgroundImage: `url(${appBanner.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg,#1e40af,#2563eb)" }
        }
      >
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="max-w-[60%] text-white">
            <p className="text-base font-semibold leading-snug drop-shadow">
              {appBanner?.title ?? "Download App and contact customer service for free cash!"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-amber-200 to-amber-400 px-5 py-2 text-sm font-bold text-amber-900 shadow-md active:scale-95"
          >
            <Download className="h-4 w-4" /> APP Download
          </button>
        </div>
      </div>

      {/* Support card — background image is admin-uploadable via banner key `login_support` */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 shadow-lg"
        style={
          supportBanner?.image_url
            ? { backgroundImage: `url(${supportBanner.image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(135deg,#facc15,#f59e0b)" }
        }
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative space-y-3">
          <div className="inline-block rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow">
            {supportBanner?.title ?? "Contact for support and free cash"}
          </div>
          <div className="space-y-2">
            <SocialLink href="https://t.me/autovast" bg="bg-sky-500">Telegram Channel</SocialLink>
            <SocialLink href="https://wa.me/2348000000000" bg="bg-emerald-500">WhatsApp Service</SocialLink>
            <SocialLink href="https://www.facebook.com/" bg="bg-blue-600">Facebook Community</SocialLink>
            <SocialLink href="https://www.instagram.com/" bg="bg-pink-500">Instagram</SocialLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialLink({ href, bg, children }: { href: string; bg: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center gap-2 rounded-full ${bg} px-4 py-2.5 text-sm font-semibold text-white shadow active:scale-[.98]`}
    >
      {children}
    </a>
  );
}

