// scripts/quick-baseline-check.ts
import { getFeatureInfo } from "../src/lib/baseline";

const SAMPLE_IDS = [
  "has",                // :has()
  "container-queries",  // @container / container-type
];

for (const id of SAMPLE_IDS) {
  const info = getFeatureInfo(id);
  if (!info) {
    console.log(`❌ Not found: ${id}`);
    continue;
  }
  console.log(`\n🧩 ${info.title} (${info.id})`);
  console.log(`Baseline status: ${info.baselineStatus}`);
  console.log(`MDN: ${info.mdn ?? "-"}`);
  console.log("Required majors (stub for now):", info.required);
}
