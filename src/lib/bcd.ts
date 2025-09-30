// src/lib/bcd.ts
import bcd from "@mdn/browser-compat-data" assert { type: "json" };
import type { BrowserMajors } from "./baseline";
import { FEATURE_TO_BCD, TARGET_BROWSERS, type TargetBrowser } from "./feature-map";

/**
 * Get minimal major versions per browser for a given *internal* featureId,
 * using MDN BCD. Falls back to `null` per browser if not resolvable.
 */
export function getRequiredMajorsFromBCD(featureId: string): BrowserMajors {
  const entryKeys = FEATURE_TO_BCD[featureId];
  if (!entryKeys) return {};

  const keys = Array.isArray(entryKeys) ? entryKeys : [entryKeys];

  const out: BrowserMajors = {};
  for (const browser of TARGET_BROWSERS) {
    // Find the minimal version across all mapped keys (if multiple)
    const versions: number[] = [];
    for (const key of keys) {
      const v = versionAddedMajor(resolveSupport(key), browser);
      if (typeof v === "number") versions.push(v);
    }
    if (versions.length) {
      out[browser] = Math.min(...versions);
    }
  }
  return out;
}

/** Resolve a BCD compat object (with .__compat.support) from a dot key like "css.selectors.has" */
function resolveSupport(dotKey: string): any | null {
  const parts = dotKey.split(".");
  // Walk down the default export object
  let cur: any = (bcd as any);
  for (const p of parts) {
    if (cur && p in cur) cur = cur[p];
    else return null;
  }
  return cur?.__compat?.support ?? null;
}

/** Convert BCD's version_added (string|boolean|null) -> integer major or null */
function versionAddedMajor(support: any, browser: TargetBrowser): number | null {
  if (!support) return null;

  // support[browser] can be an object or array of statements
  const statements = Array.isArray(support[browser]) ? support[browser] : [support[browser]].filter(Boolean);

  // Find the first statement that indicates added support (prefixless, etc.)
  for (const st of statements) {
    if (!st) continue;
    let v = st.version_added;
    if (v === true) {
      // true means "supported but unknown from when" -> treat as earliest known stable
      // Return null so we fall back to curated constants; avoids wrong optimism.
      return null;
    }
    if (typeof v === "string") {
      // normalize like "106", "106.0", "≤37", "preview"
      // discard ranges/unknown markers
      const m = v.match(/^(\d+)(?:\.\d+)?$/);
      if (m) return parseInt(m[1], 10);
    }
  }
  return null;
}
