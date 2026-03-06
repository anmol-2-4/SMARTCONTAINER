import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ── REAL DATA ─────────────────────────────────────────────────────────────────
const DEFAULT_STATS = {
  total: 8481, critical: 73, lowRisk: 1754, clear: 6654, anomalies: 1049,
  aucRoc: 1.0000, accuracy: 99.88, precision: 100, recall: 99, f1: 0.99,
  trainSize: 54000,
};
const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const NEW_CONTAINER_TEMPLATE = {
  Container_ID: "NEW_001",
  Declared_Weight: "1200",
  Measured_Weight: "1500",
  Declared_Value: "8500",
  Dwell_Time_Hours: "72",
  Origin_Country: "CN",
  HS_Code: "850340",
  Importer_ID: "IMP9912",
  Exporter_ID: "EXP0044",
  Shipping_Line: "LINE_MODE_40",
  Trade_Regime: "Import",
  Destination_Port: "PORT_40",
  Declaration_Time: "02:17:00",
};
const FEEDBACK_TEMPLATE = {
  Container_ID: "",
  Predicted_Level_Binary: "Critical",
  Officer_Outcome: "Low Risk",
  Action_Taken: "Document review",
  Officer_ID: "OFFICER_01",
  Comment: "",
};
const COUNTRY_NAME_BY_CODE = {
  CN: "China",
  JP: "Japan",
  US: "United States",
  DE: "Germany",
  KR: "South Korea",
  SG: "Singapore",
  TH: "Thailand",
  CA: "Canada",
  GB: "United Kingdom",
  VN: "Vietnam",
  FR: "France",
  RO: "Romania",
  PH: "Philippines",
};

