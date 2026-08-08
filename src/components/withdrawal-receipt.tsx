import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { toast } from "sonner";
import { Download, Share2, X, CheckCircle2 } from "lucide-react";

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
  { key: "classic", label: "Classic" },
  { key: "dark", label: "Premium" },
  { key: "brand", label: "Bold" },
] as const;
type StyleKey = (typeof STYLES)[number]["key"];

const STYLE_KEY = "receipt_style";

function money(n: number | string) {
  return `₦${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function refOf(id: string) {
  return `AVT${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function WithdrawalReceipt({ tx, onClose }: { tx: ReceiptTx; onClose: () => void }) {
  const [style, setStyle] = useState<StyleKey>(() => {
    if (typeof window === "undefined") return "classic";
    return ((window.localStorage.getItem(STYLE_KEY) as StyleKey) || "classic");
  });
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  function pick(s: StyleKey) {
    setStyle(s);
    try { window.localStorage.setItem(STYLE_KEY, s); } catch { /* ignore */ }
  }

  async function capture() {
    if (!cardRef.current) return null;
    return await toBlob(cardRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#ffffff" });
  }

  async function share() {
    try {
      setBusy(true);
      const blob = await capture();
      if (!blob) throw new Error("Could not render receipt");
      const file = new File([blob], `receipt-${refOf(tx.id)}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Withdrawal receipt", text: `Withdrawal of ${money(tx.amount)} — AutoVest` });
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

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${refOf(tx.id)}.png`;
    a.click();
    URL.revokeObjectURL(url);
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
  const rows: Array<[string, string]> = [
    ["Amount", money(tx.amount)],
    ["Recipient", tx.meta?.holder_name ?? "—"],
    ["Bank", tx.meta?.bank_name ?? "—"],
    ["Account", tx.meta?.account_number ? `••••${String(tx.meta.account_number).slice(-4)}` : "—"],
    ["Reference", refOf(tx.id)],
    ["Date", d.toLocaleString()],
    ["Channel", tx.meta?.source === "bonus" ? "Reward balance" : "Main balance"],
    ["Status", approved ? "Successful" : tx.status === "rejected" ? "Rejected" : "Processing"],
  ];

  const skin =
    style === "dark"
      ? { bg: "linear-gradient(160deg,#0b0f19,#151b2b)", fg: "#f8fafc", sub: "#94a3b8", line: "rgba(255,255,255,0.09)", accent: "#f5c451" }
      : style === "brand"
        ? { bg: "linear-gradient(160deg,#b91c1c,#ef4444)", fg: "#ffffff", sub: "rgba(255,255,255,0.75)", line: "rgba(255,255,255,0.18)", accent: "#ffffff" }
        : { bg: "#ffffff", fg: "#0f172a", sub: "#64748b", line: "#e5e7eb", accent: "#16a34a" };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm animate-[rc-up_320ms_cubic-bezier(0.22,1,0.36,1)]">
        <div className="mb-2 flex items-center justify-between text-white">
          <span className="text-sm font-semibold">Transaction receipt</span>
          <button onClick={onClose} aria-label="Close receipt" className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={cardRef}
          style={{ background: skin.bg, color: skin.fg }}
          className="overflow-hidden rounded-2xl p-5 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <div style={{ color: skin.sub }} className="text-[10px] uppercase tracking-[0.2em]">AutoVest</div>
              <div className="text-sm font-semibold">Payment Receipt</div>
            </div>
            <div
              style={{ background: skin.accent, color: style === "brand" ? "#b91c1c" : "#ffffff" }}
              className="grid h-10 w-10 place-items-center rounded-full"
            >
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 text-center">
            <div style={{ color: skin.sub }} className="text-xs">Amount sent</div>
            <div className="mt-1 text-3xl font-black tracking-tight">{money(tx.amount)}</div>
            <div style={{ color: skin.sub }} className="mt-1 text-[11px]">
              {approved ? "Transaction successful" : tx.status === "rejected" ? "Transaction rejected" : "Awaiting approval"}
            </div>
          </div>

          <div className="mt-5 space-y-0.5">
            {rows.map(([k, v]) => (
              <div key={k} style={{ borderColor: skin.line }} className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
                <span style={{ color: skin.sub }} className="text-[11px]">{k}</span>
                <span className="max-w-[60%] break-words text-right text-[12px] font-semibold">{v}</span>
              </div>
            ))}
          </div>

          <div style={{ borderColor: skin.line }} className="mt-4 border-t pt-3 text-center">
            <div style={{ color: skin.sub }} className="text-[10px] leading-relaxed">
              This receipt is computer generated and does not require a signature.
              <br />Support: AutoVest customer care
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
          <button onClick={share} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-bold text-white disabled:opacity-60">
            <Share2 className="h-4 w-4" /> {busy ? "Preparing…" : "Share receipt"}
          </button>
          <button onClick={save} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-white/15 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <style>{`@keyframes rc-up { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
    </div>
  );
}
