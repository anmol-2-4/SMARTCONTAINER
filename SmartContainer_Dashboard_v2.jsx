import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, LineChart, Line, CartesianGrid, Legend } from "recharts";

// ── REAL DATA ─────────────────────────────────────────────────────────────────
const STATS = {
  total: 8481, critical: 73, lowRisk: 1754, clear: 6654, anomalies: 1049,
  aucRoc: 1.0000, accuracy: 99.88, precision: 100, recall: 99, f1: 0.99,
  trainSize: 54000,
};

const SCORE_DIST = [
  { range: "0–10",  count: 6173, label: "Very Low" },
  { range: "10–20", count: 1809, label: "Low" },
  { range: "20–30", count: 418,  label: "Moderate" },
  { range: "30–40", count: 7,    label: "Medium" },
  { range: "40–50", count: 1,    label: "Elevated" },
  { range: "50–60", count: 2,    label: "High" },
  { range: "60–70", count: 9,    label: "High" },
  { range: "70–80", count: 44,   label: "Critical" },
  { range: "80–90", count: 18,   label: "Critical" },
  { range: "90–100",count: 0,    label: "Critical" },
];

const RISK_PIE = [
  { name: "Clear",    value: 6654, color: "#10b981", avg: 5.0 },
  { name: "Low Risk", value: 1754, color: "#f59e0b", avg: 17.4 },
  { name: "Critical", value: 73,   color: "#ef4444", avg: 74.8 },
];

const DWELL_DATA = [
  { level: "Clear",    dwell: 40.7, wt: 2.5,  color: "#10b981" },
  { level: "Low Risk", dwell: 50.4, wt: 10.9, color: "#f59e0b" },
  { level: "Critical", dwell: 75.3, wt: 22.9, color: "#ef4444" },
];

const ORIGIN_DATA = [
  { country: "CN", total: 4285, critical: 48, critPct: 1.12, flag: "🇨🇳" },
  { country: "JP", total: 784,  critical: 3,  critPct: 0.38, flag: "🇯🇵" },
  { country: "US", total: 729,  critical: 3,  critPct: 0.41, flag: "🇺🇸" },
  { country: "DE", total: 319,  critical: 3,  critPct: 0.94, flag: "🇩🇪" },
  { country: "KR", total: 378,  critical: 2,  critPct: 0.53, flag: "🇰🇷" },
  { country: "SG", total: 52,   critical: 2,  critPct: 3.85, flag: "🇸🇬" },
  { country: "TH", total: 89,   critical: 2,  critPct: 2.25, flag: "🇹🇭" },
  { country: "CA", total: 68,   critical: 2,  critPct: 2.94, flag: "🇨🇦" },
  { country: "GB", total: 44,   critical: 2,  critPct: 4.55, flag: "🇬🇧" },
  { country: "VN", total: 322,  critical: 1,  critPct: 0.31, flag: "🇻🇳" },
];

const HS_DATA = [
  { ch: "84", name: "Machinery", total: 640,  critical: 14, color: "#ef4444" },
  { ch: "85", name: "Electronics", total: 987, critical: 12, color: "#f97316" },
  { ch: "95", name: "Toys/Games", total: 296, critical: 12, color: "#f59e0b" },
  { ch: "90", name: "Optics/Medical", total: 424, critical: 6, color: "#eab308" },
  { ch: "62", name: "Clothing (woven)", total: 509, critical: 3, color: "#84cc16" },
  { ch: "87", name: "Vehicles", total: 58,  critical: 2, color: "#22c55e" },
  { ch: "82", name: "Tools/Cutlery", total: 44,  critical: 2, color: "#10b981" },
  { ch: "44", name: "Wood/Timber", total: 52,  critical: 2, color: "#06b6d4" },
];

const FEATURES = [
  { name: "weight_diff_pct",     importance: 36.45, group: "Weight" },
  { name: "weight_ratio",        importance: 20.50, group: "Weight" },
  { name: "importer_crit_rate",  importance: 9.96,  group: "Behaviour" },
  { name: "weight_large_disc",   importance: 8.88,  group: "Weight" },
  { name: "dwell_time",          importance: 8.14,  group: "Dwell" },
  { name: "log_dwell",           importance: 7.35,  group: "Dwell" },
  { name: "long_dwell_flag",     importance: 2.23,  group: "Dwell" },
  { name: "multi_risk_score",    importance: 1.95,  group: "Composite" },
  { name: "country_crit_rate",   importance: 1.82,  group: "Behaviour" },
  { name: "hs_crit_rate",        importance: 1.12,  group: "HS Code" },
];

