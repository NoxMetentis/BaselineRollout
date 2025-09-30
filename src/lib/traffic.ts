import Papa from "papaparse";
import type { TrafficRow } from "./readiness";

const NAME_MAP: Record<string, TrafficRow["browser"]> = {
  chrome: "chrome",
  "google chrome": "chrome",
  firefox: "firefox",
  mozilla: "firefox",
  safari: "safari",
  edge: "edge",
  "microsoft edge": "edge",
};

export type ParseResult = {
  rows: TrafficRow[];
  sum: number;           // original sum before normalization
  normalizedRows: TrafficRow[];
  normalizedSum: number; // should be 1.0
  issues: string[];
};

export function parseTrafficCSV(csv: string): ParseResult {
  const { data, errors } = Papa.parse(csv.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true });

  const issues: string[] = [];
  if (errors?.length) {
    issues.push(`CSV parse: ${errors.length} warning(s).`);
  }

  // 1) Clean + map names
  const temp: TrafficRow[] = [];
  for (const rec of data as any[]) {
    const rawName = String(rec.browser ?? "").toLowerCase().trim();
    const browser = NAME_MAP[rawName];
    const version = Math.floor(Number(rec.version));
    const share = Number(rec.share);

    if (!browser) { issues.push(`Unknown browser: "${rec.browser}"`); continue; }
    if (!Number.isFinite(version) || version < 0) { issues.push(`Bad version for ${rec.browser}: "${rec.version}"`); continue; }
    if (!Number.isFinite(share) || share < 0) { issues.push(`Bad share for ${rec.browser} ${version}: "${rec.share}"`); continue; }

    temp.push({ browser, version, share });
  }

  // 2) Aggregate by browser+major
  const agg = new Map<string, { browser: TrafficRow["browser"]; version: number; share: number }>();
  for (const r of temp) {
    const key = `${r.browser}:${r.version}`;
    const cur = agg.get(key);
    if (cur) cur.share += r.share;
    else agg.set(key, { ...r });
  }
  const rows = Array.from(agg.values());

  // 3) Normalize to sum=1.0 (if not zero)
  const sum = rows.reduce((a, r) => a + r.share, 0);
  const normalizedRows = sum > 0 ? rows.map(r => ({ ...r, share: r.share / sum })) : [];
  const normalizedSum = normalizedRows.reduce((a, r) => a + r.share, 0);

  if (Math.abs(sum - 1) > 0.02) {
    issues.push(`Shares sum to ${sum.toFixed(3)}; normalized to 1.000.`);
  }

  return { rows, sum, normalizedRows, normalizedSum, issues };
}
