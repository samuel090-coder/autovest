export function formatNaira(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatNumber(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString("en-NG");
}