const TOP_CONTAINERS = [
  { id: "76991507", score: 84.8, pcrit: 99.85, origin: "CN", hs: "950300", dwell: 129.2, wt: 34.3, anom: 1, exp: "Weight excess 34%; Extended dwell 129h; Importer 50% crit rate" },
  { id: "91475507", score: 84.6, pcrit: 99.80, origin: "KR", hs: "851981", dwell: 135.2, wt: 34.3, anom: 1, exp: "Weight excess 34%; Extended dwell 135h; Importer 100% crit rate" },
  { id: "51759899", score: 82.9, pcrit: 99.92, origin: "CN", hs: "950300", dwell: 141.7, wt: 36.3, anom: 1, exp: "Weight excess 36%; Extended dwell 142h; Importer 14.3% crit rate" },
  { id: "67782030", score: 82.4, pcrit: 100.0, origin: "CN", hs: "901890", dwell: 151.1, wt: 41.3, anom: 1, exp: "Weight excess 41%; Extreme dwell 151h; Importer 16.7% crit rate" },
  { id: "60233168", score: 82.3, pcrit: 99.96, origin: "CN", hs: "950300", dwell: 126.3, wt: 31.4, anom: 1, exp: "Weight excess 31%; Extended dwell 126h; Importer 33.3% crit rate" },
  { id: "25026736", score: 82.1, pcrit: 99.37, origin: "US", hs: "847759", dwell: 146.2, wt: 39.7, anom: 1, exp: "Weight excess 40%; Extended dwell 146h; Importer 100% crit rate" },
  { id: "17293618", score: 81.9, pcrit: 100.0, origin: "CN", hs: "901910", dwell: 166.8, wt: 44.4, anom: 1, exp: "Weight excess 44%; Extreme dwell 167h; Importer 20% crit rate" },
  { id: "39444307", score: 81.9, pcrit: 99.98, origin: "CN", hs: "950300", dwell: 129.2, wt: 34.3, anom: 1, exp: "Weight excess 34%; Extended dwell 129h; Importer 11.1% crit rate" },
  { id: "97911336", score: 81.6, pcrit: 98.57, origin: "JP", hs: "441510", dwell: 152.2, wt: 39.7, anom: 1, exp: "Weight excess 40%; Extreme dwell 152h; Importer 25% crit rate" },
  { id: "63763760", score: 81.5, pcrit: 99.57, origin: "CN", hs: "854370", dwell: 132.8, wt: 33.5, anom: 1, exp: "Weight excess 33%; Extended dwell 133h; Importer 20% crit rate" },
  { id: "62172523", score: 81.5, pcrit: 98.78, origin: "CN", hs: "950300", dwell: 122.3, wt: 30.1, anom: 1, exp: "Weight excess 30%; Extended dwell 122h; Importer 16.7% crit rate" },
  { id: "55851409", score: 81.1, pcrit: 98.96, origin: "FR", hs: "621710", dwell: 133.6, wt: 33.8, anom: 1, exp: "Weight excess 34%; Extended dwell 134h; Importer 20% crit rate" },
  { id: "76696724", score: 80.9, pcrit: 99.52, origin: "CN", hs: "330430", dwell: 162.0, wt: 42.8, anom: 1, exp: "Weight excess 43%; Extreme dwell 162h; Off-hours declaration 00:22" },
  { id: "58202458", score: 80.8, pcrit: 99.74, origin: "CN", hs: "871160", dwell: 128.4, wt: 34.0, anom: 1, exp: "Weight excess 34%; Extended dwell 128h; Importer 20% crit rate" },
  { id: "77449213", score: 80.4, pcrit: 99.99, origin: "CN", hs: "650610", dwell: 130.4, wt: 32.7, anom: 1, exp: "Weight excess 33%; Extended dwell 130h; Importer 50% crit rate" },
];

const WORKFLOW_STEPS = [
  { step: "01", title: "Data Ingestion", desc: "CSV / REST API batch upload", icon: "📥", color: "#6366f1" },
  { step: "02", title: "Feature Engineering", desc: "30 features across 7 signal groups", icon: "⚙️", color: "#8b5cf6" },
  { step: "03", title: "Risk Scoring", desc: "RF + Isolation Forest ensemble", icon: "🧠", color: "#a855f7" },
  { step: "04", title: "Prioritisation", desc: "High / Medium / Low queue generation", icon: "📊", color: "#d946ef" },
  { step: "05", title: "Explainability", desc: "Natural-language per-container reason", icon: "💬", color: "#ec4899" },
  { step: "06", title: "Officer Action", desc: "Physical inspection or clearance", icon: "✅", color: "#f43f5e" },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 75 ? "#ef4444" : s >= 50 ? "#f97316" : s >= 25 ? "#f59e0b" : "#10b981";
const scoreLabel = (s) => s >= 50 ? "CRITICAL" : s >= 20 ? "LOW RISK" : "CLEAR";
const fmt = (n) => n.toLocaleString();

function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1200;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{prefix}{typeof value === 'number' && !Number.isInteger(value) ? display.toFixed(decimals) : Math.round(display).toLocaleString()}{suffix}</span>;
}

