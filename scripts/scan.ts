// scripts/scan.ts
import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";
import { parseTrafficCSV } from "../src/lib/traffic";
import { computeReadiness } from "../src/lib/readiness";
import { detectCss, isCssPath } from "../src/lib/detect-css";
import { detectJs, isJsPath } from "../src/lib/detect-js";
import { FEATURE_TO_BCD } from "../src/lib/feature-map";

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
  // 1) Load traffic and normalize
  const csv = fs.readFileSync(path.resolve(trafficFile), "utf8");
  const parsed = parseTrafficCSV(csv); // includes .issues
  const traffic = parsed.normalizedRows;

  // Traffic snapshot by browser (sum across versions)
  const browserTotals: Record<string, number> = {};
  for (const r of traffic) {
    browserTotals[r.browser] = (browserTotals[r.browser] || 0) + r.share;
  }

  // If no valid traffic rows, write a clear report and fail the gate
  if (!traffic.length) {
    const md = `
### Baseline Readiness

**❗ No valid traffic rows parsed from** \`${trafficFile}\`.

Expected CSV headers: \`browser,version,share\` (shares are 0..1).  
Accepted browsers (MVP): \`chrome, firefox, safari, edge\`.

${parsed.issues?.length ? `**Traffic notes:**\n${parsed.issues.map(x => `- ${x}`).join("\n")}` : ""}

> ❌ GATED: Cannot compute readiness without valid traffic data.
`.trim();
    fs.writeFileSync(outPath, md + "\n", "utf8");
    console.error("No valid traffic rows parsed; see PR comment for details.");
    process.exit(1);
  }

  // 2) Gather files
  const files = await fg(globs, { dot: false, onlyFiles: true });

  // 3) Detect features in files
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

  // 4) Partition: mapped vs ignored, using our BCD feature map
  const idsAll = Array.from(found).sort();
  const ids = idsAll.filter((id) => Boolean((FEATURE_TO_BCD as any)[id]));
  const ignored = idsAll.filter((id) => !Boolean((FEATURE_TO_BCD as any)[id]));

  // If nothing detected at all
  if (idsAll.length === 0) {
    const md = `
### Baseline Readiness

_No target features detected in the changed files._

- Policy threshold: **${(threshold * 100).toFixed(0)}%**
- Traffic file: \`${trafficFile}\`
- Traffic snapshot: chrome ${pct(browserTotals.chrome)}, firefox ${pct(browserTotals.firefox)}, safari ${pct(browserTotals.safari)}, edge ${pct(browserTotals.edge)}
${parsed.issues?.length ? `\n**Traffic notes:**\n${parsed.issues.map(x => `- ${x}`).join("\n")}\n` : ""}
`.trim();
    fs.writeFileSync(outPath, md + "\n", "utf8");
    console.log("No target features detected.");
    process.exit(0);
  }

  // If none are mapped for gating yet
  if (ids.length === 0) {
    const md = `
### Baseline Readiness

Detected features in this PR, but none are mapped yet for gating:
${idsAll.map(id => `- \`${id}\``).join("\n")}

> ℹ️ Ignored (no BCD map): ${idsAll.map(id => `\`${id}\``).join(", ")}

