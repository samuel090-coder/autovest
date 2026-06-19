import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

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

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regRef, setRegRef] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/" });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (regPass.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPass,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: regName, phone: regPhone, referral_code: regRef },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-brand-gradient px-5 pt-14 pb-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center gap-3 text-brand-foreground">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">InvestPro</h1>
            <p className="text-sm text-white/80">Grow your wealth daily</p>
          </div>
        </div>

        <Card className="p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="li-email">Email</Label>
                  <Input id="li-email" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="li-pass">Password</Label>
                  <Input id="li-pass" type="password" required value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Signing in…" : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-3 pt-2">
                <div>
                  <Label htmlFor="r-name">Full name</Label>
                  <Input id="r-name" required value={regName} onChange={(e) => setRegName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="r-phone">Phone</Label>
                  <Input id="r-phone" inputMode="tel" required value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="r-email">Email</Label>
                  <Input id="r-email" type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="r-pass">Password</Label>
                  <Input id="r-pass" type="password" required minLength={6} value={regPass} onChange={(e) => setRegPass(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="r-ref">Referral code (optional)</Label>
                  <Input id="r-ref" value={regRef} onChange={(e) => setRegRef(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="mt-6 text-center text-xs text-white/80">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
