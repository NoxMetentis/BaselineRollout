import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";
import { parseTrafficCSV } from "../src/lib/traffic";
import { computeReadiness } from "../src/lib/readiness";
import { detectCss, isCssPath } from "../src/lib/detect-css";
import { detectJs, isJsPath } from "../src/lib/detect-js";

const args = process.argv.slice(2);
function arg(key: string, def?: string) {
  const i = args.indexOf(key);
  return i >= 0 ? args[i + 1] : def;
}

const globs = arg("-g", "src/**/*.{js,jsx,ts,tsx,css,scss}")!;
const trafficFile = arg("-t", "src/samples/traffic.sample.csv")!;
const threshold = Number(arg("-th", "0.95"));
const outPath = arg("-o", "baseline-report.md")!;

(async function main() {
  // Load traffic
  const csv = fs.readFileSync(path.resolve(trafficFile), "utf8");
  const parsed = parseTrafficCSV(csv);
  const traffic = parsed.normalizedRows;

  // Gather files
  const files = await fg(globs, { dot: false, onlyFiles: true });

  // Detect features
  const found = new Set<string>();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    if (isCssPath(file)) {
      const hit = detectCss(content, file);
      if (hit) hit.hits.forEach((h) => found.add(h));
    } else if (isJsPath(file)) {
      const hit = detectJs(content, file);
      if (hit) hit.hits.forEach((h) => found.add(h));
    }
  }

  // If none, write a friendly report and exit 0 (no gating needed)
  if (found.size === 0) {
    const md = `
### Baseline Readiness

_No target features detected in the changed files._

- Threshold: **${(threshold * 100).toFixed(0)}%**
- Traffic file: \`${trafficFile}\`
`;
    fs.writeFileSync(outPath, md.trim() + "\n", "utf8");
    console.log("No target features detected.");
    process.exit(0);
  }

  // Compute readiness per feature
  const ids = Array.from(found).sort();
  const results = ids.map((id) => computeReadiness(id, traffic, threshold));
  const anyFail = results.some((r) => !r.pass);

  // Compose Markdown table
  const rows = results
    .map((r) => {
      const pct = (r.readiness * 100).toFixed(1) + "%";
      const top = r.blockedBy?.[0];
      const blocker = top ? `${top.browser} (~${(top.missingShare * 100).toFixed(1)}%)` : "—";
      const pass = r.pass ? "✅" : "❌";
      return `| \`${r.featureId}\` | ${pct} | ${(threshold * 100).toFixed(0)}% | ${pass} | ${blocker} |`;
    })
    .join("\n");

  const md = `
### Baseline Readiness

Detected features in this PR:
${ids.map((id) => `- \`${id}\``).join("\n")}

**Policy threshold:** ${(threshold * 100).toFixed(0)}%  
**Traffic file:** \`${trafficFile}\`

| Feature | Readiness | Threshold | Pass | Top blocker |
|---|---:|---:|:---:|---|
${rows}

${anyFail ? "> ❌ One or more features are below policy threshold." : "> ✅ All detected features meet the policy threshold."}
`.trim();

  fs.writeFileSync(outPath, md + "\n", "utf8");

  // Exit nonzero if any fail (so CI can gate)
  if (anyFail) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
