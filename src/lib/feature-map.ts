// src/lib/feature-map.ts
/**
 * Map our internal feature IDs -> MDN BCD compatibility keys.
 * We focus on 5 curated features for a deterministic demo.
 */
export const FEATURE_TO_BCD: Record<string, string | string[]> = {
  // CSS :has()
  "has": "css.selectors.has",

  // Container queries – at-rule is the clearest single gate
  "container-queries": "css.at-rules.container",

  // CSS color-mix()
  "color-mix": "css.types.color-mix", // alternate: "css.functions.color-mix"

  // View Transitions API (JS)
  "view-transitions": "api.Document.startViewTransition",

  // AbortSignal.timeout()
  "abortsignal-timeout": "api.AbortSignal.timeout",
};

/** Browsers we care about for MVP */
export const TARGET_BROWSERS = ["chrome", "firefox", "safari", "edge"] as const;
export type TargetBrowser = typeof TARGET_BROWSERS[number];
