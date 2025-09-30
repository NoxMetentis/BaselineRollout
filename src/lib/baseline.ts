// src/lib/baseline.ts
import { features } from "web-features";
import { getRequiredMajorsFromBCD } from "./bcd";

/** Browsers we target for MVP */
export type BrowserKey = "chrome" | "firefox" | "safari" | "edge";
export type BrowserMajors = Partial<Record<BrowserKey, number>>;

export type FeatureInfo = {
  id: string;
  title: string;
  mdn?: string;
  baselineStatus?: "low" | "high" | "limited" | "none";
  required: BrowserMajors; // Filled later by resolver (BCD) or left empty.
};

/**
 * NOTE: In `web-features`, `features` is a Record keyed by feature ID.
 * We access by key instead of calling `.find()`.
 */
export function getFeatureInfo(id: string): FeatureInfo | null {
  const f = (features as Record<string, any>)[id];
  if (!f) return null;

  return {
    id,
    title: f?.name ?? id,
    mdn: f?.mdn?.url,
    baselineStatus: f?.status?.baseline ?? "none",
    required: {},
  };
}

/**
 * Resolve minimal required majors for a given feature using MDN BCD.
 * This does NOT include curated fallbacks; callers may merge with stubs.
 */
export function resolveRequiredMajors(featureId: string): BrowserMajors {
  return getRequiredMajorsFromBCD(featureId) || {};
}
