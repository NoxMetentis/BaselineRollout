export type CssDetection = {
  file: string;
  hits: string[]; // feature ids
};

const RE = {
  has: /:has\s*\(/,                            // :has(
  "container-queries": /@container\b|container-(?:type|name)\s*:/, // @container or container-type/name:
  "view-transitions": /\bview-transition-name\s*:/, // CSS property usage
  "color-mix": /\bcolor-mix\s*\(/,             // color-mix(
};

const CSS_EXT = new Set([".css", ".scss", ".sass"]);

export function detectCss(content: string, file: string): CssDetection | null {
  const lower = content; // keep case for CSS; properties are usually lowercase
  const hits: string[] = [];

  for (const [id, rx] of Object.entries(RE)) {
    if (rx.test(lower)) hits.push(id);
  }
  return hits.length ? { file, hits } : null;
}

export function isCssPath(p: string) {
  const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
  return CSS_EXT.has(ext);
}
