import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { toast } from "sonner";
import { Download, Share2, X, Check, User, Landmark, CreditCard, Hash, Calendar, ArrowLeftRight, Award, ShieldCheck } from "lucide-react";

export type ReceiptTx = {
  id: string;
  amount: number | string;
  created_at: string;
  status: string;
  meta?: {
    holder_name?: string;
    bank_name?: string;
    account_number?: string;
    source?: string;
  } | null;
};

const STYLES = [
  { key: "brand", label: "Classic Red" },
  { key: "dark", label: "Premium" },
  { key: "mint", label: "Mint" },
] as const;
type StyleKey = (typeof STYLES)[number]["key"];

const STYLE_KEY = "receipt_style_v2";

function money(n: number | string) {
  return `₦${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function refOf(id: string) {
  return `AVT${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function txnId(id: string, d: Date) {
  const p = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const t = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  return `AVTX-${p}-${t}-${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

/** Deterministic pseudo-QR block so the receipt always renders offline. */
function QrBlock({ seed, color }: { seed: string; color: string }) {
  const n = 15;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const cells: boolean[] = [];
  let s = h >>> 0 || 12345;
  for (let i = 0; i < n * n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    cells.push((s >>> 16) % 100 < 48);
  }
  const finder = (r: number, c: number) =>
    (r < 4 && c < 4) || (r < 4 && c >= n - 4) || (r >= n - 4 && c < 4);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, width: 74, height: 74 }}>
      {cells.map((on, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        const f = finder(r, c);
        const filled = f ? (r % 3 !== 1 || c % 3 !== 1) && (r < 1 || c < 1 || r > n - 2 || c > n - 2 || (r % 3 === 1 && c % 3 === 1) ? true : (r + c) % 2 === 0) : on;
        return <span key={i} style={{ background: filled ? color : "transparent" }} />;
      })}
    </div>
  );
}

export function WithdrawalReceipt({ tx, onClose }: { tx: ReceiptTx; onClose: () => void }) {
  const [style, setStyle] = useState<StyleKey>(() => {
    if (typeof window === "undefined") return "brand";
    return ((window.localStorage.getItem(STYLE_KEY) as StyleKey) || "brand");
  });
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  function pick(s: StyleKey) {
    setStyle(s);
    try { window.localStorage.setItem(STYLE_KEY, s); } catch { /* ignore */ }
  }

  async function capture() {
    if (!cardRef.current) return null;
    return await toBlob(cardRef.current, { pixelRatio: 3, cacheBust: true });
  }

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${refOf(tx.id)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    try {
      setBusy(true);
      const blob = await capture();
      if (!blob) throw new Error("Could not render receipt");
      const file = new File([blob], `receipt-${refOf(tx.id)}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Payment receipt", text: `Withdrawal of ${money(tx.amount)} — AutoVest` });
      } else {
        download(blob);
        toast.success("Receipt saved — share it from your gallery");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    try {
      setBusy(true);
      const blob = await capture();
      if (!blob) throw new Error("Could not render receipt");
      download(blob);
      toast.success("Receipt downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const d = new Date(tx.created_at);
  const approved = tx.status === "approved";

  const skin =
    style === "dark"
      ? { head: "linear-gradient(160deg,#0b0f19,#1e293b)", body: "#0f172a", card: "#161f33", fg: "#f8fafc", sub: "#94a3b8", line: "rgba(255,255,255,0.08)", accent: "#f5c451", accentSoft: "rgba(245,196,81,0.14)" }
      : style === "mint"
        ? { head: "linear-gradient(160deg,#047857,#10b981)", body: "#f6fffb", card: "#ffffff", fg: "#06281f", sub: "#5b8a7d", line: "#dcf1e8", accent: "#059669", accentSoft: "rgba(5,150,105,0.10)" }
        : { head: "linear-gradient(160deg,#c8102e,#ef2137)", body: "#fff7f8", card: "#ffffff", fg: "#1b1b1f", sub: "#7b7b85", line: "#f3dfe2", accent: "#d81f36", accentSoft: "rgba(216,31,54,0.08)" };

  const rows: Array<[string, string, typeof User]> = [
    ["Recipient", tx.meta?.holder_name ?? "—", User],
    ["Bank", tx.meta?.bank_name ?? "—", Landmark],
    ["Account", tx.meta?.account_number ? `••••${String(tx.meta.account_number).slice(-4)}` : "—", CreditCard],
    ["Reference", refOf(tx.id), Hash],
    ["Date & Time", d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }), Calendar],
    ["Channel", tx.meta?.source === "bonus" ? "Reward balance" : "Main balance", ArrowLeftRight],
  ];

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm animate-[rc-up_320ms_cubic-bezier(0.22,1,0.36,1)] py-4">
        <div className="mb-2 flex items-center justify-between text-white">
          <span className="text-sm font-semibold">Transaction receipt</span>
          <button onClick={onClose} aria-label="Close receipt" className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={cardRef} style={{ background: skin.body, color: skin.fg }} className="overflow-hidden rounded-[26px] shadow-2xl">
          {/* header */}
          <div style={{ background: skin.head }} className="relative px-5 pb-14 pt-6 text-center text-white">
            <div className="flex items-center justify-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-lg font-black">A</span>
              <span className="text-2xl font-black tracking-wide">AUTOVEST</span>
            </div>
            <div className="mt-1 text-[11px] tracking-wide text-white/85">Smart Invest. Secure Future.</div>
            <ShieldCheck className="absolute right-5 top-6 h-12 w-12 text-white/10" />
          </div>

          {/* seal */}
          <div className="relative -mt-12 flex justify-center">
            <div style={{ background: skin.body }} className="grid h-24 w-24 place-items-center rounded-full">
              <div style={{ background: skin.accent }} className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg">
                <Check className="h-8 w-8" strokeWidth={3} />
              </div>
            </div>
          </div>

          <div className="px-5 pb-5">
            <div className="text-center">
              <div style={{ color: skin.accent }} className="text-xl font-black">
                {approved ? "Payment Successful!" : tx.status === "rejected" ? "Payment Rejected" : "Payment Processing"}
              </div>
              <div style={{ color: skin.sub }} className="mt-1 text-xs">
                {approved ? "Your transaction was completed successfully." : "We will update you once this is finalised."}
              </div>
            </div>

            {/* amount */}
            <div style={{ background: skin.card, borderColor: skin.line }} className="mt-4 rounded-2xl border p-4 text-center">
              <div style={{ color: skin.sub }} className="text-[11px] font-semibold uppercase tracking-[0.18em]">Amount sent</div>
              <div className="mt-1 text-[34px] font-black leading-none tracking-tight">{money(tx.amount)}</div>
              <div style={{ background: skin.accentSoft, color: skin.accent }} className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
                <ShieldCheck className="h-3.5 w-3.5" /> {approved ? "Transaction Completed" : "Pending confirmation"}
              </div>
            </div>

            {/* details */}
            <div style={{ background: skin.card, borderColor: skin.line }} className="mt-3 rounded-2xl border px-4">
              {rows.map(([k, v, Icon]) => (
                <div key={k} style={{ borderColor: skin.line }} className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
                  <span className="flex items-center gap-2">
                    <span style={{ background: skin.accentSoft, color: skin.accent }} className="grid h-7 w-7 place-items-center rounded-lg">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span style={{ color: skin.sub }} className="text-[12px]">{k}</span>
                  </span>
                  <span className="max-w-[58%] break-words text-right text-[12px] font-bold">{v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-2">
                  <span style={{ background: skin.accentSoft, color: skin.accent }} className="grid h-7 w-7 place-items-center rounded-lg">
                    <Award className="h-3.5 w-3.5" />
                  </span>
                  <span style={{ color: skin.sub }} className="text-[12px]">Status</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  <Check className="h-3 w-3" /> {approved ? "Successful" : tx.status === "rejected" ? "Rejected" : "Processing"}
                </span>
              </div>
            </div>

            {/* note + stamp */}
            <div style={{ background: skin.accentSoft }} className="mt-3 flex items-center gap-3 rounded-2xl p-3">
              <ShieldCheck style={{ color: skin.accent }} className="h-6 w-6 shrink-0" />
              <p style={{ color: skin.sub }} className="text-[11px] leading-snug">
                This receipt is computer generated<br />and does not require a signature.
              </p>
              <div style={{ borderColor: skin.accent, color: skin.accent }} className="ml-auto grid h-16 w-16 shrink-0 -rotate-12 place-items-center rounded-full border-2 border-dashed text-center text-[7px] font-black leading-tight opacity-60">
                AUTOVEST<br /><span className="text-[9px]">VERIFIED</span><br />SECURE
              </div>
            </div>

            {/* footer */}
            <div style={{ borderColor: skin.line }} className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <div className="min-w-0">
                <div style={{ color: skin.sub }} className="text-[10px]">Transaction ID</div>
                <div className="text-[11px] font-bold break-all">{txnId(tx.id, d)}</div>
              </div>
              <div style={{ borderColor: skin.accent }} className="shrink-0 rounded-lg border-2 p-1">
                <QrBlock seed={tx.id} color={skin.accent} />
              </div>
              <div className="min-w-0 text-right">
                <div className="text-[11px] font-bold">Secure. Trusted.</div>
                <div style={{ color: skin.sub }} className="text-[10px] leading-tight">Thank you for choosing AutoVest.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5">
          {STYLES.map((s) => (
            <button
              key={s.key}
              onClick={() => pick(s.key)}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold ${style === s.key ? "bg-white text-black" : "bg-white/15 text-white"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <button onClick={save} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/15 py-3 text-sm font-bold text-white disabled:opacity-60">
            <Download className="h-4 w-4" /> Download
          </button>
          <button onClick={share} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-bold text-white disabled:opacity-60">
            <Share2 className="h-4 w-4" /> {busy ? "Preparing…" : "Share Receipt"}
          </button>
        </div>
      </div>

      <style>{`@keyframes rc-up { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
}
