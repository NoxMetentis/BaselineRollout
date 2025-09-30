// src/lib/baseline.ts
import { features } from "web-features";

export type BrowserMajors = Partial<Record<"chrome" | "firefox" | "safari" | "edge", number>>;

export type FeatureInfo = {
  id: string;
  title: string;
  mdn?: string;
  baselineStatus?: "low" | "high" | "limited" | "none";
  required: BrowserMajors; // we'll fill this later once we wire support mapping
};

/**
 * NOTE: In `web-features`, `features` is a Record keyed by feature ID.
 * We access by key instead of calling `.find()`.
 */
export function getFeatureInfo(id: string): FeatureInfo | null {
  // TypeScript-friendly access:
  const f = (features as Record<string, any>)[id];
  if (!f) return null;

  // For now, we return the basics we can read directly.
  // (Per docs, `id` is the key; `name`, `status.baseline`, and `mdn.url` may be present.)
  return {
    id,
    title: f?.name ?? id,
    mdn: f?.mdn?.url,
    baselineStatus: f?.status?.baseline ?? "none",
    // We'll compute minimal majors in a later step using compat data joins.
    required: {},
  };
}