- Policy threshold: **${(threshold * 100).toFixed(0)}%**
- Traffic file: \`${trafficFile}\`
- Traffic snapshot: chrome ${pct(browserTotals.chrome)}, firefox ${pct(browserTotals.firefox)}, safari ${pct(browserTotals.safari)}, edge ${pct(browserTotals.edge)}
${parsed.issues?.length ? `\n**Traffic notes:**\n${parsed.issues.map(x => `- ${x}`).join("\n")}\n` : ""}
`.trim();
    fs.writeFileSync(outPath, md + "\n", "utf8");
    console.log("No mapped features to gate. Exiting 0.");
    process.exit(0);
  }

  // 5) Compute readiness and build rich details
  const results = ids.map((id) => computeReadiness(id, traffic, threshold));
  const failing = results.filter(r => !r.pass).sort((a, b) => a.readiness - b.readiness);
  const anyFail = failing.length > 0;

  // Top-line summary
  let summary = `> ✅ All mapped features meet the policy threshold.`;
  if (anyFail) {
    const worst = failing[0];
    const tb = worst.blockedBy[0];
    const req = (worst.required as any)?.[tb?.browser ?? ""] as number | undefined;
    summary = `> ❌ **GATED**: \`${worst.featureId}\` readiness ${(worst.readiness * 100).toFixed(1)}% is below policy ${(
      threshold * 100
    ).toFixed(0)}%${
      tb ? ` — main blocker: **${tb.browser}** (~${(tb.missingShare * 100).toFixed(1)}%)${req ? ` < v${req}` : ""}` : ""
    }.`;
  }

  // Table rows
  const tableRows = results
    .map((r) => {
      const pctReady = (r.readiness * 100).toFixed(1) + "%";
      const top = r.blockedBy?.[0];
      const blocker = top ? `${top.browser} (~${(top.missingShare * 100).toFixed(1)}%)` : "—";
      const pass = r.pass ? "✅" : "❌";
      return `| \`${r.featureId}\` | ${pctReady} | ${(threshold * 100).toFixed(0)}% | ${pass} | ${blocker} |`;
    })
    .join("\n");

  // Details per feature (browser-level stats + required versions)
  const detailsBlocks = results.map((r) => {
    const req = r.required;
    const reqList = [
      req.chrome ? `chrome ≥ ${req.chrome}` : null,
      req.firefox ? `firefox ≥ ${req.firefox}` : null,
      req.safari ? `safari ≥ ${req.safari}` : null,
      req.edge ? `edge ≥ ${req.edge}` : null,
    ].filter(Boolean).join(", ");

    const stats = r.perBrowser.map(b => {
      return `| ${b.browser} | ${b.required ?? "—"} | ${pct(b.supportedShare)} | ${pct(b.missingShare)} |`;
    }).join("\n");

    const tip = r.pass
      ? "_All good for current policy. Consider raising policy later to tighten standards._"
      : `To pass now, set policy ≤ **${(r.readiness * 100).toFixed(1)}%** or add fallbacks/polyfills for the blocking browser(s).`;

    return `
<details>
<summary><strong>\`${r.featureId}\`</strong> — required: ${reqList || "n/a"}</summary>

**Per-browser impact**

| Browser | Required | Supported | Missing |
|---|---:|---:|---:|
${stats}

${tip}
</details>
`.trim();
  }).join("\n\n");

  const trafficNotes = parsed.issues?.length
    ? `\n**Traffic notes:**\n${parsed.issues.map(x => `- ${x}`).join("\n")}\n`
    : "";

  const md = `
### Baseline Readiness

Detected features (mapped for gating):
${ids.map(id => `- \`${id}\``).join("\n")}

${ignored.length ? `Ignored (no BCD map): ${ignored.map(id => `\`${id}\``).join(", ")}` : ""}

**Policy threshold:** ${(threshold * 100).toFixed(0)}%  
**Traffic file:** \`${trafficFile}\`  
**Traffic snapshot:** chrome ${pct(browserTotals.chrome)}, firefox ${pct(browserTotals.firefox)}, safari ${pct(browserTotals.safari)}, edge ${pct(browserTotals.edge)}
${trafficNotes}
${summary}

| Feature | Readiness | Threshold | Pass | Top blocker |
|---|---:|---:|:---:|---|
${tableRows}

${detailsBlocks}
`.trim();

  fs.writeFileSync(outPath, md + "\n", "utf8");

  // 6) Exit nonzero if any fail (so CI gates)
  if (anyFail) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});

function pct(n?: number) {
  if (!n || n <= 0) return "0.0%";
  return (n * 100).toFixed(1) + "%";
}