function Pulse({ color = "#ef4444" }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span style={{ backgroundColor: color }} className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"></span>
      <span style={{ backgroundColor: color }} className="relative inline-flex rounded-full h-2.5 w-2.5"></span>
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f1117", border: "1px solid #1e2433", borderRadius: 8, padding: "8px 14px" }}>
      <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#f8fafc", fontFamily: "monospace", fontSize: 13 }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setTimeout(() => setLoaded(true), 100); }, []);

  const filteredContainers = TOP_CONTAINERS.filter(c =>
    c.id.includes(searchTerm) || c.origin.includes(searchTerm.toUpperCase()) || c.hs.includes(searchTerm)
  );

  const tabs = [
    { id: "overview",   label: "Overview",          icon: "◈" },
    { id: "queue",      label: "Inspection Queue",  icon: "⚑" },
    { id: "analysis",   label: "Feature Analysis",  icon: "⊞" },
    { id: "workflow",   label: "System Design",     icon: "⬡" },
    { id: "model",      label: "Model Info",        icon: "◎" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #060810 0%, #0a0d18 50%, #060810 100%)",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      color: "#e2e8f0",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(6,8,16,0.95)",
        borderBottom: "1px solid #1e2433",
        backdropFilter: "blur(20px)",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, #ef4444, #f97316)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, boxShadow: "0 0 20px rgba(239,68,68,0.4)",
            }}>⚡</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", color: "#f8fafc" }}>
                SMARTCONTAINER
              </div>
              <div style={{ fontSize: 10, color: "#6366f1", letterSpacing: "0.2em" }}>
                RISK INTELLIGENCE ENGINE v1.0
              </div>
            </div>
          </div>

          <nav style={{ display: "flex", gap: 4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, letterSpacing: "0.08em", fontFamily: "inherit",
                background: activeTab === t.id ? "rgba(99,102,241,0.2)" : "transparent",
                color: activeTab === t.id ? "#818cf8" : "#64748b",
                borderBottom: activeTab === t.id ? "2px solid #6366f1" : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                <span style={{ marginRight: 5 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Pulse color="#10b981" />
            <span style={{ fontSize: 11, color: "#10b981", letterSpacing: "0.1em" }}>LIVE</span>
            <div style={{ width: 1, height: 20, background: "#1e2433" }} />
            <span style={{ fontSize: 11, color: "#475569" }}>8,481 CONTAINERS PROCESSED</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "24px", position: "relative", zIndex: 1 }}>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "CONTAINERS PROCESSED", value: 8481, color: "#6366f1", icon: "📦" },
                { label: "CRITICAL RISK", value: 73, color: "#ef4444", icon: "🚨", sub: "0.9%" },
                { label: "LOW RISK", value: 1754, color: "#f59e0b", icon: "⚠️", sub: "20.7%" },
                { label: "CLEARED", value: 6654, color: "#10b981", icon: "✅", sub: "78.5%" },
                { label: "ANOMALIES", value: 1049, color: "#a855f7", icon: "🔍", sub: "12.4%" },
                { label: "AUC-ROC SCORE", value: 1.0, decimals: 4, color: "#06b6d4", icon: "◎", sub: "PERFECT" },
              ].map((kpi, i) => (
                <div key={i} style={{
                  background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: "16px",
                  border: `1px solid ${kpi.color}22`,
                  boxShadow: `0 0 20px ${kpi.color}08`,
                  opacity: loaded ? 1 : 0,
                  transform: loaded ? "translateY(0)" : "translateY(12px)",
                  transition: `all 0.4s ease ${i * 0.08}s`,
                }}>
                  <div style={{ fontSize: 18, marginBottom: 8 }}>{kpi.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, letterSpacing: "-0.02em" }}>
                    <AnimatedNumber value={kpi.value} decimals={kpi.decimals || 0} />
                  </div>
                  <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", marginTop: 4 }}>{kpi.label}</div>
                  {kpi.sub && <div style={{ fontSize: 10, color: kpi.color, marginTop: 2, opacity: 0.8 }}>{kpi.sub}</div>}
                </div>
              ))}
            </div>

            {/* Charts Row 1 */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Score Distribution */}
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>RISK SCORE DISTRIBUTION</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={SCORE_DIST} barCategoryGap="20%">
                    <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[3,3,0,0]}>
                      {SCORE_DIST.map((entry, i) => (
                        <Cell key={i} fill={
                          entry.range.startsWith("7") || entry.range.startsWith("8") || entry.range.startsWith("9") ? "#ef4444" :
                          entry.range.startsWith("5") || entry.range.startsWith("6") ? "#f97316" :
                          entry.range.startsWith("2") || entry.range.startsWith("3") || entry.range.startsWith("4") ? "#f59e0b" :
                          "#6366f1"
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie breakdown */}
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 8 }}>RISK LEVEL BREAKDOWN</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={RISK_PIE} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" paddingAngle={2}>
                      {RISK_PIE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {RISK_PIE.map(r => (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#94a3b8", flex: 1 }}>{r.name}</span>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: r.color }}>{r.value.toLocaleString()}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>avg {r.avg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Dwell time */}
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>AVG DWELL TIME (HOURS)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={DWELL_DATA}>
                    <XAxis dataKey="level" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="dwell" name="Hours" radius={[4,4,0,0]}>
                      {DWELL_DATA.map((d,i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 8 }}>
                  Critical containers dwell <span style={{ color: "#ef4444" }}>1.85×</span> longer than cleared
                </div>
              </div>

              {/* Weight discrepancy */}
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>AVG WEIGHT DISCREPANCY (%)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={DWELL_DATA}>
                    <XAxis dataKey="level" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="wt" name="Wt Diff %" radius={[4,4,0,0]}>
                      {DWELL_DATA.map((d,i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 8 }}>
                  Critical containers show <span style={{ color: "#ef4444" }}>9.2×</span> higher weight variance
                </div>
              </div>

              {/* Critical by origin */}
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 12 }}>CRITICAL CONTAINERS BY ORIGIN</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {ORIGIN_DATA.filter(o => o.critical > 0).map(o => (
                    <div key={o.country} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{o.flag}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8", width: 28 }}>{o.country}</span>
                      <div style={{ flex: 1, height: 6, background: "#1e2433", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(o.critical / 48) * 100}%`, background: "#ef4444", borderRadius: 3, transition: "width 1s ease" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#ef4444", fontFamily: "monospace", width: 20, textAlign: "right" }}>{o.critical}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* HS Chapter Risk */}
            <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>HIGH-RISK HS CHAPTERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 10 }}>
                {HS_DATA.map(h => (
                  <div key={h.ch} style={{ background: "#0a0d18", borderRadius: 8, padding: 12, border: `1px solid ${h.color}33`, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: h.color, fontFamily: "monospace" }}>CH.{h.ch}</div>
                    <div style={{ fontSize: 9, color: "#64748b", margin: "4px 0", lineHeight: 1.3 }}>{h.name}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>{h.critical}</div>
                    <div style={{ fontSize: 9, color: "#475569" }}>critical</div>
                    <div style={{ marginTop: 6, height: 3, background: "#1e2433", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(h.critical / 14) * 100}%`, background: h.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INSPECTION QUEUE TAB ─────────────────────────────────────────── */}
        {activeTab === "queue" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", letterSpacing: "0.05em" }}>
                  🚨 PRIORITY INSPECTION QUEUE
                </h2>
                <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  Top {TOP_CONTAINERS.length} critical containers — all flagged by Isolation Forest anomaly detection
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search ID / Origin / HS..."
                  style={{
                    background: "#0a0d18", border: "1px solid #1e2433", borderRadius: 8,
                    padding: "8px 14px", color: "#e2e8f0", fontSize: 12, fontFamily: "inherit",
                    outline: "none", width: 220,
                  }}
                />
                <div style={{ padding: "6px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 11, color: "#ef4444" }}>
                  {filteredContainers.length} HIGH RISK
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, border: "1px solid #1e2433", overflow: "hidden" }}>
              {/* Table header */}
              <div style={{
                display: "grid", gridTemplateColumns: "32px 110px 110px 80px 60px 70px 80px 70px 70px 1fr",
                gap: 8, padding: "10px 16px",
                background: "#0a0d18", borderBottom: "1px solid #1e2433",
                fontSize: 9, color: "#475569", letterSpacing: "0.15em",
              }}>
                <span>#</span>
                <span>CONTAINER ID</span>
                <span>RISK SCORE</span>
                <span>P(CRIT)</span>
                <span>ORIGIN</span>
                <span>HS CODE</span>
                <span>DWELL (H)</span>
                <span>WT DIFF</span>
                <span>ANOMALY</span>
                <span>EXPLANATION</span>
              </div>

              {filteredContainers.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedContainer(selectedContainer?.id === c.id ? null : c)}
                  style={{
                    display: "grid", gridTemplateColumns: "32px 110px 110px 80px 60px 70px 80px 70px 70px 1fr",
                    gap: 8, padding: "12px 16px", cursor: "pointer",
                    borderBottom: "1px solid #0f1117",
                    background: selectedContainer?.id === c.id ? "rgba(99,102,241,0.08)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#475569" }}>{i + 1}</span>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#22d3ee" }}>{c.id}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 40, height: 5, background: "#1e2433", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${c.score}%`, background: scoreColor(c.score), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: scoreColor(c.score), fontFamily: "monospace" }}>{c.score}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#ef4444", fontFamily: "monospace" }}>{c.pcrit}%</span>
                  <span style={{
                    fontSize: 11, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace",
                    background: "rgba(99,102,241,0.15)", color: "#818cf8", width: "fit-content",
                  }}>{c.origin}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{c.hs}</span>
                  <span style={{
                    fontSize: 12, fontFamily: "monospace",
                    color: c.dwell > 150 ? "#ef4444" : c.dwell > 100 ? "#f97316" : "#f59e0b",
                  }}>{c.dwell}h</span>
                  <span style={{ fontSize: 12, color: "#f97316", fontFamily: "monospace" }}>{c.wt.toFixed(1)}%</span>
                  <span style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: c.anom ? "rgba(168,85,247,0.2)" : "transparent",
                    color: c.anom ? "#c084fc" : "#475569",
                  }}>{c.anom ? "⚠ FLAGGED" : "—"}</span>
                  <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.exp}</span>
                </div>
              ))}
            </div>

            {/* Expanded detail */}
            {selectedContainer && (
              <div style={{
                marginTop: 16, background: "rgba(99,102,241,0.06)", borderRadius: 12,
                border: "1px solid rgba(99,102,241,0.3)", padding: 20,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#818cf8", marginBottom: 4 }}>
                      CONTAINER {selectedContainer.id} — RISK PROFILE
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Detailed risk assessment breakdown</div>
                  </div>
                  <div style={{
                    fontSize: 28, fontWeight: 800, color: scoreColor(selectedContainer.score),
                    fontFamily: "monospace", lineHeight: 1,
                  }}>
                    {selectedContainer.score}
                    <span style={{ fontSize: 12, color: "#475569", fontWeight: 400, marginLeft: 4 }}>/100</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginTop: 16 }}>
                  {[
                    { label: "P(Critical)", value: `${selectedContainer.pcrit}%`, color: "#ef4444" },
                    { label: "Origin",       value: selectedContainer.origin, color: "#818cf8" },
                    { label: "HS Code",      value: selectedContainer.hs, color: "#94a3b8" },
                    { label: "Dwell Time",   value: `${selectedContainer.dwell}h`, color: selectedContainer.dwell > 150 ? "#ef4444" : "#f97316" },
                    { label: "Weight Diff",  value: `${selectedContainer.wt.toFixed(1)}%`, color: "#f97316" },
                    { label: "Anomaly",      value: selectedContainer.anom ? "FLAGGED" : "NONE", color: selectedContainer.anom ? "#c084fc" : "#475569" },
                  ].map(item => (
                    <div key={item.label} style={{ background: "#0a0d18", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.15em", marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: 12, background: "#0a0d18", borderRadius: 8, border: "1px solid #1e2433" }}>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.15em", marginBottom: 6 }}>EXPLANATION</div>
                  <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.6 }}>{selectedContainer.exp}</div>
                </div>
              </div>
            )}

            {/* Summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 16 }}>
              {[
                { label: "All Critical Anomalies", value: "100%", color: "#c084fc", desc: "All 15 top containers flagged by Isolation Forest" },
                { label: "Avg Critical Score", value: "74.8", color: "#ef4444", desc: "vs 17.4 Low Risk, 5.0 Clear" },
                { label: "Avg Critical Dwell", value: "75.3h", color: "#f97316", desc: "vs 40.7h for cleared containers" },
                { label: "Avg Weight Excess", value: "22.9%", color: "#f59e0b", desc: "vs 2.5% for cleared containers" },
              ].map(s => (
                <div key={s.label} style={{ background: "rgba(15,17,23,0.8)", borderRadius: 10, padding: 14, border: "1px solid #1e2433" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FEATURE ANALYSIS TAB ─────────────────────────────────────────── */}
        {activeTab === "analysis" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Feature importance */}
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>RANDOM FOREST — FEATURE IMPORTANCE (TOP 10 of 30)</div>
                {FEATURES.map((f, i) => (
                  <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: "#475569", width: 20, textAlign: "right" }}>{i + 1}</span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", width: 180, flexShrink: 0 }}>{f.name}</span>
                    <div style={{ flex: 1, height: 8, background: "#1e2433", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${(f.importance / 36.45) * 100}%`,
                        background: f.group === "Weight" ? "#ef4444" : f.group === "Behaviour" ? "#a855f7" : f.group === "Dwell" ? "#06b6d4" : f.group === "HS Code" ? "#10b981" : "#6366f1",
                        borderRadius: 4, transition: "width 1s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#f8fafc", width: 40, textAlign: "right" }}>{f.importance}%</span>
                    <span style={{
                      fontSize: 9, padding: "2px 6px", borderRadius: 4, width: 70, textAlign: "center",
                      background: f.group === "Weight" ? "rgba(239,68,68,0.15)" : f.group === "Behaviour" ? "rgba(168,85,247,0.15)" : f.group === "Dwell" ? "rgba(6,182,212,0.15)" : "rgba(99,102,241,0.15)",
                      color: f.group === "Weight" ? "#f87171" : f.group === "Behaviour" ? "#c084fc" : f.group === "Dwell" ? "#22d3ee" : "#818cf8",
                    }}>{f.group}</span>
                  </div>
                ))}
              </div>

              {/* Anomaly breakdown */}
              <div>
                <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>ANOMALY DETECTION — 3 SIGNAL TYPES</div>
                  {[
                    { type: "Weight Discrepancy", count: 25, pct: 2.4, color: "#f97316", desc: "|Measured − Declared| > 25%" },
                    { type: "Value-to-Weight", count: 267, pct: 25.5, color: "#a855f7", desc: "Z-score > 2.5σ from HS chapter median" },
                    { type: "Behavioural", count: 458, pct: 43.7, color: "#ef4444", desc: "Importer crit rate >5% or Country crit rate >3%" },
                  ].map(a => (
                    <div key={a.type} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#e2e8f0" }}>{a.type}</span>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: a.color }}>{a.count.toLocaleString()} ({a.pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: "#1e2433", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ height: "100%", width: `${a.pct}%`, background: a.color, borderRadius: 3, transition: "width 1s ease" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#475569" }}>{a.desc}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: 10, background: "#0a0d18", borderRadius: 8, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
                    <span style={{ color: "#a855f7" }}>Isolation Forest</span> — 300 trees, 12% contamination → <span style={{ color: "#a855f7" }}>1,049 anomalies (12.4%)</span>
                  </div>
                </div>

                <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 12 }}>KEY INSIGHT</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { label: "Weight features combined", value: "56.95%", color: "#ef4444", desc: "of total importance" },
                      { label: "Importer history signal", value: "9.96%", color: "#a855f7", desc: "highly predictive" },
                      { label: "Crit vs Clear wt diff", value: "9.2×", color: "#f97316", desc: "22.9% vs 2.5%" },
                      { label: "Anomaly-Critical overlap", value: "100%", color: "#22d3ee", desc: "top 15 all flagged" },
                    ].map(k => (
                      <div key={k.label} style={{ background: "#0a0d18", borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{k.label}</div>
                        <div style={{ fontSize: 10, color: "#475569" }}>{k.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Feature group breakdown */}
            <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>ALL 30 ENGINEERED FEATURES</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
                {[
                  { group: "Weight (6)", color: "#ef4444", features: ["weight_diff_abs","weight_diff_pct","weight_ratio","weight_over_flag","weight_under_flag","weight_large_disc"] },
                  { group: "Value (5)", color: "#f59e0b", features: ["value_per_kg","log_value_per_kg","log_declared_value","very_low_value","high_value"] },
                  { group: "Value-Wt (2)", color: "#a855f7", features: ["vpw_zscore","vpw_outlier"] },
                  { group: "Dwell (4)", color: "#06b6d4", features: ["dwell_time","log_dwell","long_dwell_flag","very_long_dwell_flag"] },
                  { group: "Time (2)", color: "#6366f1", features: ["decl_hour","night_decl_flag"] },
                  { group: "HS Code (2)", color: "#10b981", features: ["hs_chapter","hs_crit_rate"] },
                  { group: "Trade (2)", color: "#22c55e", features: ["is_transit","is_export"] },
                  { group: "Behaviour (3)", color: "#ec4899", features: ["country_crit_rate","importer_crit_rate","exporter_crit_rate"] },
                  { group: "Shipping (2)", color: "#f97316", features: ["shipping_freq","rare_shipping_line"] },
                  { group: "Other (2+)", color: "#94a3b8", features: ["dest_port_enc","multi_risk_score"] },
                ].map(g => (
                  <div key={g.group} style={{ background: "#0a0d18", borderRadius: 8, padding: 12, border: `1px solid ${g.color}22` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: g.color, marginBottom: 8, letterSpacing: "0.05em" }}>{g.group}</div>
                    {g.features.map(f => (
                      <div key={f} style={{ fontSize: 9, color: "#64748b", marginBottom: 3, fontFamily: "monospace" }}>{f}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── WORKFLOW / SYSTEM DESIGN TAB ──────────────────────────────────── */}
        {activeTab === "workflow" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", letterSpacing: "0.05em" }}>CUSTOMS INTEGRATION DESIGN</h2>
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>How SmartContainer plugs into a real-world customs workflow</p>
            </div>

            {/* Workflow pipeline */}
            <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 28, border: "1px solid #1e2433", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {WORKFLOW_STEPS.map((s, i) => (
                  <div key={s.step} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: "50%", margin: "0 auto 10px",
                        background: `${s.color}22`, border: `2px solid ${s.color}`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                        boxShadow: `0 0 20px ${s.color}33`,
                      }}>{s.icon}</div>
                      <div style={{ fontSize: 9, color: s.color, letterSpacing: "0.1em", marginBottom: 4 }}>STEP {s.step}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>{s.title}</div>
                      <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>{s.desc}</div>
                    </div>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <div style={{ color: "#1e2433", fontSize: 20, margin: "0 4px", flexShrink: 0 }}>→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* REST API endpoints */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>REST API ENDPOINTS</div>
                {[
                  { method: "GET",  path: "/health",     desc: "Health check & model status",       color: "#10b981" },
                  { method: "GET",  path: "/stats",      desc: "Aggregate statistics dashboard",    color: "#10b981" },
                  { method: "POST", path: "/predict",    desc: "Single container risk scoring",     color: "#6366f1" },
                  { method: "POST", path: "/batch",      desc: "Batch scoring (up to 10K, JSON)",   color: "#6366f1" },
                  { method: "POST", path: "/batch-csv",  desc: "Batch scoring from CSV upload",     color: "#6366f1" },
                ].map(ep => (
                  <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", background: "#0a0d18", borderRadius: 6 }}>
                    <span style={{
                      fontSize: 9, fontFamily: "monospace", fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: ep.color === "#10b981" ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
                      color: ep.color, width: 36, textAlign: "center",
                    }}>{ep.method}</span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#22d3ee", flex: 1 }}>{ep.path}</span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>{ep.desc}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>DEPLOYMENT OPTIONS</div>
                {[
                  { title: "Direct Python", cmd: "python risk_engine.py", color: "#10b981" },
                  { title: "Flask API", cmd: "python api.py", color: "#6366f1" },
                  { title: "Docker Build", cmd: "docker build -t smartcontainer .", color: "#06b6d4" },
                  { title: "Docker Run", cmd: "docker run -p 5000:5000 -v ./data:/app smartcontainer", color: "#06b6d4" },
                  { title: "Docker Compose", cmd: "docker-compose up --build", color: "#a855f7" },
                ].map(d => (
                  <div key={d.title} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{d.title}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: d.color, background: "#0a0d18", padding: "8px 12px", borderRadius: 6, border: "1px solid #1e2433" }}>
                      $ {d.cmd}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample API payload */}
            <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>SAMPLE API INTERACTION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#6366f1", marginBottom: 8 }}>POST /predict — REQUEST</div>
                  <pre style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", background: "#0a0d18", padding: 14, borderRadius: 8, border: "1px solid #1e2433", overflow: "auto" }}>{`{
  "Container_ID":     "CONT_99121",
  "Declared_Weight":  1200.0,
  "Measured_Weight":  1620.0,
  "Declared_Value":   8500.0,
  "Dwell_Time_Hours": 134.5,
  "Origin_Country":   "CN",
  "HS_Code":          "850340",
  "Importer_ID":      "IMP_9912",
  "Trade_Regime":     "Import",
  "Declaration_Time": "02:17:00"
}`}</pre>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#10b981", marginBottom: 8 }}>200 OK — RESPONSE</div>
                  <pre style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", background: "#0a0d18", padding: 14, borderRadius: 8, border: "1px solid #1e2433", overflow: "auto" }}>{`{
  "Container_ID":      "CONT_99121",
  "Risk_Score":        81.4,
  "Risk_Level":        "High",
  "Risk_Level_Binary": "Critical",
  "P_Clear":           0.0002,
  "P_Low_Risk":        0.0031,
  "P_Critical":        0.9967,
  "Anomaly_Flag":      1,
  "Anomaly_Score":     0.8832,
  "Explanation_Summary":
    "Weight excess 35%; Extended dwell 135h;
     Off-hours declaration 02:17"
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODEL INFO TAB ───────────────────────────────────────────────── */}
        {activeTab === "model" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Architecture */}
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>MODEL ARCHITECTURE</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Primary Model", value: "Random Forest", color: "#6366f1" },
                    { label: "Anomaly Model", value: "Isolation Forest", color: "#a855f7" },
                    { label: "RF Trees", value: "400", color: "#818cf8" },
                    { label: "ISO Trees", value: "300", color: "#c084fc" },
                    { label: "Max Depth", value: "12", color: "#818cf8" },
                    { label: "Contamination", value: "12%", color: "#c084fc" },
                    { label: "Critical Weight", value: "15×", color: "#ef4444" },
                    { label: "Training Records", value: "54,000", color: "#10b981" },
                    { label: "Test Split", value: "15%", color: "#06b6d4" },
                    { label: "RF Blend", value: "70%", color: "#6366f1" },
                    { label: "ISO Blend", value: "30%", color: "#a855f7" },
                    { label: "Features", value: "30", color: "#f59e0b" },
                  ].map(m => (
                    <div key={m.label} style={{ background: "#0a0d18", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em" }}>{m.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: "monospace", marginTop: 2 }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance */}
              <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>MODEL PERFORMANCE (TEST SET)</div>
                {[
                  { label: "AUC-ROC (All Classes)", value: "1.0000", color: "#10b981", pct: 100 },
                  { label: "Test Accuracy", value: "99.88%", color: "#22d3ee", pct: 99.88 },
                  { label: "Precision (Critical)", value: "100%", color: "#6366f1", pct: 100 },
                  { label: "Recall (Critical)", value: "99%", color: "#a855f7", pct: 99 },
                  { label: "F1 Score (Critical)", value: "0.9939", color: "#ef4444", pct: 99.39 },
                ].map(p => (
                  <div key={p.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{p.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: p.color, fontFamily: "monospace" }}>{p.value}</span>
                    </div>
                    <div style={{ height: 6, background: "#1e2433", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${p.pct}%`, background: p.color, borderRadius: 3, transition: "width 1.2s ease" }} />
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 16, padding: 12, background: "#0a0d18", borderRadius: 8, border: "1px solid #1e2433" }}>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", marginBottom: 6 }}>RISK SCORE FORMULA</div>
                  <pre style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", lineHeight: 1.8, margin: 0 }}>
{`Risk_Score = (`}
<span style={{ color: "#6366f1" }}>0.70 × P(Critical)</span>{` × 100
           + `}
<span style={{ color: "#a855f7" }}>0.70 × P(Low Risk)</span>{` × 40
           + `}
<span style={{ color: "#c084fc" }}>0.30 × Anomaly_Score</span>{` × 100
           ) ÷ 1.70`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Dataset summary */}
            <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>DATASET SUMMARY</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12 }}>
                {[
                  { label: "Historical Training", value: "54,000", sub: "labelled records", color: "#6366f1" },
                  { label: "Real-Time Batch", value: "8,481", sub: "scored containers", color: "#06b6d4" },
                  { label: "Clear (Historical)", value: "78.4%", sub: "42,347 records", color: "#10b981" },
                  { label: "Low Risk (Hist.)", value: "20.6%", sub: "11,108 records", color: "#f59e0b" },
                  { label: "Critical (Hist.)", value: "1.0%", sub: "545 records", color: "#ef4444" },
                  { label: "Date Range", value: "2020–21", sub: "historical period", color: "#94a3b8" },
                ].map(d => (
                  <div key={d.label} style={{ background: "#0a0d18", borderRadius: 8, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: d.color, fontFamily: "monospace" }}>{d.value}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{d.label}</div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{d.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech stack */}
            <div style={{ background: "rgba(15,17,23,0.8)", borderRadius: 12, padding: 20, border: "1px solid #1e2433" }}>
              <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>TECH STACK & DELIVERABLES</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#6366f1", marginBottom: 10 }}>PYTHON STACK</div>
                  {["pandas 2.x — data processing","numpy — feature computation","scikit-learn — RF + Isolation Forest","flask — REST API server","gunicorn — production WSGI"].map(t => (
                    <div key={t} style={{ fontSize: 11, color: "#64748b", marginBottom: 6, display: "flex", gap: 8 }}>
                      <span style={{ color: "#6366f1" }}>▸</span> {t}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#10b981", marginBottom: 10 }}>DELIVERABLES</div>
                  {[
                    "risk_engine.py — ML batch pipeline",
                    "api.py — Flask REST API (5 endpoints)",
                    "Dockerfile + docker-compose.yml",
                    "requirements.txt",
                    "SmartContainer_Dashboard.jsx",
                    "risk_predictions.csv (8,481 rows)",
                    "summary_report.json",
                    "SmartContainer_Presentation.pptx",
                    "README.md",
                  ].map(t => (
                    <div key={t} style={{ fontSize: 11, color: "#64748b", marginBottom: 5, display: "flex", gap: 8 }}>
                      <span style={{ color: "#10b981" }}>✓</span> {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
