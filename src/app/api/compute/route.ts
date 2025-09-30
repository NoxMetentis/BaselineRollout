import { NextRequest } from "next/server";
import { parseTrafficCSV } from "@/lib/traffic";
import { computeReadiness } from "@/lib/readiness";
import { getFeatureInfo, resolveRequiredMajors } from "@/lib/baseline";

type Payload = {
  features: string[];
  csv?: string;
  traffic?: Array<{ browser: "chrome"|"firefox"|"safari"|"edge"; version: number; share: number }>;
  threshold?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Payload;
    if (!body?.features?.length) {
      return Response.json({ error: "features[] required" }, { status: 400 });
    }
    const threshold = typeof body.threshold === "number" ? body.threshold : 0.95;

    let traffic;
    let issues: string[] = [];

    if (typeof body.csv === "string" && body.csv.trim().length > 0) {
      const parsed = parseTrafficCSV(body.csv);
      traffic = parsed.normalizedRows;
      issues = parsed.issues;
    } else if (Array.isArray(body.traffic)) {
      // trust caller; no normalization here for now
      traffic = body.traffic;
    } else {
      return Response.json({ error: "Provide csv (string) or traffic (array)" }, { status: 400 });
    }

    // with:
        const resultsRaw = body.features.map((id) => computeReadiness(id, traffic, threshold));
        const results = resultsRaw.map((r) => {
          const info = getFeatureInfo(r.featureId);
          const bcdMajors = resolveRequiredMajors(r.featureId);
          const baselineBacked = !!bcdMajors && Object.keys(bcdMajors).length > 0;
          return {
            ...r,
            mdn: info?.mdn,
            baselineStatus: info?.baselineStatus ?? "none",
            baselineBacked,
          };
        });
        return Response.json({ ok: true, threshold, count: results.length, issues, results });
  } catch (err: any) {
    return Response.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
