"use client";

import { useMemo, useState } from "react";

type BrowserKey = "chrome" | "firefox" | "safari" | "edge";

type Result = {
  featureId: string;
  readiness: number; // 0..1
  threshold: number; // 0..1
  pass: boolean;
  required: Partial<Record<BrowserKey, number>>;
  blockedBy: Array<{ browser: BrowserKey; missingShare: number }>;
};

const ALL_FEATURES = [
  { id: "has", label: ":has()" },
  { id: "container-queries", label: "Container queries" },
  { id: "view-transitions", label: "View Transitions (JS API)" },
  { id: "color-mix", label: "color-mix()" },
  { id: "abortsignal-timeout", label: "AbortSignal.timeout" },
] as const;

export default function Page() {
  const [csv, setCsv] = useState<string>(
    "browser,version,share\nchrome,124,0.38\nfirefox,125,0.12\nsafari,17,0.25\nedge,124,0.10\n"
  );
  const [threshold, setThreshold] = useState<number>(0.95);
  const [monthlyInc, setMonthlyInc] = useState<number>(0.01); // +1%/month default
  const [selected, setSelected] = useState<string[]>(
    ALL_FEATURES.map((f) => f.id) // pre-select all 5
  );
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[] | null>(null);

  const thresholdPct = useMemo(() => Math.round(threshold * 100), [threshold]);

  function projectionLabel(readiness: number, target: number, inc: number) {
    if (inc <= 0) return "—";
    const gap = Math.max(0, target - readiness);
    if (gap === 0) return "ready now";
    const months = Math.ceil(gap / inc);
    return `≈ ${months} mo to ${Math.round(target * 100)}%`;
    // (We could add a calendar month estimate later.)
  }

  function toggleFeature(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onCompute() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/compute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          features: selected,
          threshold,
          csv,
        }),
      });
      const json = await res.json();
      setIssues(Array.isArray(json.issues) ? json.issues : null);

      if (!res.ok) throw new Error(json?.error || "Request failed");
      setResults(json.results as Result[]);
    } catch (e: any) {
      setError(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 980,
        margin: "0 auto",
        fontFamily: "system-ui, Arial",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Baseline Rollout Planner (MVP)
      </h1>
      <p style={{ color: "#444", marginBottom: 24 }}>
        Paste your traffic CSV below, pick features, set a policy threshold,
        then compute readiness.
      </p>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Left: CSV */}
        <div>
          <label style={{ fontWeight: 600 }}>Traffic CSV</label>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={10}
            style={{
              width: "100%",
              marginTop: 8,
              padding: 8,
              fontFamily: "ui-monospace, Menlo, Consolas",
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          />
          <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
            Required headers: <code>browser,version,share</code>
          </div>
        </div>

        {/* Right: Features + controls */}
        <div>
          <label style={{ fontWeight: 600 }}>Features</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 8,
              marginTop: 8,
            }}
          >
            {ALL_FEATURES.map((f) => (
              <label
                key={f.id}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(f.id)}
                  onChange={() => toggleFeature(f.id)}
                />
                <span>{f.label}</span>
                <code style={{ marginLeft: 8, opacity: 0.7 }}>{f.id}</code>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 600 }}>
              Policy threshold: {thresholdPct}%
            </label>
            <input
              type="range"
              min={50}
              max={100}
              value={thresholdPct}
              onChange={(e) => setThreshold(Number(e.target.value) / 100)}
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ fontWeight: 600 }}>
              Adoption speed (naive): {(monthlyInc * 100).toFixed(0)}% / month
            </label>
            <input
              type="range"
              min={0}
              max={3}
              value={monthlyInc * 100}
              onChange={(e) => setMonthlyInc(Number(e.target.value) / 100)}
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>

          <button
            onClick={onCompute}
            disabled={loading || selected.length === 0 || !csv.trim()}
            style={{
              marginTop: 16,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #222",
              background: loading ? "#ddd" : "#111",
              color: loading ? "#333" : "#fff",
              cursor: loading ? "default" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Computing..." : "Compute readiness"}
          </button>
          {issues && issues.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                border: "1px solid #ddd",
                borderRadius: 6,
                background: "#fffef6",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Input notes
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {issues.map((m, i) => (
                  <li key={i} style={{ fontSize: 13 }}>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>
          )}
        </div>
      </section>

      {results && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Results
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Feature</th>
                <th style={th}>Readiness</th>
                <th style={th}>Threshold</th>
                <th style={th}>Projection</th>
                <th style={th}>Pass</th>
                <th style={th}>Top blocker</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const pct = `${(r.readiness * 100).toFixed(1)}%`;
                const projection = projectionLabel(
                  r.readiness,
                  r.threshold,
                  monthlyInc
                );
                const top = r.blockedBy?.[0];
                const blockerText = top
                  ? `${top.browser} (~${(top.missingShare * 100).toFixed(1)}%)`
                  : "—";
                return (
                  <tr key={r.featureId}>
                    <td style={td}>
                      <code>{r.featureId}</code>
                    </td>
                    <td style={td}>{pct}</td>
                    <td style={td}>{Math.round(r.threshold * 100)}%</td>
                    <td style={td}>{projection}</td>
                    <td
                      style={{
                        ...td,
                        color: r.pass ? "green" : "crimson",
                        fontWeight: 700,
                      }}
                    >
                      {r.pass ? "✅ PASS" : "❌ FAIL"}
                    </td>
                    <td style={td}>{blockerText}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            Projection uses a simple linear model: current readiness +{" "}
            <code>{(monthlyInc * 100).toFixed(0)}%</code> per month. Adjust
            “Adoption speed” to simulate faster/slower uptake.
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#555" }}>
            *Versions and per-browser requirements are stubbed for feasibility;
            real Baseline data mapping comes next.
          </div>
        </section>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: "8px 6px",
  background: "#f7f7f7",
  fontWeight: 700,
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "8px 6px",
};
