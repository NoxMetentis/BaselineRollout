// scripts/quick-readiness.ts
import fs from "node:fs";
import path from "node:path";
import { parseTrafficCSV } from "../src/lib/traffic";
import { computeReadiness } from "../src/lib/readiness";

const trafficPath = path.join(process.cwd(), "src", "samples", "traffic.sample.csv");
const csv = fs.readFileSync(trafficPath, "utf8");
const traffic = parseTrafficCSV(csv);

const FEATURES = ["has", "container-queries"] as const;

for (const featureId of FEATURES) {
  const res = computeReadiness(featureId, traffic, 0.95);
  const pct = (res.readiness * 100).toFixed(1);
  console.log(`\n🔎 Feature: ${featureId}`);
  console.log(`Required (stub):`, res.required);
  console.log(`Readiness: ${pct}%  | Threshold: ${res.threshold * 100}%  | ${res.pass ? "✅ PASS" : "❌ FAIL"}`);
  if (res.blockedBy.length) {
    const top = res.blockedBy[0];
    console.log(`Blocked mainly by: ${top.browser} (~${(top.missingShare * 100).toFixed(1)}%)`);
  }
}
