export function plnToGrosze(pln: number): number {
  return Math.round(pln * 100);
}

export function groszeToPln(grosze: number): number {
  return grosze / 100;
}

export function formatPln(grosze: number): string {
  const sign = grosze < 0 ? "−" : "";
  const abs = Math.abs(grosze);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${frac} zł`;
}

export function parsePlnInput(raw: string): number | null {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return plnToGrosze(value);
}
