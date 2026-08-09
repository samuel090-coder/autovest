import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatNaira } from "@/lib/format";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/users_/$id")({
  component: AdminUserDetail,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium break-all">{value ?? "—"}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <div className={`text-lg font-bold ${tone ?? ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function AdminUserDetail() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", id],
    queryFn: async () => {
      const [profile, wallet, roles, txs, invs, referrals, activity, banks, complaints, watches, lucky, ledger, installs, offerClaims] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("wallets").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id),
        supabase.from("transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
        supabase.from("user_investments").select("*, investments(name)").eq("user_id", id).order("purchased_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, phone, email, created_at").eq("referred_by", id).order("created_at", { ascending: false }),
        supabase.from("user_activity").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(200),
        supabase.from("bank_accounts").select("*").eq("user_id", id),
        supabase.from("payment_complaints").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabase.from("bonus_watches").select("id, reward_amount, watched_at").eq("user_id", id),
        supabase.from("lucky_draw_state").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("wallet_ledger").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(300),
        supabase.from("app_installs").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("offer_claims").select("*").eq("user_id", id),
      ]);
      const ips = Array.from(new Set((activity.data ?? []).map((a) => a.ip).filter(Boolean))) as string[];
      let sharedIps: Array<{ ip: string; user_id: string }> = [];
      if (ips.length) {
        const { data: others } = await supabase
          .from("user_activity")
          .select("ip, user_id")
          .in("ip", ips)
          .neq("user_id", id)
          .limit(500);
        const seen = new Set<string>();
        sharedIps = (others ?? []).filter((o) => {
          const k = `${o.ip}|${o.user_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }) as Array<{ ip: string; user_id: string }>;
      }

      const deviceIds = Array.from(new Set((activity.data ?? []).map((a) => a.device_id).filter(Boolean))) as string[];
      let sharedDevices: Array<{ device_id: string; user_id: string }> = [];
      if (deviceIds.length) {
        const { data: others } = await supabase
          .from("user_activity")
          .select("device_id, user_id")
          .in("device_id", deviceIds)
          .neq("user_id", id)
          .limit(500);
        const seen = new Set<string>();
        sharedDevices = (others ?? []).filter((o) => {
          const k = `${o.device_id}|${o.user_id}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }) as Array<{ device_id: string; user_id: string }>;
      }

      let inviter: any = null;
      if (profile.data?.referred_by) {
        const { data: inv } = await supabase.from("profiles").select("id, full_name, phone").eq("id", profile.data.referred_by).maybeSingle();
        inviter = inv as never;
      }
      return {
        profile: profile.data,
        wallet: wallet.data,
        roles: (roles.data ?? []).map((r) => r.role),
        txs: txs.data ?? [],
        invs: invs.data ?? [],
        referrals: referrals.data ?? [],
        activity: activity.data ?? [],
        banks: banks.data ?? [],
        complaints: complaints.data ?? [],
        watches: watches.data ?? [],
        lucky: lucky.data,
        ledger: ledger.data ?? [],
        install: installs.data,
        offerClaims: offerClaims.data ?? [],
        sharedIps,
        sharedDevices,
        inviter,
      };
    },
  });


  if (isLoading) return <Card className="p-6 text-sm text-muted-foreground">Loading user…</Card>;
  if (!data?.profile) return <Card className="p-6 text-sm">User not found.</Card>;

  const { profile, wallet, roles, txs, invs, referrals, activity, banks, complaints, watches, lucky, ledger, install, offerClaims, sharedIps, sharedDevices, inviter } = data;

  const reasonLabel = (r: string | null) => {
    const map: Record<string, string> = {
      app_install_bonus: "App install reward (₦100)",
      unspecified: "Direct / unlabelled change",
    };
    if (r?.startsWith("offer_")) return `Earn-more offer (${r.replace("offer_", "")})`;
    return map[r ?? "unspecified"] ?? r!.replace(/_/g, " ");
  };


  const sum = (type: string, status?: string) =>
    txs.filter((t: any) => t.type === type && (!status || t.status === status)).reduce((a: number, t: any) => a + Number(t.amount), 0);

  const withdrawals = txs.filter((t: any) => t.type === "withdraw");
  const lastSession = activity.find((a: any) => a.ip);
  const bonusesClaimed: string[] = [];
  if (wallet?.welcome_bonus_claimed) bonusesClaimed.push("Welcome ₦500");
  if (txs.some((t: any) => t.type === "free_cash")) bonusesClaimed.push("Free cash code");
  if (txs.some((t: any) => t.type === "lottery_claim")) bonusesClaimed.push("Lucky draw payout");
  if (watches.length) bonusesClaimed.push(`Watch & earn ×${watches.length}`);
  if (txs.some((t: any) => t.type === "referral")) bonusesClaimed.push("Referral commission");

  return (
    <div className="space-y-4">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-lg font-bold text-brand">
            {(profile.full_name ?? profile.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-bold">{profile.full_name || "Unnamed user"}</div>
            <div className="text-xs text-muted-foreground">{profile.email} · {profile.phone}</div>
          </div>
          <div className="ml-auto flex gap-1">
            {(roles.length ? roles : ["user"]).map((r) => (
              <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">{r}</span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Main balance" value={formatNaira(wallet?.balance ?? 0)} />
          <Stat label="Reward balance" value={formatNaira(wallet?.bonus_balance ?? 0)} />
          <Stat label="Cumulative income" value={formatNaira(wallet?.cumulative_income ?? 0)} tone="text-success" />
          <Stat label="Total withdrawn" value={formatNaira(wallet?.total_withdrawals ?? 0)} tone="text-brand" />
          <Stat label="Referrals" value={String(referrals.length)} />
          <Stat label="Referral bonus" value={formatNaira(wallet?.referral_bonus ?? 0)} />
          <Stat label="Total recharged" value={formatNaira(sum("recharge", "approved"))} />
          <Stat label="Active investments" value={String(invs.filter((i: any) => !i.claimed_at).length)} />
        </div>
      </Card>

      {sharedIps.length > 0 && (
        <Card className="border-warning/50 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" /> Possible multi-account: this user shares an IP with {new Set(sharedIps.map((s) => s.user_id)).size} other account(s)
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {sharedIps.slice(0, 20).map((s, i) => (
              <li key={i}>
                <span className="font-mono">{s.ip}</span> →{" "}
                <Link to="/admin/users/$id" params={{ id: s.user_id }} className="text-brand underline">{s.user_id}</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sharedDevices.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Same device as {new Set(sharedDevices.map((s) => s.user_id)).size} other account(s) — likely multi-accounting
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {sharedDevices.slice(0, 20).map((s, i) => (
              <li key={i}>
                <span className="font-mono">{s.device_id}</span> →{" "}
                <Link to="/admin/users/$id" params={{ id: s.user_id }} className="text-brand underline">{s.user_id}</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold">Money trail — every balance change ({ledger.length})</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Each row is an automatic audit record: what changed, from what to what, why, and who triggered it.
        </p>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes recorded yet — auditing starts from now, so any future credit to this account will be traced here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-1">When</th><th>Field</th><th>Change</th><th>From → To</th><th>Reason</th><th>Actor</th></tr>
              </thead>
              <tbody className="divide-y">
                {ledger.map((l: any) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap py-1.5 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="text-xs capitalize">{String(l.field).replace(/_/g, " ")}</td>
                    <td className={`font-semibold ${Number(l.delta) >= 0 ? "text-success" : "text-destructive"}`}>
                      {Number(l.delta) >= 0 ? "+" : ""}{formatNaira(l.delta)}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">{formatNaira(l.old_value)} → {formatNaira(l.new_value)}</td>
                    <td className="text-xs">{reasonLabel(l.reason)}</td>
                    <td className="font-mono text-[10px] text-muted-foreground">{l.actor === profile.id ? "self" : l.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>


      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Account & identity</h3>
          <Row label="Signed up" value={new Date(profile.created_at).toLocaleString()} />
          <Row label="User ID" value={<span className="font-mono text-xs">{profile.id}</span>} />
          <Row label="Phone" value={profile.phone} />
          <Row label="Email" value={profile.email} />
          <Row label="Referral code" value={profile.referral_code} />
          <Row
            label="Referred by"
            value={inviter ? <Link to="/admin/users/$id" params={{ id: inviter.id }} className="text-brand underline">{inviter.full_name || inviter.phone || inviter.id}</Link> : "Direct signup"}
          />
          <Row label="Last IP" value={<span className="font-mono text-xs">{lastSession?.ip ?? "not captured yet"}</span>} />
          <Row label="Location" value={[lastSession?.city, lastSession?.region, lastSession?.country].filter(Boolean).join(", ") || "—"} />
          <Row label="Device / browser" value={<span className="text-xs">{lastSession?.user_agent ?? "—"}</span>} />
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Bonuses claimed</h3>
          {bonusesClaimed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bonuses claimed.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {bonusesClaimed.map((b) => (
                <span key={b} className="rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success">{b}</span>
              ))}
            </div>
          )}
          <h3 className="mb-2 mt-4 text-sm font-semibold">Lucky draw</h3>
          <Row label="Spins used" value={lucky ? `${lucky.spins_used} / ${lucky.base_spins + lucky.bonus_spins}` : "—"} />
          <Row label="Lottery balance" value={lucky ? formatNaira(lucky.lottery_balance) : "—"} />
          <Row label="Total won" value={lucky ? formatNaira(lucky.total_won) : "—"} />
          <h3 className="mb-2 mt-4 text-sm font-semibold">Bank accounts ({banks.length})</h3>
          {banks.length === 0 ? <p className="text-sm text-muted-foreground">No bank bound.</p> : banks.map((b: any) => (
            <Row key={b.id} label={b.bank_name} value={`${b.holder_name} · ${b.account_number}`} />
          ))}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Withdrawals ({withdrawals.length})</h3>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Requested" value={formatNaira(withdrawals.reduce((a: number, t: any) => a + Number(t.amount), 0))} />
          <Stat label="Paid out" value={formatNaira(sum("withdraw", "approved"))} tone="text-success" />
          <Stat label="Pending" value={formatNaira(sum("withdraw", "pending"))} tone="text-warning" />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {withdrawals.slice(0, 20).map((t: any) => (
                <tr key={t.id}>
                  <td className="py-1.5">{formatNaira(t.amount)}</td>
                  <td className="capitalize">{t.status}</td>
                  <td className="text-xs text-muted-foreground">{t.meta?.source === "bonus" ? "reward balance" : "main balance"}</td>
                  <td className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Investments ({invs.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1">Plan</th><th>Paid</th><th>Round</th><th>Status</th><th>Purchased</th></tr></thead>
            <tbody className="divide-y">
              {invs.map((i: any) => (
                <tr key={i.id}>
                  <td className="py-1.5">{i.investments?.name ?? "—"}</td>
                  <td>{formatNaira(i.price_paid)}</td>
                  <td>{i.round}</td>
                  <td className="capitalize">{i.claimed_at ? "claimed" : i.status}</td>
                  <td className="text-xs text-muted-foreground">{new Date(i.purchased_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Referrals ({referrals.length})</h3>
        {referrals.length === 0 ? <p className="text-sm text-muted-foreground">No referrals yet.</p> : (
          <ul className="divide-y text-sm">
            {referrals.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between py-1.5">
                <Link to="/admin/users/$id" params={{ id: r.id }} className="text-brand underline">{r.full_name || r.phone || r.email}</Link>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Recent activity ({activity.length})</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet — tracking starts on this user's next visit.</p>
        ) : (
          <ul className="divide-y text-sm">
            {activity.map((a: any) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium capitalize">{a.event.replace(/_/g, " ")}</span>{" "}
                  <span className="font-mono text-xs">{a.path}</span> {a.label ? <span className="text-xs text-muted-foreground">· {a.label}</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">{a.ip ? `${a.ip} · ` : ""}{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Payment complaints ({complaints.length})</h3>
        {complaints.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="divide-y text-sm">
            {complaints.map((c: any) => (
              <li key={c.id} className="py-1.5">
                <div className="flex justify-between"><span className="font-medium">{formatNaira(c.amount)}</span><span className="text-xs capitalize text-muted-foreground">{c.status}</span></div>
                <p className="text-xs text-muted-foreground break-words">{c.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">All transactions ({txs.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {txs.map((t: any) => (
                <tr key={t.id}>
                  <td className="py-1.5 capitalize">{t.type}</td>
                  <td className="font-medium">{formatNaira(t.amount)}</td>
                  <td className="capitalize text-xs">{t.status}</td>
                  <td className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
