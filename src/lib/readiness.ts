import type { BrowserMajors } from "./baseline";

export type TrafficRow = { browser: "chrome"|"firefox"|"safari"|"edge"; version: number; share: number; };

export type ReadinessResult = {
  featureId: string;
  required: BrowserMajors;
  readiness: number;         // 0..1
  threshold: number;         // 0..1
  pass: boolean;
  blockedBy: Array<{ browser: keyof BrowserMajors; missingShare: number; note?: string }>;
};

/**
 * TEMPORARY: stub minimal majors for feasibility.
 * We'll replace this with real values later (via Baseline/BCD join).
 */
export const REQUIRED_MIN: Record<string, BrowserMajors> = {
  // :has()
  has: { chrome: 105, edge: 105, safari: 15, firefox: 121 },
  // container queries
  "container-queries": { chrome: 106, edge: 106, safari: 16, firefox: 110 },
  // you can add more later...
};

/** Sum of shares whose version >= requiredVersion for each browser. */
export function computeReadiness(
  featureId: string,
  traffic: TrafficRow[],
  threshold = 0.95
): ReadinessResult {
  const required = REQUIRED_MIN[featureId] ?? {};
  // Normalize traffic sum to 1.0 if not already
  const total = traffic.reduce((acc, r) => acc + r.share, 0);
  const normalized = total > 0 ? traffic.map(r => ({...r, share: r.share / total})) : [];

  let sumSupported = 0;
  const missingByBrowser: Record<string, number> = { chrome: 0, firefox: 0, safari: 0, edge: 0 };

  for (const row of normalized) {
    const req = (required as any)[row.browser] as number | undefined;
    const isSupported = typeof req === "number" ? row.version >= req : false;
    if (isSupported) {
      sumSupported += row.share;
    } else {
      // Count missing share per browser when below required (or unknown)
      missingByBrowser[row.browser] += row.share;
    }
  }

  // Build blocked list (largest first)
  const blockedBy = (Object.keys(missingByBrowser) as Array<keyof BrowserMajors>)
    .map(b => ({ browser: b, missingShare: missingByBrowser[b] || 0 }))
    .filter(x => x.missingShare > 0)
    .sort((a, b) => b.missingShare - a.missingShare);

  const readiness = Number(sumSupported.toFixed(4));
  return {
    featureId,
    required,
    readiness,
    threshold,
    pass: readiness >= threshold,
    blockedBy,
  };
}