const DEFAULT_SCORE_DIST = [
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

const DEFAULT_DWELL_DATA = [
  { level: "Clear",    dwell: 40.7, wt: 2.5,  color: "#10b981" },
  { level: "Low Risk", dwell: 50.4, wt: 10.9, color: "#f59e0b" },
  { level: "Critical", dwell: 75.3, wt: 22.9, color: "#ef4444" },
];

const DEFAULT_ORIGIN_DATA = [
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

const DEFAULT_HS_DATA = [
  { ch: "84", name: "Machinery", total: 640,  critical: 14, color: "#ef4444" },
  { ch: "85", name: "Electronics", total: 987, critical: 12, color: "#f97316" },
  { ch: "95", name: "Toys/Games", total: 296, critical: 12, color: "#f59e0b" },
  { ch: "90", name: "Optics/Medical", total: 424, critical: 6, color: "#eab308" },
  { ch: "62", name: "Clothing (woven)", total: 509, critical: 3, color: "#84cc16" },
  { ch: "87", name: "Vehicles", total: 58,  critical: 2, color: "#22c55e" },
  { ch: "82", name: "Tools/Cutlery", total: 44,  critical: 2, color: "#10b981" },
  { ch: "44", name: "Wood/Timber", total: 52,  critical: 2, color: "#06b6d4" },
];

const DEFAULT_FEATURES = [
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

const DEFAULT_TOP_CONTAINERS = [
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
const fmt = (n) => n.toLocaleString();
const formatCountry = (code) => {
  const c = String(code || "").toUpperCase();
  const name = COUNTRY_NAME_BY_CODE[c] || c;
  return `${name} (${c})`;
};

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
      <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>{label}</p>
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
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [newContainer, setNewContainer] = useState(NEW_CONTAINER_TEMPLATE);
  const [predictResult, setPredictResult] = useState(null);
  const [predictError, setPredictError] = useState("");
  const [predictLoading, setPredictLoading] = useState(false);
  const [networkData, setNetworkData] = useState({ nodes: [], edges: [] });
  const [networkError, setNetworkError] = useState("");
  const [feedbackForm, setFeedbackForm] = useState(FEEDBACK_TEMPLATE);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [driftData, setDriftData] = useState(null);
  const [thresholdData, setThresholdData] = useState(null);
  const [opsStatus, setOpsStatus] = useState("");
  const [apiHealth, setApiHealth] = useState({ status: "unknown", model_ready: false, train_size: 0 });
  const [lastStatsSyncAt, setLastStatsSyncAt] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("dashboard_theme") || "dark");
  const [summaryData, setSummaryData] = useState(null);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);

    let cancelled = false;
    const loadStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/stats`);
        if (!res.ok) throw new Error("Stats endpoint unavailable");
        const data = await res.json();
        if (cancelled) return;

        const rtDist = data.rt_actual_dist || {};
        const total = Number(data.batch_size || DEFAULT_STATS.total);
        const critical = Number(rtDist.Critical || data.critical_2level || DEFAULT_STATS.critical);
        const lowRisk = Number(rtDist["Low Risk"] || data.low_risk || DEFAULT_STATS.lowRisk);
        const clear = Number(rtDist.Clear || Math.max(total - critical - lowRisk, 0));
        const anomalies = Number(data.anomalies_total || DEFAULT_STATS.anomalies);
        const aucRoc = Number((data.model_auc || {}).Critical || DEFAULT_STATS.aucRoc);
        const trainSize = Number(data.hist_size || DEFAULT_STATS.trainSize);

        setStats((prev) => ({
          ...prev,
          total,
          critical,
          lowRisk,
          clear,
          anomalies,
          aucRoc,
          trainSize,
        }));
        setSummaryData(data);
        setStatsError("");
        setLastStatsSyncAt(new Date());
      } catch (_err) {
        if (!cancelled) setStatsError("Unable to load live stats. Showing fallback values.");
      }
    };

    const loadHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (!res.ok) throw new Error("Health endpoint unavailable");
        const data = await res.json();
        if (cancelled) return;
        setApiHealth({
          status: data.status || "unknown",
          model_ready: !!data.model_ready,
          train_size: Number(data.train_size || 0),
        });
      } catch (_err) {
        if (!cancelled) {
          setApiHealth({ status: "down", model_ready: false, train_size: 0 });
        }
      }
    };

    loadStats();
    loadHealth();
    const healthTimer = setInterval(loadHealth, 15000);
    return () => {
      cancelled = true;
      clearInterval(healthTimer);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("dashboard_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (activeTab !== "workflow") return;

    const loadNetwork = async () => {
      try {
        const res = await fetch(`${API_BASE}/network`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load network");
        setNetworkData({
          nodes: data.nodes || [],
          edges: data.edges || [],
        });
        setNetworkError("");
      } catch (err) {
        setNetworkError(err.message || "Unable to load network");
      }
    };

    const loadFeedbackStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/feedback-stats`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load feedback stats");
        setFeedbackStats(data);
      } catch (_err) {
        // Keep null if not available.
      }
    };

    const loadDrift = async () => {
      try {
        const res = await fetch(`${API_BASE}/drift`);
        const data = await res.json();
        if (res.ok) setDriftData(data);
      } catch (_err) {
        // Keep previous data.
      }
    };

    const loadThreshold = async () => {
      try {
        const res = await fetch(`${API_BASE}/threshold-analysis`);
        const data = await res.json();
        if (res.ok) setThresholdData(data);
      } catch (_err) {
        // Keep previous data.
      }
    };

    loadNetwork();
    loadFeedbackStats();
    loadDrift();
    loadThreshold();
  }, [activeTab]);

  const scoreDist = summaryData?.score_buckets ? [
    { range: "0–10", count: Number(summaryData.score_buckets["0-10"] || 0), label: "Very Low" },
    { range: "10–25", count: Number(summaryData.score_buckets["10-25"] || 0), label: "Low" },
    { range: "25–50", count: Number(summaryData.score_buckets["25-50"] || 0), label: "Medium" },
    { range: "50–75", count: Number(summaryData.score_buckets["50-75"] || 0), label: "High" },
    { range: "75–100", count: Number(summaryData.score_buckets["75-100"] || 0), label: "Critical" },
  ] : DEFAULT_SCORE_DIST;
  const dwellData = summaryData?.dwell_avg ? [
    { level: "Low", dwell: Number(summaryData.dwell_avg.Low || 0), wt: Number((summaryData.weight_diff_avg || {}).Low || 0) * 100, color: "#10b981" },
    { level: "Medium", dwell: Number(summaryData.dwell_avg.Medium || 0), wt: Number((summaryData.weight_diff_avg || {}).Medium || 0) * 100, color: "#f59e0b" },
    { level: "High", dwell: Number(summaryData.dwell_avg.High || 0), wt: Number((summaryData.weight_diff_avg || {}).High || 0) * 100, color: "#ef4444" },
  ] : DEFAULT_DWELL_DATA;
  const originData = (summaryData?.origin_risk || []).length
    ? summaryData.origin_risk.map((o) => ({ country: o.Origin_Country, total: o.count, critical: o.high, critPct: o.count ? (o.high / o.count) * 100 : 0, flag: "" }))
    : DEFAULT_ORIGIN_DATA;
  const hsData = (summaryData?.hs_risk || []).length
    ? summaryData.hs_risk.map((h, idx) => ({ ch: h.hs_ch, name: "HS Chapter", total: h.count, critical: h.high, color: ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e"][idx % 6] }))
    : DEFAULT_HS_DATA;
  const featuresData = (summaryData?.top_features || []).length
    ? summaryData.top_features.map((f) => ({
      name: f.name,
      importance: Number(f.importance) <= 1 ? Number(f.importance) * 100 : Number(f.importance),
      group: f.name.includes("weight") ? "Weight" : f.name.includes("dwell") ? "Dwell" : f.name.includes("crit") ? "Behaviour" : "Composite",
    }))
    : DEFAULT_FEATURES;
  const topContainers = (summaryData?.top_high_risk || []).length
    ? summaryData.top_high_risk.map((c) => ({
      id: String(c.Container_ID),
      score: Number(c.Risk_Score || 0),
      pcrit: Number(c.P_Critical || 0) * 100,
      origin: String(c.Origin_Country || ""),
      hs: String(c.HS_Code || ""),
      dwell: Number(c.Dwell_Time_Hours || 0),
      wt: Number(c.Weight_Diff_Pct || 0) * 100,
      anom: Number(c.Anomaly_Flag || 0),
      exp: String(c.Explanation_Summary || ""),
    }))
    : DEFAULT_TOP_CONTAINERS;

  const filteredContainers = topContainers.filter(c =>
    c.id.includes(searchTerm) || c.origin.includes(searchTerm.toUpperCase()) || c.hs.includes(searchTerm)
  );
  const pct = (value) => `${((value / Math.max(stats.total, 1)) * 100).toFixed(1)}%`;
  const riskPie = [
    { name: "Clear", value: stats.clear, color: "#10b981", avg: 5.0 },
    { name: "Low Risk", value: stats.lowRisk, color: "#f59e0b", avg: 17.4 },
    { name: "Critical", value: stats.critical, color: "#ef4444", avg: 74.8 },
  ];

  const tabs = [
    { id: "overview",   label: "Overview",          icon: "◈" },
    { id: "check",      label: "Check Container",   icon: "◉" },
    { id: "queue",      label: "Inspection Queue",  icon: "⚑" },
    { id: "analysis",   label: "Feature Analysis",  icon: "⊞" },
    { id: "workflow",   label: "System Design",     icon: "⬡" },
    { id: "model",      label: "Model Info",        icon: "◎" },
  ];

  const updateNewContainerField = (key, value) => {
    setNewContainer((prev) => ({ ...prev, [key]: value }));
  };

  const checkNewContainer = async (e) => {
    e.preventDefault();
    setPredictError("");
    setPredictResult(null);
    setPredictLoading(true);

    const payload = {
      ...newContainer,
      Declared_Weight: Number(newContainer.Declared_Weight),
      Measured_Weight: Number(newContainer.Measured_Weight),
      Declared_Value: Number(newContainer.Declared_Value),
      Dwell_Time_Hours: Number(newContainer.Dwell_Time_Hours),
    };

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Prediction request failed");
      }
      setPredictResult(data);
      setFeedbackForm((prev) => ({
        ...prev,
        Container_ID: data.Container_ID || newContainer.Container_ID,
        Predicted_Level_Binary: data.Risk_Level_Binary || "Critical",
      }));
    } catch (err) {
      setPredictError(err.message || "Unable to connect to API");
    } finally {
      setPredictLoading(false);
    }
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    setFeedbackStatus("");
    setFeedbackLoading(true);
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Feedback submission failed");
      setFeedbackStatus("Feedback saved.");
      const statsRes = await fetch(`${API_BASE}/feedback-stats`);
      const statsData = await statsRes.json();
      if (statsRes.ok) setFeedbackStats(statsData);
    } catch (err) {
      setFeedbackStatus(err.message || "Unable to submit feedback");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const triggerRetrain = async () => {
    setOpsStatus("");
    try {
      const res = await fetch(`${API_BASE}/retrain-trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requested_by: "dashboard", note: "Triggered from workflow panel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retrain trigger failed");
      setOpsStatus(`Retrain queued at ${data.event?.timestamp_utc || "now"}`);
    } catch (err) {
      setOpsStatus(err.message || "Retrain trigger failed");
    }
  };

  const palette = theme === "dark"
    ? {
      bg: "linear-gradient(135deg, #060810 0%, #0b1224 52%, #040712 100%)",
      text: "#e2e8f0",
      headerBg: "rgba(6,8,16,0.95)",
      border: "#1e2433",
      muted: "#64748b",
      accent: "#6366f1",
      panelBg: "linear-gradient(165deg, rgba(13,19,37,0.86) 0%, rgba(9,13,27,0.9) 100%)",
      innerBg: "linear-gradient(165deg, rgba(8,12,24,0.95) 0%, rgba(5,8,18,0.95) 100%)",
      chipBg: "rgba(8,12,25,0.92)",
    }
    : {
      bg: "linear-gradient(135deg, #f8fbff 0%, #e8f0ff 50%, #f6f7ff 100%)",
      text: "#0f172a",
      headerBg: "rgba(247,250,255,0.95)",
      border: "#cbd5e1",
      muted: "#475569",
      accent: "#1d4ed8",
      panelBg: "linear-gradient(165deg, rgba(248,251,255,0.97) 0%, rgba(239,245,255,0.95) 100%)",
      innerBg: "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(245,248,255,0.98) 100%)",
      chipBg: "rgba(241,246,255,0.96)",
    };

  return (
    <div style={{
      minHeight: "100vh",
      background: palette.bg,
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      color: palette.text,
      position: "relative",
      overflow: "hidden",
      transition: "background 0.25s ease, color 0.25s ease",
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
        background: palette.headerBg,
        borderBottom: `1px solid ${palette.border}`,
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
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", color: palette.text }}>
                SMARTCONTAINER
              </div>
              <div style={{ fontSize: 14, color: palette.accent, letterSpacing: "0.2em" }}>
                RISK INTELLIGENCE ENGINE v1.0
              </div>
            </div>
          </div>

          <nav style={{ display: "flex", gap: 4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 13, letterSpacing: "0.08em", fontFamily: "inherit",
                background: activeTab === t.id ? "rgba(99,102,241,0.2)" : "transparent",
                color: activeTab === t.id ? palette.accent : palette.muted,
                borderBottom: activeTab === t.id ? `2px solid ${palette.accent}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                <span style={{ marginRight: 5 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              style={{
                border: `1px solid `,
                borderRadius: 999,
                padding: "4px 10px",
                background: "transparent",
                color: palette.muted,
                fontSize: 14,
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              {theme === "dark" ? "LIGHT MODE" : "DARK MODE"}
            </button>
            <Pulse color="#10b981" />
            <span style={{ fontSize: 13, color: "#10b981", letterSpacing: "0.1em" }}>LIVE</span>
          </div>
        </div>
        <div style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          borderTop: `1px solid ${palette.border}`,
        }}>
          {[
            {
              label: "API",
              value: apiHealth.status === "ok" ? "CONNECTED" : apiHealth.status === "down" ? "OFFLINE" : "CHECKING",
              color: apiHealth.status === "ok" ? "#10b981" : apiHealth.status === "down" ? "#ef4444" : "#f59e0b",
            },
            {
              label: "MODEL",
              value: apiHealth.model_ready ? "READY" : "NOT READY",
              color: apiHealth.model_ready ? "#22d3ee" : "#f97316",
            },
            {
              label: "TRAIN SIZE",
              value: fmt(apiHealth.train_size || stats.trainSize),
              color: "#818cf8",
            },
            {
              label: "LAST DATA SYNC",
              value: lastStatsSyncAt ? lastStatsSyncAt.toLocaleTimeString() : "N/A",
              color: "#94a3b8",
            },
          ].map((item) => (
            <div key={item.label} style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 8px",
              borderRadius: 999,
              background: palette.chipBg,
              border: `1px solid `,
            }}>
              <span style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.08em" }}>{item.label}</span>
              <span style={{ fontSize: 14, color: item.color, fontFamily: "monospace", letterSpacing: "0.06em" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "24px", position: "relative", zIndex: 1 }}>
        {statsError && (
          <div style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(245,158,11,0.45)",
            background: "rgba(245,158,11,0.10)",
            color: "#f59e0b",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}>
            <span>{statsError}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ border: "1px solid #f59e0b", background: "transparent", color: "#f59e0b", borderRadius: 6, padding: "4px 8px", fontSize: 14, cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            {/* KPI Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "CONTAINERS PROCESSED", value: stats.total, color: "#6366f1", icon: "📦" },
                { label: "CRITICAL RISK", value: stats.critical, color: "#ef4444", icon: "🚨", sub: pct(stats.critical) },
                { label: "LOW RISK", value: stats.lowRisk, color: "#f59e0b", icon: "⚠️", sub: pct(stats.lowRisk) },
                { label: "CLEARED", value: stats.clear, color: "#10b981", icon: "✅", sub: pct(stats.clear) },
                { label: "ANOMALIES", value: stats.anomalies, color: "#a855f7", icon: "🔍", sub: pct(stats.anomalies) },
                { label: "AUC-ROC SCORE", value: stats.aucRoc, decimals: 4, color: "#06b6d4", icon: "◎", sub: stats.aucRoc >= 0.99 ? "PERFECT" : "LIVE" },
              ].map((kpi, i) => (
                <div key={i} style={{
                  background: palette.panelBg, borderRadius: 12, padding: "16px",
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
                  <div style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.15em", marginTop: 4 }}>{kpi.label}</div>
                  {kpi.sub && <div style={{ fontSize: 14, color: kpi.color, marginTop: 2, opacity: 0.8 }}>{kpi.sub}</div>}
                </div>
              ))}
            </div>

            {/* Charts Row 1 */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Score Distribution */}
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>RISK SCORE DISTRIBUTION</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreDist} barCategoryGap="20%">
                    <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 14 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 14 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[3,3,0,0]}>
                      {scoreDist.map((entry, i) => (
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
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 8 }}>RISK LEVEL BREAKDOWN</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={riskPie} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" paddingAngle={2}>
                      {riskPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {riskPie.map(r => (
                    <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#94a3b8", flex: 1 }}>{r.name}</span>
                      <span style={{ fontSize: 13, fontFamily: "monospace", color: r.color }}>{r.value.toLocaleString()}</span>
                      <span style={{ fontSize: 14, color: "#475569" }}>avg {r.avg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Dwell time */}
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>AVG DWELL TIME (HOURS)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dwellData}>
                    <XAxis dataKey="level" tick={{ fill: "#64748b", fontSize: 14 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 14 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="dwell" name="Hours" radius={[4,4,0,0]}>
                      {dwellData.map((d,i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
                  Critical containers dwell <span style={{ color: "#ef4444" }}>1.85×</span> longer than cleared
                </div>
              </div>

              {/* Weight discrepancy */}
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>AVG WEIGHT DISCREPANCY (%)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dwellData}>
                    <XAxis dataKey="level" tick={{ fill: "#64748b", fontSize: 14 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 14 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="wt" name="Wt Diff %" radius={[4,4,0,0]}>
                      {dwellData.map((d,i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
                  Critical containers show <span style={{ color: "#ef4444" }}>9.2×</span> higher weight variance
                </div>
              </div>

              {/* Critical by origin */}
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 12 }}>CRITICAL CONTAINERS BY ORIGIN</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {originData.filter(o => o.critical > 0).map(o => (
                    <div key={o.country} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{o.flag}</span>
                      <span style={{ fontSize: 13, color: "#94a3b8", width: 150 }}>{formatCountry(o.country)}</span>
                      <div style={{ flex: 1, height: 6, background: palette.border, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(o.critical / 48) * 100}%`, background: "#ef4444", borderRadius: 3, transition: "width 1s ease" }} />
                      </div>
                      <span style={{ fontSize: 13, color: "#ef4444", fontFamily: "monospace", width: 20, textAlign: "right" }}>{o.critical}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* HS Chapter Risk */}
            <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
              <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>HIGH-RISK HS CHAPTERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 10 }}>
                {hsData.map(h => (
                  <div key={h.ch} style={{ background: palette.innerBg, borderRadius: 8, padding: 12, border: `1px solid ${h.color}33`, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: h.color, fontFamily: "monospace" }}>CH.{h.ch}</div>
                    <div style={{ fontSize: 13, color: "#64748b", margin: "4px 0", lineHeight: 1.3 }}>{h.name}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>{h.critical}</div>
                    <div style={{ fontSize: 13, color: "#475569" }}>critical</div>
                    <div style={{ marginTop: 6, height: 3, background: palette.border, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(h.critical / 14) * 100}%`, background: h.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CHECK CONTAINER TAB ──────────────────────────────────────────── */}
        {activeTab === "check" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", letterSpacing: "0.05em" }}>CHECK NEW CONTAINER</h2>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Run live scoring for a single incoming container via `/predict`.</p>
            </div>

            <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em" }}>LIVE /PREDICT</div>
                <span style={{ fontSize: 14, color: "#64748b" }}>API: {API_BASE}</span>
              </div>

              <form onSubmit={checkNewContainer}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  {[
                    ["Container_ID", "Container ID"],
                    ["Origin_Country", "Origin Country"],
                    ["HS_Code", "HS Code"],
                    ["Importer_ID", "Importer ID"],
                    ["Exporter_ID", "Exporter ID"],
                    ["Shipping_Line", "Shipping Line"],
                    ["Trade_Regime", "Trade Regime"],
                    ["Destination_Port", "Destination Port"],
                    ["Declaration_Time", "Declaration Time"],
                    ["Declared_Weight", "Declared Weight"],
                    ["Measured_Weight", "Measured Weight"],
                    ["Declared_Value", "Declared Value"],
                    ["Dwell_Time_Hours", "Dwell Time Hours"],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.08em" }}>{label}</span>
                      <input
                        value={newContainer[key]}
                        onChange={(e) => updateNewContainerField(key, e.target.value)}
                        style={{
                          background: palette.innerBg,
                          border: `1px solid `,
                          borderRadius: 6,
                          color: palette.text,
                          fontFamily: "monospace",
                          fontSize: 13,
                          padding: "8px 10px",
                        }}
                        required
                      />
                    </label>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                  <button
                    type="submit"
                    disabled={predictLoading}
                    style={{
                      background: predictLoading ? "#334155" : "#6366f1",
                      color: "#f8fafc",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 14px",
                      fontSize: 13,
                      letterSpacing: "0.08em",
                      cursor: predictLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {predictLoading ? "CHECKING..." : "CHECK CONTAINER"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewContainer(NEW_CONTAINER_TEMPLATE);
                      setPredictResult(null);
                      setPredictError("");
                    }}
                    style={{
                      background: "transparent",
                      color: "#94a3b8",
                      border: `1px solid `,
                      borderRadius: 6,
                      padding: "8px 14px",
                      fontSize: 13,
                      letterSpacing: "0.08em",
                      cursor: "pointer",
                    }}
                  >
                    RESET
                  </button>
                </div>
              </form>

              {predictError && (
                <div style={{ marginTop: 12, padding: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 8, color: "#fda4af", fontSize: 13 }}>
                  {predictError}
                </div>
              )}

              {predictResult && (
                <div style={{ marginTop: 12, background: palette.innerBg, border: `1px solid `, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 10 }}>
                    {[
                      { label: "Risk Score", value: predictResult.Risk_Score, color: "#ef4444" },
                      { label: "Risk Level", value: predictResult.Risk_Level, color: "#f97316" },
                      { label: "Binary Level", value: predictResult.Risk_Level_Binary, color: "#c084fc" },
                      { label: "Anomaly", value: predictResult.Anomaly_Flag ? "FLAGGED" : "NONE", color: predictResult.Anomaly_Flag ? "#a855f7" : "#10b981" },
                    ].map((item) => (
                      <div key={item.label} style={{ background: "#05070d", borderRadius: 6, padding: 10 }}>
                        <div style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.08em" }}>{item.label}</div>
                        <div style={{ fontSize: 14, color: item.color, fontWeight: 700, fontFamily: "monospace", marginTop: 3 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 14, color: "#475569", letterSpacing: "0.08em", marginBottom: 4 }}>EXPLANATION</div>
                  <div style={{ fontSize: 14, color: palette.text, lineHeight: 1.5 }}>
                    {predictResult.Explanation_Summary}
                  </div>
                </div>
              )}
            </div>

            {/* Operational intelligence panels moved from System Design */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginTop: 16 }}>
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em" }}>RISK NETWORK INTELLIGENCE</div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/network`);
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Unable to refresh network");
                        setNetworkData({ nodes: data.nodes || [], edges: data.edges || [] });
                        setNetworkError("");
                      } catch (err) {
                        setNetworkError(err.message || "Unable to refresh network");
                      }
                    }}
                    style={{
                      background: "transparent",
                      color: "#94a3b8",
                      border: `1px solid `,
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    REFRESH
                  </button>
                </div>

                {networkError && (
                  <div style={{ marginBottom: 10, padding: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 8, color: "#fda4af", fontSize: 13 }}>
                    {networkError}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
                  {(networkData.nodes || []).slice(0, 12).map((n) => (
                    <div key={n.id} style={{ background: palette.innerBg, borderRadius: 8, padding: 10, border: `1px solid ` }}>
                      <div style={{ fontSize: 13, color: "#475569", letterSpacing: "0.08em" }}>{String(n.type || "").toUpperCase()}</div>
                      <div style={{ fontSize: 14, color: palette.text, fontFamily: "monospace", marginTop: 4 }}>{n.label}</div>
                      <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>Count: {n.count}</div>
                      <div style={{ fontSize: 14, color: "#f97316" }}>Risk: {(Number(n.risk_rate || 0) * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6 }}>Top risk links:</div>
                <div style={{ maxHeight: 180, overflow: "auto", background: palette.innerBg, borderRadius: 8, border: `1px solid ` }}>
                  {(networkData.edges || []).slice(0, 14).map((e, idx) => (
                    <div key={`${e.source}-${e.target}-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, padding: "8px 10px", borderBottom: "1px solid #111827" }}>
                      <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "monospace" }}>{e.source}</span>
                      <span style={{ fontSize: 14, color: "#94a3b8", fontFamily: "monospace" }}>{e.target}</span>
                      <span style={{ fontSize: 14, color: "#22d3ee", fontFamily: "monospace" }}>{e.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 12 }}>HUMAN-IN-THE-LOOP FEEDBACK</div>
                <form onSubmit={submitFeedback}>
                  {[
                    ["Container_ID", "Container ID", "text"],
                    ["Predicted_Level_Binary", "Predicted Binary", "select"],
                    ["Officer_Outcome", "Officer Outcome", "select"],
                    ["Action_Taken", "Action Taken", "text"],
                    ["Officer_ID", "Officer ID", "text"],
                    ["Comment", "Comment", "text"],
                  ].map(([key, label, kind]) => (
                    <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.08em" }}>{label}</span>
                      {kind === "select" ? (
                        <select
                          value={feedbackForm[key]}
                          onChange={(e) => setFeedbackForm((prev) => ({ ...prev, [key]: e.target.value }))}
                          style={{ background: palette.innerBg, border: `1px solid `, borderRadius: 6, color: palette.text, fontSize: 13, padding: "8px 10px" }}
                        >
                          <option value="Critical">Critical</option>
                          <option value="Low Risk">Low Risk</option>
                        </select>
                      ) : (
                        <input
                          value={feedbackForm[key]}
                          onChange={(e) => setFeedbackForm((prev) => ({ ...prev, [key]: e.target.value }))}
                          style={{ background: palette.innerBg, border: `1px solid `, borderRadius: 6, color: palette.text, fontSize: 13, padding: "8px 10px", fontFamily: "monospace" }}
                          required={key !== "Comment"}
                        />
                      )}
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={feedbackLoading}
                    style={{ width: "100%", background: feedbackLoading ? "#334155" : "#6366f1", color: "#f8fafc", border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 13, letterSpacing: "0.08em", cursor: feedbackLoading ? "not-allowed" : "pointer" }}
                  >
                    {feedbackLoading ? "SUBMITTING..." : "SUBMIT FEEDBACK"}
                  </button>
                </form>

                {feedbackStatus && (
                  <div style={{ marginTop: 10, fontSize: 13, color: feedbackStatus.includes("saved") ? "#34d399" : "#fda4af" }}>
                    {feedbackStatus}
                  </div>
                )}

                {feedbackStats && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        ["Total Feedback", feedbackStats.total_feedback],
                        ["Match Rate", `${feedbackStats.match_rate}%`],
                        ["False Positives", feedbackStats.false_positives],
                        ["False Negatives", feedbackStats.false_negatives],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: palette.innerBg, border: `1px solid `, borderRadius: 8, padding: 8 }}>
                          <div style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.08em" }}>{k}</div>
                          <div style={{ fontSize: 13, color: "#22d3ee", fontFamily: "monospace", marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, maxHeight: 120, overflow: "auto", background: palette.innerBg, borderRadius: 8, border: `1px solid ` }}>
                      {(feedbackStats.recent || []).slice(0, 6).map((r, idx) => (
                        <div key={`${r.Container_ID}-${idx}`} style={{ padding: "8px 10px", borderBottom: "1px solid #111827" }}>
                          <div style={{ fontSize: 14, color: "#94a3b8", fontFamily: "monospace" }}>
                            {r.Container_ID} | Pred: {r.Predicted_Level_Binary} | Outcome: {r.Officer_Outcome}
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                            Officer {r.Officer_ID} | Match: {r.Match ? "Yes" : "No"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 12 }}>DRIFT MONITORING + THRESHOLD OPTIMIZATION</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div style={{ background: palette.innerBg, border: `1px solid `, borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.08em" }}>DRIFT STATUS</div>
                    <div style={{ fontSize: 14, fontFamily: "monospace", marginTop: 4, color: driftData?.status === "high_drift" ? "#ef4444" : driftData?.status === "moderate_drift" ? "#f59e0b" : "#34d399" }}>
                      {String(driftData?.status || "unknown").toUpperCase()}
                    </div>
                    <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>
                      Overall PSI: {driftData?.overall_psi ?? "N/A"}
                    </div>
                  </div>
                  <div style={{ background: palette.innerBg, border: `1px solid `, borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 13, color: "#64748b", letterSpacing: "0.08em" }}>BEST THRESHOLD (F1)</div>
                    <div style={{ fontSize: 14, fontFamily: "monospace", marginTop: 4, color: "#22d3ee" }}>
                      {thresholdData?.best_threshold_by_f1?.threshold ?? "N/A"}
                    </div>
                    <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>
                      F1: {thresholdData?.best_threshold_by_f1?.f1 ?? "N/A"} | Recall: {thresholdData?.best_threshold_by_f1?.recall ?? "N/A"}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6 }}>Top drifting features:</div>
                <div style={{ maxHeight: 120, overflow: "auto", background: palette.innerBg, borderRadius: 8, border: `1px solid `, marginBottom: 10 }}>
                  {(driftData?.features || []).slice(0, 6).map((f, idx) => (
                    <div key={`${f.feature}-${idx}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, padding: "8px 10px", borderBottom: "1px solid #111827" }}>
                      <span style={{ fontSize: 14, color: "#94a3b8" }}>{f.label}</span>
                      <span style={{ fontSize: 14, color: "#f97316", fontFamily: "monospace" }}>PSI {f.psi}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 14, color: "#64748b", marginBottom: 6 }}>Threshold curve snapshot:</div>
                <div style={{ maxHeight: 140, overflow: "auto", background: palette.innerBg, borderRadius: 8, border: `1px solid ` }}>
                  {(thresholdData?.rows || []).slice(0, 8).map((r, idx) => (
                    <div key={`${r.threshold}-${idx}`} style={{ display: "grid", gridTemplateColumns: "auto auto auto auto", gap: 8, padding: "8px 10px", borderBottom: "1px solid #111827" }}>
                      <span style={{ fontSize: 14, color: "#94a3b8" }}>T={r.threshold}</span>
                      <span style={{ fontSize: 14, color: "#22d3ee" }}>{r.selected_pct}% selected</span>
                      <span style={{ fontSize: 14, color: "#34d399" }}>Recall {r.recall ?? "N/A"}</span>
                      <span style={{ fontSize: 14, color: "#f59e0b" }}>F1 {r.f1 ?? "N/A"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 12 }}>RETRAINING + AUDIT PIPELINE</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => window.open(`${API_BASE}/feedback-export`, "_blank")}
                    style={{ background: palette.innerBg, color: "#22d3ee", border: `1px solid `, borderRadius: 8, padding: "10px 12px", fontSize: 13, textAlign: "left", cursor: "pointer" }}
                  >
                    Download Feedback Retrain Dataset (CSV)
                  </button>
                  <button
                    type="button"
                    onClick={triggerRetrain}
                    style={{ background: palette.innerBg, color: "#818cf8", border: `1px solid `, borderRadius: 8, padding: "10px 12px", fontSize: 13, textAlign: "left", cursor: "pointer" }}
                  >
                    Trigger Retrain Request
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`${API_BASE}/audit-report?format=json`, "_blank")}
                    style={{ background: palette.innerBg, color: "#34d399", border: `1px solid `, borderRadius: 8, padding: "10px 12px", fontSize: 13, textAlign: "left", cursor: "pointer" }}
                  >
                    Download Audit Report (JSON)
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`${API_BASE}/audit-report?format=pdf`, "_blank")}
                    style={{ background: palette.innerBg, color: "#f59e0b", border: `1px solid `, borderRadius: 8, padding: "10px 12px", fontSize: 13, textAlign: "left", cursor: "pointer" }}
                  >
                    Download Audit Report (PDF)
                  </button>
                </div>
                {opsStatus && (
                  <div style={{ marginTop: 10, fontSize: 13, color: opsStatus.toLowerCase().includes("failed") ? "#fda4af" : "#34d399" }}>
                    {opsStatus}
                  </div>
                )}
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
                <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  Top {topContainers.length} critical containers — all flagged by Isolation Forest anomaly detection
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search ID / Origin / HS..."
                  style={{
                    background: palette.innerBg, border: `1px solid `, borderRadius: 8,
                    padding: "8px 14px", color: palette.text, fontSize: 14, fontFamily: "inherit",
                    outline: "none", width: 220,
                  }}
                />
                <div style={{ padding: "6px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 13, color: "#ef4444" }}>
                  {filteredContainers.length} HIGH RISK
                </div>
              </div>
            </div>

            <div style={{ background: palette.panelBg, borderRadius: 12, border: `1px solid `, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{
                display: "grid", gridTemplateColumns: "32px 110px 110px 80px 60px 70px 80px 70px 70px 1fr",
                gap: 8, padding: "10px 16px",
                background: palette.innerBg, borderBottom: `1px solid `,
                fontSize: 13, color: "#475569", letterSpacing: "0.15em",
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

              {filteredContainers.map((c, i) => {
                const isOpen = selectedContainer?.id === c.id;
                return (
                  <div key={c.id} style={{ borderBottom: "1px solid #0f1117" }}>
                    <div
                      onClick={() => setSelectedContainer(isOpen ? null : c)}
                      style={{
                        display: "grid", gridTemplateColumns: "32px 110px 110px 80px 60px 70px 80px 70px 70px 1fr",
                        gap: 8, padding: "12px 16px", cursor: "pointer",
                        background: isOpen ? "rgba(99,102,241,0.08)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                        transition: "background 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#475569" }}>{isOpen ? "▼" : "▶"} {i + 1}</span>
                      <span style={{ fontSize: 14, fontFamily: "monospace", color: "#22d3ee" }}>{c.id}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 40, height: 5, background: palette.border, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${c.score}%`, background: scoreColor(c.score), borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 14, color: scoreColor(c.score), fontFamily: "monospace" }}>{c.score}</span>
                      </div>
                      <span style={{ fontSize: 14, color: "#ef4444", fontFamily: "monospace" }}>{c.pcrit}%</span>
                      <span style={{
                        fontSize: 13, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace",
                        background: "rgba(99,102,241,0.15)", color: "#818cf8", width: "fit-content",
                      }}>{formatCountry(c.origin)}</span>
                      <span style={{ fontSize: 13, color: "#94a3b8", fontFamily: "monospace" }}>{c.hs}</span>
                      <span style={{
                        fontSize: 14, fontFamily: "monospace",
                        color: c.dwell > 150 ? "#ef4444" : c.dwell > 100 ? "#f97316" : "#f59e0b",
                      }}>{c.dwell}h</span>
                      <span style={{ fontSize: 14, color: "#f97316", fontFamily: "monospace" }}>{c.wt.toFixed(1)}%</span>
                      <span style={{
                        fontSize: 14, padding: "2px 6px", borderRadius: 4,
                        background: c.anom ? "rgba(168,85,247,0.2)" : "transparent",
                        color: c.anom ? "#c084fc" : "#475569",
                      }}>{c.anom ? "⚠ FLAGGED" : "—"}</span>
                      <span style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.exp}</span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: "0 16px 14px 16px", background: "rgba(99,102,241,0.04)" }}>
                        <div style={{
                          marginTop: 6, background: "rgba(99,102,241,0.06)", borderRadius: 10,
                          border: "1px solid rgba(99,102,241,0.3)", padding: 16,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginBottom: 4 }}>
                                CONTAINER {c.id} — RISK PROFILE
                              </div>
                              <div style={{ fontSize: 13, color: "#64748b" }}>Detailed risk assessment breakdown</div>
                            </div>
                            <div style={{
                              fontSize: 28, fontWeight: 800, color: scoreColor(c.score),
                              fontFamily: "monospace", lineHeight: 1,
                            }}>
                              {c.score}
                              <span style={{ fontSize: 14, color: "#475569", fontWeight: 400, marginLeft: 4 }}>/100</span>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginTop: 16 }}>
                            {[
                              { label: "P(Critical)", value: `${c.pcrit}%`, color: "#ef4444" },
                              { label: "Origin", value: formatCountry(c.origin), color: "#818cf8" },
                              { label: "HS Code", value: c.hs, color: "#94a3b8" },
                              { label: "Dwell Time", value: `${c.dwell}h`, color: c.dwell > 150 ? "#ef4444" : "#f97316" },
                              { label: "Weight Diff", value: `${c.wt.toFixed(1)}%`, color: "#f97316" },
                              { label: "Anomaly", value: c.anom ? "FLAGGED" : "NONE", color: c.anom ? "#c084fc" : "#475569" },
                            ].map(item => (
                              <div key={item.label} style={{ background: palette.innerBg, borderRadius: 8, padding: 12 }}>
                                <div style={{ fontSize: 13, color: "#475569", letterSpacing: "0.15em", marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: 12, padding: 12, background: palette.innerBg, borderRadius: 8, border: `1px solid ` }}>
                            <div style={{ fontSize: 13, color: "#475569", letterSpacing: "0.15em", marginBottom: 6 }}>EXPLANATION</div>
                            <div style={{ fontSize: 14, color: palette.text, lineHeight: 1.6 }}>{c.exp}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!filteredContainers.length && (
                <div style={{ padding: "18px 16px", color: "#94a3b8", fontSize: 14 }}>
                  No containers match this filter. Clear search or refresh stats.
                </div>
              )}
            </div>

            {/* Summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 16 }}>
              {[
                {
                  label: "All Critical Anomalies",
                  value: `${summaryData?.critical_2level ? Math.round((Number(summaryData.anomalies_total || 0) / Number(summaryData.critical_2level || 1)) * 100) : 100}%`,
                  color: "#c084fc",
                  desc: "Anomaly-to-critical ratio from latest batch",
                },
                {
                  label: "Avg High Score",
                  value: `${summaryData?.avg_risk_scores?.High ?? 74.8}`,
                  color: "#ef4444",
                  desc: `vs ${summaryData?.avg_risk_scores?.Medium ?? 17.4} Medium, ${summaryData?.avg_risk_scores?.Low ?? 5.0} Low`,
                },
                {
                  label: "Avg High Dwell",
                  value: `${summaryData?.dwell_avg?.High ?? 75.3}h`,
                  color: "#f97316",
                  desc: `vs ${summaryData?.dwell_avg?.Low ?? 40.7}h for low-risk containers`,
                },
                {
                  label: "Avg Weight Excess",
                  value: `${(((summaryData?.weight_diff_avg?.High ?? 0.229) * 100)).toFixed(1)}%`,
                  color: "#f59e0b",
                  desc: `vs ${(((summaryData?.weight_diff_avg?.Low ?? 0.025) * 100)).toFixed(1)}% for low-risk`,
                },
              ].map(s => (
                <div key={s.label} style={{ background: palette.panelBg, borderRadius: 10, padding: 14, border: `1px solid ` }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>{s.desc}</div>
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
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>RANDOM FOREST — FEATURE IMPORTANCE (TOP 10 of 30)</div>
                {featuresData.map((f, i) => (
                  <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, color: "#475569", width: 20, textAlign: "right" }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: "#94a3b8", width: 180, flexShrink: 0 }}>{f.name}</span>
                    <div style={{ flex: 1, height: 8, background: palette.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${(f.importance / 36.45) * 100}%`,
                        background: f.group === "Weight" ? "#ef4444" : f.group === "Behaviour" ? "#a855f7" : f.group === "Dwell" ? "#06b6d4" : f.group === "HS Code" ? "#10b981" : "#6366f1",
                        borderRadius: 4, transition: "width 1s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: "#f8fafc", width: 40, textAlign: "right" }}>{f.importance}%</span>
                    <span style={{
                      fontSize: 13, padding: "2px 6px", borderRadius: 4, width: 70, textAlign: "center",
                      background: f.group === "Weight" ? "rgba(239,68,68,0.15)" : f.group === "Behaviour" ? "rgba(168,85,247,0.15)" : f.group === "Dwell" ? "rgba(6,182,212,0.15)" : "rgba(99,102,241,0.15)",
                      color: f.group === "Weight" ? "#f87171" : f.group === "Behaviour" ? "#c084fc" : f.group === "Dwell" ? "#22d3ee" : "#818cf8",
                    }}>{f.group}</span>
                  </div>
                ))}
              </div>

              {/* Anomaly breakdown */}
              <div>
                <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid `, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>ANOMALY DETECTION — 3 SIGNAL TYPES</div>
                  {[
                    { type: "Weight Discrepancy", count: 25, pct: 2.4, color: "#f97316", desc: "|Measured − Declared| > 25%" },
                    { type: "Value-to-Weight", count: 267, pct: 25.5, color: "#a855f7", desc: "Z-score > 2.5σ from HS chapter median" },
                    { type: "Behavioural", count: 458, pct: 43.7, color: "#ef4444", desc: "Importer crit rate >5% or Country crit rate >3%" },
                  ].map(a => (
                    <div key={a.type} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: palette.text }}>{a.type}</span>
                        <span style={{ fontSize: 13, fontFamily: "monospace", color: a.color }}>{a.count.toLocaleString()} ({a.pct}%)</span>
                      </div>
                      <div style={{ height: 6, background: palette.border, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ height: "100%", width: `${a.pct}%`, background: a.color, borderRadius: 3, transition: "width 1s ease" }} />
                      </div>
                      <div style={{ fontSize: 14, color: "#475569" }}>{a.desc}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, padding: 10, background: palette.innerBg, borderRadius: 8, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                    <span style={{ color: "#a855f7" }}>Isolation Forest</span> — 300 trees, 12% contamination → <span style={{ color: "#a855f7" }}>1,049 anomalies (12.4%)</span>
                  </div>
                </div>

                <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 12 }}>KEY INSIGHT</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { label: "Weight features combined", value: "56.95%", color: "#ef4444", desc: "of total importance" },
                      { label: "Importer history signal", value: "9.96%", color: "#a855f7", desc: "highly predictive" },
                      { label: "Crit vs Clear wt diff", value: "9.2×", color: "#f97316", desc: "22.9% vs 2.5%" },
                      { label: "Anomaly-Critical overlap", value: "100%", color: "#22d3ee", desc: "top 15 all flagged" },
                    ].map(k => (
                      <div key={k.label} style={{ background: palette.innerBg, borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
                        <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 2 }}>{k.label}</div>
                        <div style={{ fontSize: 14, color: "#475569" }}>{k.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Feature group breakdown */}
            <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
              <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>ALL 30 ENGINEERED FEATURES</div>
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
                  <div key={g.group} style={{ background: palette.innerBg, borderRadius: 8, padding: 12, border: `1px solid ${g.color}22` }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: g.color, marginBottom: 8, letterSpacing: "0.05em" }}>{g.group}</div>
                    {g.features.map(f => (
                      <div key={f} style={{ fontSize: 13, color: "#64748b", marginBottom: 3, fontFamily: "monospace" }}>{f}</div>
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
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>How SmartContainer plugs into a real-world customs workflow</p>
            </div>

            {/* Workflow pipeline */}
            <div style={{ background: palette.panelBg, borderRadius: 12, padding: 28, border: `1px solid `, marginBottom: 16 }}>
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
                      <div style={{ fontSize: 13, color: s.color, letterSpacing: "0.1em", marginBottom: 4 }}>STEP {s.step}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: palette.text, marginBottom: 4 }}>{s.title}</div>
                      <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.4 }}>{s.desc}</div>
                    </div>
                    {i < WORKFLOW_STEPS.length - 1 && (
                      <div style={{ color: palette.muted, fontSize: 20, margin: "0 4px", flexShrink: 0 }}>→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* REST API endpoints */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>REST API ENDPOINTS</div>
                {[
                  { method: "GET",  path: "/health",     desc: "Health check & model status",       color: "#10b981" },
                  { method: "GET",  path: "/stats",      desc: "Aggregate statistics dashboard",    color: "#10b981" },
                  { method: "GET",  path: "/drift",      desc: "Live drift monitoring",             color: "#10b981" },
                  { method: "GET",  path: "/threshold-analysis", desc: "Threshold optimization curve", color: "#10b981" },
                  { method: "GET",  path: "/network",    desc: "Risk network graph entities/links", color: "#10b981" },
                  { method: "GET",  path: "/feedback-export", desc: "Export feedback retrain dataset", color: "#10b981" },
                  { method: "GET",  path: "/feedback-stats", desc: "Officer feedback quality metrics", color: "#10b981" },
                  { method: "GET",  path: "/audit-report", desc: "Governance report (json/pdf)", color: "#10b981" },
                  { method: "POST", path: "/predict",    desc: "Single container risk scoring",     color: "#6366f1" },
                  { method: "POST", path: "/batch",      desc: "Batch scoring (up to 10K, JSON)",   color: "#6366f1" },
                  { method: "POST", path: "/batch-csv",  desc: "Batch scoring from CSV upload",     color: "#6366f1" },
                  { method: "POST", path: "/feedback",   desc: "Submit post-inspection outcome",    color: "#6366f1" },
                  { method: "POST", path: "/retrain-trigger", desc: "Queue retraining request", color: "#6366f1" },
                ].map(ep => (
                  <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", background: palette.innerBg, borderRadius: 6 }}>
                    <span style={{
                      fontSize: 13, fontFamily: "monospace", fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: ep.color === "#10b981" ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
                      color: ep.color, width: 36, textAlign: "center",
                    }}>{ep.method}</span>
                    <span style={{ fontSize: 13, fontFamily: "monospace", color: "#22d3ee", flex: 1 }}>{ep.path}</span>
                    <span style={{ fontSize: 14, color: "#64748b" }}>{ep.desc}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>DEPLOYMENT OPTIONS</div>
                {[
                  { title: "Direct Python", cmd: "python risk_engine.py", color: "#10b981" },
                  { title: "Flask API", cmd: "python api.py", color: "#6366f1" },
                  { title: "Docker Build", cmd: "docker build -t smartcontainer .", color: "#06b6d4" },
                  { title: "Docker Run", cmd: "docker run -p 5000:5000 -v ./data:/app smartcontainer", color: "#06b6d4" },
                  { title: "Docker Compose", cmd: "docker-compose up --build", color: "#a855f7" },
                ].map(d => (
                  <div key={d.title} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 14, color: "#64748b", marginBottom: 4 }}>{d.title}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, color: d.color, background: palette.innerBg, padding: "8px 12px", borderRadius: 6, border: `1px solid ` }}>
                      $ {d.cmd}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample API payload */}
            <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
              <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>SAMPLE API INTERACTION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, color: "#6366f1", marginBottom: 8 }}>POST /predict — REQUEST</div>
                  <pre style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8", background: palette.innerBg, padding: 14, borderRadius: 8, border: `1px solid `, overflow: "auto" }}>{`{
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
                  <div style={{ fontSize: 14, color: "#10b981", marginBottom: 8 }}>200 OK — RESPONSE</div>
                  <pre style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8", background: palette.innerBg, padding: 14, borderRadius: 8, border: `1px solid `, overflow: "auto" }}>{`{
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
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>MODEL ARCHITECTURE</div>
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
                    <div key={m.label} style={{ background: palette.innerBg, borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 13, color: "#475569", letterSpacing: "0.1em" }}>{m.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: "monospace", marginTop: 2 }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance */}
              <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
                <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>MODEL PERFORMANCE (TEST SET)</div>
                {[
                  { label: "AUC-ROC (All Classes)", value: "1.0000", color: "#10b981", pct: 100 },
                  { label: "Test Accuracy", value: "99.88%", color: "#22d3ee", pct: 99.88 },
                  { label: "Precision (Critical)", value: "100%", color: "#6366f1", pct: 100 },
                  { label: "Recall (Critical)", value: "99%", color: "#a855f7", pct: 99 },
                  { label: "F1 Score (Critical)", value: "0.9939", color: "#ef4444", pct: 99.39 },
                ].map(p => (
                  <div key={p.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>{p.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: p.color, fontFamily: "monospace" }}>{p.value}</span>
                    </div>
                    <div style={{ height: 6, background: palette.border, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${p.pct}%`, background: p.color, borderRadius: 3, transition: "width 1.2s ease" }} />
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 16, padding: 12, background: palette.innerBg, borderRadius: 8, border: `1px solid ` }}>
                  <div style={{ fontSize: 13, color: "#475569", letterSpacing: "0.1em", marginBottom: 6 }}>RISK SCORE FORMULA</div>
                  <pre style={{ fontSize: 13, fontFamily: "monospace", color: "#94a3b8", lineHeight: 1.8, margin: 0 }}>
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
            <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid `, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>DATASET SUMMARY</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12 }}>
                {[
                  { label: "Historical Training", value: "54,000", sub: "labelled records", color: "#6366f1" },
                  { label: "Real-Time Batch", value: "8,481", sub: "scored containers", color: "#06b6d4" },
                  { label: "Clear (Historical)", value: "78.4%", sub: "42,347 records", color: "#10b981" },
                  { label: "Low Risk (Hist.)", value: "20.6%", sub: "11,108 records", color: "#f59e0b" },
                  { label: "Critical (Hist.)", value: "1.0%", sub: "545 records", color: "#ef4444" },
                  { label: "Date Range", value: "2020–21", sub: "historical period", color: "#94a3b8" },
                ].map(d => (
                  <div key={d.label} style={{ background: palette.innerBg, borderRadius: 8, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: d.color, fontFamily: "monospace" }}>{d.value}</div>
                    <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>{d.label}</div>
                    <div style={{ fontSize: 14, color: "#475569", marginTop: 2 }}>{d.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech stack */}
            <div style={{ background: palette.panelBg, borderRadius: 12, padding: 20, border: `1px solid ` }}>
              <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: "0.15em", marginBottom: 16 }}>TECH STACK & DELIVERABLES</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, color: "#6366f1", marginBottom: 10 }}>PYTHON STACK</div>
                  {["pandas 2.x — data processing","numpy — feature computation","scikit-learn — RF + Isolation Forest","flask — REST API server","gunicorn — production WSGI"].map(t => (
                    <div key={t} style={{ fontSize: 13, color: "#64748b", marginBottom: 6, display: "flex", gap: 8 }}>
                      <span style={{ color: "#6366f1" }}>▸</span> {t}
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 14, color: "#10b981", marginBottom: 10 }}>DELIVERABLES</div>
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
                    <div key={t} style={{ fontSize: 13, color: "#64748b", marginBottom: 5, display: "flex", gap: 8 }}>
                      <span style={{ color: "#10b981" }}>✓</span> {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer style={{
        borderTop: `1px solid ${palette.border}`,
        marginTop: 16,
        padding: "14px 24px 18px",
        textAlign: "center",
        color: palette.muted,
        fontSize: 13,
        letterSpacing: "0.06em",
      }}>
        <div style={{ marginBottom: 4 }}>Made with ❤️ by Syntax_Error</div>
        <div>Team Members: Anmol Gupta, Hari Om Mishra, Sagar Yadav</div>
      </footer>
    </div>
  );
}
