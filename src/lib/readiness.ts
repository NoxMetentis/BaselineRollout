// src/lib/readiness.ts
import type { BrowserMajors } from "./baseline";
import { resolveRequiredMajors } from "./baseline";

export type TrafficRow = {
  browser: "chrome" | "firefox" | "safari" | "edge";
  version: number;
  share: number; // normalized 0..1 recommended
};

export type BrowserBreakdown = {
  browser: keyof BrowserMajors;
  required?: number;      // minimal major required (if defined)
  supportedShare: number; // sum of shares that meet/exceed required
  missingShare: number;   // sum of shares that are below required (or required unknown)
};

export type ReadinessResult = {
  featureId: string;
  required: BrowserMajors;
  readiness: number;      // 0..1 (sum of supported shares across all browsers)
  threshold: number;      // 0..1
  pass: boolean;
  blockedBy: Array<{ browser: keyof BrowserMajors; missingShare: number }>;
  perBrowser: BrowserBreakdown[];
};

/**
 * Curated stub minimal majors for determinism in demos.
 * We PREFER BCD but fall back to these where BCD is ambiguous/missing.
 */
export const REQUIRED_MIN: Record<string, BrowserMajors> = {
  // MVP mapped features
  has: { chrome: 105, edge: 105, safari: 15, firefox: 121 },
  "container-queries": { chrome: 106, edge: 106, safari: 16, firefox: 110 },

  // Optional stubs to avoid 0% demos (tune later or leave unmapped to ignore)
  "color-mix": { chrome: 110, edge: 110, safari: 16, firefox: 110 },
  "view-transitions": { chrome: 114, edge: 114, safari: 17, firefox: 120 },
  "abortsignal-timeout": { chrome: 115, edge: 115, safari: 17, firefox: 120 },
};

export function computeReadiness(
  featureId: string,
  traffic: TrafficRow[],
  threshold = 0.95
): ReadinessResult {
  // Prefer BCD-derived majors; fall back to curated stubs for determinism
  const requiredFromBCD = resolveRequiredMajors(featureId);
  const required: BrowserMajors = {
    ...REQUIRED_MIN[featureId], // curated defaults
    ...requiredFromBCD,         // overwrite with BCD where available
  };

  // Normalize traffic to sum=1.0
  const total = traffic.reduce((acc, r) => acc + r.share, 0);
  const rows = total > 0 ? traffic.map(r => ({ ...r, share: r.share / total })) : [];

  const perSupported: Record<string, number> = { chrome: 0, firefox: 0, safari: 0, edge: 0 };
  const perMissing:   Record<string, number> = { chrome: 0, firefox: 0, safari: 0, edge: 0 };

  for (const row of rows) {
    const req = (required as any)[row.browser] as number | undefined;
    const ok = typeof req === "number" ? row.version >= req : false;
    if (ok) perSupported[row.browser] += row.share;
    else    perMissing[row.browser]   += row.share;
  }

  const readiness = Number(
    (perSupported.chrome + perSupported.firefox + perSupported.safari + perSupported.edge)
      .toFixed(4)
  );

  const perBrowser: BrowserBreakdown[] = (["chrome","firefox","safari","edge"] as const).map((b) => ({
    browser: b,
    required: (required as any)[b],
    supportedShare: perSupported[b],
    missingShare: perMissing[b],
  }));

  const blockedBy = perBrowser
    .filter(b => b.missingShare > 0)
    .sort((a, b) => b.missingShare - a.missingShare)
    .map(b => ({ browser: b.browser, missingShare: b.missingShare }));

  return {
    featureId,
    required,
    readiness,
    threshold,
    pass: readiness >= threshold,
    blockedBy,
    perBrowser,
  };
}
