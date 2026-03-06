"""
SmartContainer Risk Engine — REST API
======================================
National Hackathon Submission

Deployment-ready Flask REST API exposing the ML risk scoring engine.

Endpoints:
  GET  /health              — Health check
  GET  /stats               — Aggregate statistics from last batch run
  GET  /drift               — Live drift monitoring (historical vs real-time)
  GET  /threshold-analysis  — Threshold optimization curve
  GET  /network             — Risk network graph data (country/importer/exporter/HS)
  GET  /feedback-export     — Export officer feedback dataset
  GET  /feedback-stats      — Human feedback loop metrics
  GET  /audit-report        — Governance report (json/pdf)
  POST /predict             — Score a single container
  POST /batch               — Score a list of containers (JSON array)
  POST /batch-csv           — Score containers from a CSV upload
  POST /feedback            — Submit post-inspection officer feedback
  POST /retrain-trigger     — Queue retrain request with audit trail

Usage:
  pip install flask pandas numpy scikit-learn
  python api.py

  Or via Docker:
  docker-compose up
"""

import os, json, warnings, traceback
from pathlib import Path
from datetime import datetime, timezone

warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    from functools import wraps
    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    print("Flask not installed. Run: pip install flask flask-cors")
    print("API code is complete — install Flask to launch the server.")
    exit(0)

# ── Config ────────────────────────────────────────────────────────
HIST_PATH_ENV    = os.getenv("HIST_PATH")
HIGH_THRESHOLD   = 50
MEDIUM_THRESHOLD = 20
RF_TREES  = 400
RF_DEPTH  = 12
ISO_TREES = 300
ISO_CONTAM = 0.12
RF_WEIGHT  = 0.70
ISO_WEIGHT = 0.30
SUMMARY_PATH = os.getenv("SUMMARY_PATH", "summary_report.json")
FEEDBACK_LOG_PATH = os.getenv("FEEDBACK_LOG_PATH", "feedback_log.jsonl")
RETRAIN_LOG_PATH = os.getenv("RETRAIN_LOG_PATH", "retrain_requests.jsonl")

app = Flask(__name__)
CORS(app)


def resolve_hist_path() -> str:
    candidates = []
    if HIST_PATH_ENV:
        candidates.append(HIST_PATH_ENV)
    candidates.extend(["Historical_Data.csv", "Historical Data.csv"])
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return candidates[0]


def resolve_rt_path() -> str:
    candidates = ["Real-Time_Data.csv", "Real-Time Data.csv"]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return candidates[0]


def load_feedback_records() -> list[dict]:
    p = Path(FEEDBACK_LOG_PATH)
    if not p.exists():
        return []
    records = []
    with p.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except Exception:
                continue
    return records


def normalize_binary_level(value: str) -> str:
    v = str(value or "").strip().lower()
    if v in {"critical", "high", "high risk"}:
        return "Critical"
    if v in {"low risk", "low", "clear", "medium", "medium risk"}:
        return "Low Risk"
    return ""


def psi_from_series(hist_s: pd.Series, rt_s: pd.Series, bins: int = 10) -> float:
    """Population Stability Index for numeric drift monitoring."""
    hist = pd.to_numeric(hist_s, errors="coerce").dropna()
    rt = pd.to_numeric(rt_s, errors="coerce").dropna()
    if len(hist) < 50 or len(rt) < 50:
        return 0.0

    try:
        quantiles = np.linspace(0, 1, bins + 1)
        edges = np.unique(np.quantile(hist, quantiles))
        if len(edges) < 3:
            return 0.0
        h_counts, _ = np.histogram(hist, bins=edges)
        r_counts, _ = np.histogram(rt, bins=edges)
    except Exception:
        return 0.0

    eps = 1e-6
    h_pct = np.clip(h_counts / max(h_counts.sum(), 1), eps, 1.0)
    r_pct = np.clip(r_counts / max(r_counts.sum(), 1), eps, 1.0)
    psi = np.sum((r_pct - h_pct) * np.log(r_pct / h_pct))
    return float(max(psi, 0.0))


def compute_drift_report() -> dict:
    hist_path = resolve_hist_path()
    rt_path = resolve_rt_path()
    if not Path(hist_path).exists() or not Path(rt_path).exists():
        return {"error": "Historical or real-time CSV not found.", "features": []}

    hist = pd.read_csv(hist_path)
    rt = pd.read_csv(rt_path)
    features = []

    candidate_features = [
        ("Declared_Weight", "Declared Weight"),
        ("Measured_Weight", "Measured Weight"),
        ("Declared_Value", "Declared Value"),
        ("Dwell_Time_Hours", "Dwell Time"),
    ]

    # Derived value/kg drift
    if "Declared_Value" in hist and "Declared_Weight" in hist and "Declared_Value" in rt and "Declared_Weight" in rt:
        hist_vpk = pd.to_numeric(hist["Declared_Value"], errors="coerce") / (
            pd.to_numeric(hist["Declared_Weight"], errors="coerce").clip(lower=1e-6)
        )
        rt_vpk = pd.to_numeric(rt["Declared_Value"], errors="coerce") / (
            pd.to_numeric(rt["Declared_Weight"], errors="coerce").clip(lower=1e-6)
        )
        vpk_psi = psi_from_series(hist_vpk, rt_vpk)
        features.append({
            "feature": "Value_Per_Kg",
            "label": "Declared Value per Kg",
            "psi": round(vpk_psi, 4),
        })

    for col, label in candidate_features:
        if col in hist.columns and col in rt.columns:
            score = psi_from_series(hist[col], rt[col])
            features.append({"feature": col, "label": label, "psi": round(score, 4)})

    # Declaration hour drift
    if "Declaration_Time" in hist.columns and "Declaration_Time" in rt.columns:
        h_hour = pd.to_datetime(hist["Declaration_Time"], format="%H:%M:%S", errors="coerce").dt.hour
        r_hour = pd.to_datetime(rt["Declaration_Time"], format="%H:%M:%S", errors="coerce").dt.hour
        hour_psi = psi_from_series(h_hour, r_hour)
        features.append({"feature": "Declaration_Hour", "label": "Declaration Hour", "psi": round(hour_psi, 4)})

    if not features:
        return {"error": "No comparable drift features found.", "features": []}

    overall = float(np.mean([f["psi"] for f in features]))
    if overall >= 0.25:
        status = "high_drift"
    elif overall >= 0.10:
        status = "moderate_drift"
    else:
        status = "stable"

    return {
        "status": status,
        "overall_psi": round(overall, 4),
        "hist_size": int(len(hist)),
        "rt_size": int(len(rt)),
        "features": sorted(features, key=lambda x: x["psi"], reverse=True),
        "thresholds": {"stable_lt": 0.10, "moderate_lt": 0.25, "high_gte": 0.25},
    }


def compute_feedback_stats_payload() -> dict:
    rows = load_feedback_records()
    if not rows:
        return {
            "total_feedback": 0,
            "match_rate": 0.0,
            "predicted_critical": 0,
            "confirmed_critical": 0,
            "false_positives": 0,
            "false_negatives": 0,
            "recent": [],
            "officer_stats": [],
        }

    df = pd.DataFrame(rows)
    for col in ["Predicted_Level_Binary", "Officer_Outcome", "Officer_ID"]:
        if col not in df:
            df[col] = ""
    if "Match" not in df:
        df["Match"] = (df["Predicted_Level_Binary"] == df["Officer_Outcome"]).astype(int)

    total = int(len(df))
    predicted_critical = int((df["Predicted_Level_Binary"] == "Critical").sum())
    confirmed_critical = int((df["Officer_Outcome"] == "Critical").sum())
    false_pos = int(((df["Predicted_Level_Binary"] == "Critical") & (df["Officer_Outcome"] != "Critical")).sum())
    false_neg = int(((df["Predicted_Level_Binary"] != "Critical") & (df["Officer_Outcome"] == "Critical")).sum())
    match_rate = round(float(df["Match"].mean()) * 100, 2) if total else 0.0

    officer_stats = (
        df.groupby("Officer_ID")
        .agg(total=("Container_ID", "count"), match_rate=("Match", "mean"))
        .reset_index()
    )
    officer_stats["match_rate"] = (officer_stats["match_rate"] * 100).round(2)
    officer_stats = officer_stats.sort_values(["total", "match_rate"], ascending=False).head(12)

    recent_cols = [
        c for c in [
            "timestamp_utc", "Container_ID", "Predicted_Level_Binary",
            "Officer_Outcome", "Match", "Officer_ID", "Action_Taken", "Comment"
        ] if c in df.columns
    ]
    recent = df.sort_values("timestamp_utc", ascending=False).head(10)[recent_cols].to_dict("records")

    return {
        "total_feedback": total,
        "match_rate": match_rate,
        "predicted_critical": predicted_critical,
        "confirmed_critical": confirmed_critical,
        "false_positives": false_pos,
        "false_negatives": false_neg,
        "recent": recent,
        "officer_stats": officer_stats.to_dict("records"),
    }


def build_audit_payload() -> dict:
    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "model_ready": MODEL["trained"],
        "train_size": MODEL["train_size"],
        "drift": compute_drift_report(),
        "feedback": compute_feedback_stats_payload(),
    }
    if Path(SUMMARY_PATH).exists():
        with open(SUMMARY_PATH) as f:
            payload["batch_summary"] = json.load(f)
    else:
        payload["batch_summary"] = {"error": "summary_report.json not found"}
    return payload

# ── Global model state ────────────────────────────────────────────
MODEL = {
    "rf":  None,
    "iso": None,
    "scaler": None,
    "feat_cols": None,
    "country_crit": {},
    "importer_crit": {},
    "exporter_crit": {},
    "hs_crit": {},
    "ship_freq": {},
    "trained": False,
    "train_size": 0,
}

# ── Feature engineering (mirrors risk_engine.py exactly) ─────────
def engineer_single(row: dict, M: dict) -> np.ndarray:
    """Engineer features for a single container dict."""
    dw  = max(float(row.get("Declared_Weight", 1)), 1e-3)
    mw  = max(float(row.get("Measured_Weight",  dw)), 1e-3)
    val = max(float(row.get("Declared_Value",   0)), 0)
    hs  = str(row.get("HS_Code", "00"))
    ch  = hs[:2]

    wdp = abs(mw - dw) / dw
    vpk = val / (dw + 1e-6)

    f = {}
    f["weight_diff_abs"]     = abs(mw - dw)
    f["weight_diff_pct"]     = wdp
    f["weight_ratio"]        = mw / dw
    f["weight_over_flag"]    = int(mw > dw * 1.10)
    f["weight_under_flag"]   = int(mw < dw * 0.90)
    f["weight_large_disc"]   = int(wdp > 0.15)
    f["value_per_kg"]        = vpk
    f["log_value_per_kg"]    = np.log1p(vpk)
    f["log_declared_value"]  = np.log1p(val)
    f["very_low_value"]      = int(val < 100)
    f["high_value"]          = int(val > 1_000_000)
    f["vpw_zscore"]          = 0.0   # can't compute per-chapter z-score for single item
    f["vpw_outlier"]         = 0

    dwell = float(row.get("Dwell_Time_Hours", 0))
    f["dwell_time"]           = dwell
    f["log_dwell"]            = np.log1p(dwell)
    f["long_dwell_flag"]      = int(dwell > 100)
    f["very_long_dwell_flag"] = int(dwell > 150)

    decl_time = str(row.get("Declaration_Time", "12:00:00"))
    try:
        hour = int(decl_time.split(":")[0])
    except:
        hour = 12
    f["decl_hour"]     = hour
    f["night_decl_flag"] = int(hour >= 22 or hour < 5)

    f["hs_chapter"]      = int(ch) if ch.isdigit() else 0
    f["hs_crit_rate"]    = M["hs_crit"].get(ch, 0.0)

    regime = str(row.get("Trade_Regime", "Import")).lower()
    f["is_transit"] = int("transit" in regime)
    f["is_export"]  = int("export"  in regime)

    orig = str(row.get("Origin_Country", ""))
    imp  = str(row.get("Importer_ID",    ""))
    exp  = str(row.get("Exporter_ID",    ""))
    sl   = str(row.get("Shipping_Line",  ""))

    f["country_crit_rate"]  = M["country_crit"].get(orig, 0.0)
    f["importer_crit_rate"] = M["importer_crit"].get(imp,  0.0)
    f["exporter_crit_rate"] = M["exporter_crit"].get(exp,  0.0)
    f["shipping_freq"]      = M["ship_freq"].get(sl, 0.0)
    f["rare_shipping_line"] = int(M["ship_freq"].get(sl, 0.0) < 0.01)

    dest_port = str(row.get("Destination_Port", ""))
    f["dest_port_enc"] = abs(hash(dest_port)) % 1000

    f["multi_risk_score"] = sum([
        int(wdp > 0.15),
        int(val < 100),
        int(f["country_crit_rate"]  > 0.03),
        int(f["importer_crit_rate"] > 0.05),
        int(dwell > 100),
        f["night_decl_flag"],
        f["is_transit"],
    ])

    return np.array([f[c] for c in M["feat_cols"]], dtype=float)


def explain_features(row: dict, feat_vec: np.ndarray, M: dict,
                     risk_level: str, is_anom: int) -> str:
    f = dict(zip(M["feat_cols"], feat_vec))
    reasons = []

    wdp = f["weight_diff_pct"]
    if wdp > 0.25:
        dire = "excess" if f["weight_over_flag"] else "deficit"
        reasons.append(f"Weight {dire} {wdp*100:.0f}% vs declared "
                       f"({row.get('Declared_Weight',0):.1f}→{row.get('Measured_Weight',0):.1f} kg)")
    elif wdp > 0.10:
        reasons.append(f"Weight discrepancy of {wdp*100:.0f}% detected")

    if f["vpw_outlier"]:
        reasons.append(f"Unusual value-to-weight ratio (${f['value_per_kg']:.1f}/kg) — outlier for HS chapter")
    if f["very_low_value"]:
        reasons.append(f"Suspiciously low declared value (${row.get('Declared_Value',0):.2f})")
    if f["importer_crit_rate"] > 0.05:
        reasons.append(f"Importer has {f['importer_crit_rate']*100:.1f}% historical critical rate")
    if f["country_crit_rate"] > 0.03:
        reasons.append(f"Origin {row.get('Origin_Country','')} elevated risk ({f['country_crit_rate']*100:.1f}% crit rate)")
    if f["very_long_dwell_flag"]:
        reasons.append(f"Extreme dwell time ({row.get('Dwell_Time_Hours',0):.0f}h > 150h)")
    elif f["long_dwell_flag"]:
        reasons.append(f"Extended dwell time ({row.get('Dwell_Time_Hours',0):.0f}h > 100h)")
    if f["night_decl_flag"]:
        reasons.append(f"Off-hours declaration")
    if f["multi_risk_score"] >= 3:
        reasons.append(f"Multiple risk signals ({int(f['multi_risk_score'])} triggered simultaneously)")
    if is_anom and not reasons:
        reasons.append("Statistical anomaly — unusual shipment profile (Isolation Forest)")
    if not reasons:
        return "All indicators normal; no anomalies detected"
    return "; ".join(reasons[:3])


# ── Model training ────────────────────────────────────────────────
def train_model():
    global MODEL
    hist_path = resolve_hist_path()
    if not Path(hist_path).exists():
        print(f"[WARN] Historical data not found at: {hist_path}")
        print("       The API will start but /predict will return 503 until training data is loaded.")
        return

    print(f"[INIT] Loading historical data from {hist_path}...")
    hist = pd.read_csv(hist_path)
    print(f"[INIT] {len(hist):,} records loaded.")

    # Behavioural risk maps
    def crit_rate(df, col):
        return df.groupby(col)["Clearance_Status"].apply(
            lambda x: (x == "Critical").mean()).to_dict()

    MODEL["country_crit"]  = crit_rate(hist, "Origin_Country")
    MODEL["importer_crit"] = crit_rate(hist, "Importer_ID")
    MODEL["exporter_crit"] = crit_rate(hist, "Exporter_ID")
    MODEL["ship_freq"]     = hist["Shipping_Line"].value_counts(normalize=True).to_dict()

    tmp = hist.copy()
    tmp["_ch"] = tmp["HS_Code"].astype(str).str[:2]
    MODEL["hs_crit"] = tmp.groupby("_ch")["Clearance_Status"].apply(
        lambda x: (x == "Critical").mean()).to_dict()

    # Set feat_cols so engineer_single can run
    FEAT_COLS = [
        "weight_diff_abs","weight_diff_pct","weight_ratio","weight_over_flag","weight_under_flag",
        "weight_large_disc","value_per_kg","log_value_per_kg","log_declared_value",
        "very_low_value","high_value","vpw_zscore","vpw_outlier","dwell_time","log_dwell",
        "long_dwell_flag","very_long_dwell_flag","decl_hour","night_decl_flag",
        "hs_chapter","hs_crit_rate","is_transit","is_export",
        "country_crit_rate","importer_crit_rate","exporter_crit_rate",
        "shipping_freq","rare_shipping_line","dest_port_enc","multi_risk_score",
    ]
    MODEL["feat_cols"] = FEAT_COLS

    print("[INIT] Engineering features...")
    rows = []
    for _, r in hist.iterrows():
        rows.append(engineer_single(r.to_dict(), MODEL))
    X = np.array(rows)

    scaler = StandardScaler()
    X_s = scaler.fit_transform(X)
    MODEL["scaler"] = scaler

    label_map = {"Clear": 0, "Low Risk": 1, "Critical": 2}
    y = hist["Clearance_Status"].map(label_map).values

    print("[INIT] Training Random Forest (400 trees)...")
    rf = RandomForestClassifier(
        n_estimators=RF_TREES, max_depth=RF_DEPTH, min_samples_leaf=5,
        class_weight={0:1, 1:2, 2:15}, n_jobs=-1, random_state=42)
    rf.fit(X, y)
    MODEL["rf"] = rf

    print("[INIT] Training Isolation Forest (300 trees)...")
    iso = IsolationForest(n_estimators=ISO_TREES, contamination=ISO_CONTAM,
                         random_state=42, n_jobs=-1)
    iso.fit(X_s)
    MODEL["iso"] = iso

    MODEL["trained"]    = True
    MODEL["train_size"] = len(hist)
    print(f"[INIT] ✅ Model ready. Trained on {len(hist):,} records.")


def score_containers(records: list[dict]) -> list[dict]:
    """Score a list of container dicts and return prediction dicts."""
    M = MODEL
    feat_vecs = np.array([engineer_single(r, M) for r in records])
    feat_s    = M["scaler"].transform(feat_vecs)

    probs  = M["rf"].predict_proba(feat_vecs)
    preds  = M["rf"].predict(feat_vecs)
    anoms  = (M["iso"].predict(feat_s) == -1).astype(int)
    iso_r  = -M["iso"].decision_function(feat_s)
    iso_n  = (iso_r - iso_r.min()) / (iso_r.max() - iso_r.min() + 1e-9)

    raw    = (RF_WEIGHT*probs[:,2]*100 + RF_WEIGHT*probs[:,1]*40 + ISO_WEIGHT*iso_n*100) / 1.7
    scores = np.clip(raw, 0, 100).round(1)

    results = []
    for i, r in enumerate(records):
        s = float(scores[i])
        p = int(preds[i])
        rl3 = "High" if s >= HIGH_THRESHOLD or p==2 else "Medium" if s >= MEDIUM_THRESHOLD or p==1 else "Low"
        rl2 = "Critical" if s >= HIGH_THRESHOLD or p==2 else "Low Risk"
        exp = explain_features(r, feat_vecs[i], M, rl3, int(anoms[i]))
        results.append({
            "Container_ID":        r.get("Container_ID", f"CONTAINER_{i}"),
            "Risk_Score":          s,
            "Risk_Level":          rl3,
            "Risk_Level_Binary":   rl2,
            "Explanation_Summary": exp,
            "P_Clear":     round(float(probs[i,0]), 4),
            "P_Low_Risk":  round(float(probs[i,1]), 4),
            "P_Critical":  round(float(probs[i,2]), 4),
            "Anomaly_Flag":  int(anoms[i]),
            "Anomaly_Score": round(float(iso_n[i]), 4),
        })
    return results


# ── Middleware ────────────────────────────────────────────────────
def require_model(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not MODEL["trained"]:
            return jsonify({"error": "Model not yet trained. Ensure Historical_Data.csv is available and restart."}), 503
        return f(*args, **kwargs)
    return decorated


# ── Routes ────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":     "ok",
        "model_ready": MODEL["trained"],
        "train_size":  MODEL["train_size"],
        "thresholds":  {"high": HIGH_THRESHOLD, "medium": MEDIUM_THRESHOLD},
        "version":     "1.0.0",
        "service":     "SmartContainer Risk Engine",
    })


@app.route("/stats", methods=["GET"])
def stats():
    if not Path(SUMMARY_PATH).exists():
        return jsonify({"error": "summary_report.json not found. Run risk_engine.py first."}), 404
    with open(SUMMARY_PATH) as f:
        return jsonify(json.load(f))


@app.route("/drift", methods=["GET"])
def drift():
    report = compute_drift_report()
    code = 200 if "error" not in report else 404
    return jsonify(report), code


@app.route("/threshold-analysis", methods=["GET"])
@require_model
def threshold_analysis():
    rt_path = resolve_rt_path()
    if not Path(rt_path).exists():
        return jsonify({"error": f"Real-time data not found at: {rt_path}"}), 404

    try:
        rt = pd.read_csv(rt_path)
        records = rt.to_dict("records")
        preds = score_containers(records)
        df = pd.DataFrame(preds)

        thresholds = list(range(5, 100, 5))
        rows = []

        has_labels = "Clearance_Status" in rt.columns
        y_true = (rt["Clearance_Status"].astype(str) == "Critical").astype(int) if has_labels else None

        for t in thresholds:
            y_pred = (df["Risk_Score"] >= t).astype(int)
            selected = int(y_pred.sum())
            item = {
                "threshold": t,
                "selected_count": selected,
                "selected_pct": round(selected / max(len(df), 1) * 100, 2),
            }
            if has_labels:
                tp = int(((y_pred == 1) & (y_true == 1)).sum())
                fp = int(((y_pred == 1) & (y_true == 0)).sum())
                fn = int(((y_pred == 0) & (y_true == 1)).sum())
                precision = tp / max(tp + fp, 1)
                recall = tp / max(tp + fn, 1)
                f1 = 2 * precision * recall / max(precision + recall, 1e-9)
                item.update({
                    "critical_captured": tp,
                    "precision": round(precision, 4),
                    "recall": round(recall, 4),
                    "f1": round(f1, 4),
                })
            rows.append(item)

        best = max(rows, key=lambda x: x.get("f1", -1)) if rows and has_labels else None
        return jsonify({
            "total_containers": int(len(df)),
            "has_ground_truth": has_labels,
            "rows": rows,
            "best_threshold_by_f1": best,
        })
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/network", methods=["GET"])
@require_model
def network():
    """
    Build a lightweight risk-entity graph from real-time data.
    Node types: country, importer, exporter, hs_chapter
    Edge types: country->importer, importer->exporter, exporter->hs_chapter
    """
    rt_path = resolve_rt_path()
    if not Path(rt_path).exists():
        return jsonify({"error": f"Real-time data not found at: {rt_path}"}), 404

    try:
        df = pd.read_csv(rt_path)
        if len(df) == 0:
            return jsonify({"nodes": [], "edges": []})

        # Limit rows for responsiveness while preserving signal.
        if len(df) > 12000:
            df = df.head(12000).copy()

        df["Origin_Country"] = df["Origin_Country"].astype(str)
        df["Importer_ID"] = df["Importer_ID"].astype(str)
        df["Exporter_ID"] = df["Exporter_ID"].astype(str)
        df["HS_Chapter"] = df["HS_Code"].astype(str).str[:2]

        # Entity risk priors from trained historical maps.
        country_counts = df["Origin_Country"].value_counts()
        importer_counts = df["Importer_ID"].value_counts()
        exporter_counts = df["Exporter_ID"].value_counts()
        hs_counts = df["HS_Chapter"].value_counts()

        def top_entities(counts: pd.Series, risk_map: dict, top_n: int = 8):
            tmp = pd.DataFrame({"entity": counts.index, "count": counts.values})
            tmp["risk_rate"] = tmp["entity"].map(risk_map).fillna(0.0)
            tmp["risk_score"] = tmp["risk_rate"] * np.log1p(tmp["count"])
            return tmp.sort_values(["risk_score", "count"], ascending=False).head(top_n)

        top_country = top_entities(country_counts, MODEL["country_crit"], top_n=8)
        top_importer = top_entities(importer_counts, MODEL["importer_crit"], top_n=8)
        top_exporter = top_entities(exporter_counts, MODEL["exporter_crit"], top_n=8)
        top_hs = top_entities(hs_counts, MODEL["hs_crit"], top_n=8)

        country_set = set(top_country["entity"].tolist())
        importer_set = set(top_importer["entity"].tolist())
        exporter_set = set(top_exporter["entity"].tolist())
        hs_set = set(top_hs["entity"].tolist())

        filt = df[
            df["Origin_Country"].isin(country_set)
            | df["Importer_ID"].isin(importer_set)
            | df["Exporter_ID"].isin(exporter_set)
            | df["HS_Chapter"].isin(hs_set)
        ].copy()

        def make_nodes(prefix: str, frame: pd.DataFrame, entity_col: str, node_type: str):
            out = []
            for _, row in frame.iterrows():
                entity = row["entity"]
                out.append({
                    "id": f"{prefix}:{entity}",
                    "label": entity,
                    "type": node_type,
                    "count": int(row["count"]),
                    "risk_rate": round(float(row["risk_rate"]), 4),
                })
            return out

        nodes = []
        nodes.extend(make_nodes("country", top_country, "entity", "country"))
        nodes.extend(make_nodes("importer", top_importer, "entity", "importer"))
        nodes.extend(make_nodes("exporter", top_exporter, "entity", "exporter"))
        nodes.extend(make_nodes("hs", top_hs, "entity", "hs_chapter"))
        node_ids = {n["id"] for n in nodes}

        edge_counter = {}

        def add_edge(a, b):
            key = (a, b)
            edge_counter[key] = edge_counter.get(key, 0) + 1

        for _, r in filt.iterrows():
            c = f"country:{r['Origin_Country']}"
            i = f"importer:{r['Importer_ID']}"
            e = f"exporter:{r['Exporter_ID']}"
            h = f"hs:{r['HS_Chapter']}"
            if c in node_ids and i in node_ids:
                add_edge(c, i)
            if i in node_ids and e in node_ids:
                add_edge(i, e)
            if e in node_ids and h in node_ids:
                add_edge(e, h)

        edges = [
            {"source": s, "target": t, "count": int(c)}
            for (s, t), c in edge_counter.items()
            if c >= 2
        ]
        edges.sort(key=lambda x: x["count"], reverse=True)

        return jsonify({
            "nodes": nodes,
            "edges": edges[:40],
            "meta": {
                "rows_used": int(len(df)),
                "note": "Risk rates derived from historical critical-rate priors.",
            },
        })
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/predict", methods=["POST"])
@require_model
def predict():
    """
    Score a single container.

    Request body (JSON):
    {
      "Container_ID":      "CONT123",
      "Declared_Weight":   1200.0,
      "Measured_Weight":   1560.0,
      "Declared_Value":    8500.0,
      "Dwell_Time_Hours":  72,
      "Origin_Country":    "CN",
      "HS_Code":           "850340",
      "Importer_ID":       "IMP9912",
      "Exporter_ID":       "EXP0044",
      "Shipping_Line":     "COSCO",
      "Trade_Regime":      "Import",
      "Destination_Port":  "AEJEA",
      "Declaration_Time":  "02:17:00"
    }
    """
    data = request.get_json(force=True, silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    try:
        result = score_containers([data])[0]
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/batch", methods=["POST"])
@require_model
def batch():
    """
    Score a batch of containers.

    Request body: JSON array of container objects (same schema as /predict).
    Returns: { "results": [...], "summary": {...} }
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Request body must be a JSON array."}), 400
    if isinstance(data, dict) and "containers" in data:
        data = data["containers"]
    if not isinstance(data, list):
        return jsonify({"error": "Expected a JSON array or {\"containers\": [...]}"}), 400
    if len(data) > 10_000:
        return jsonify({"error": "Batch limit is 10,000 containers per request."}), 413

    try:
        results = score_containers(data)
        high   = sum(1 for r in results if r["Risk_Level"] == "High")
        medium = sum(1 for r in results if r["Risk_Level"] == "Medium")
        low    = sum(1 for r in results if r["Risk_Level"] == "Low")
        anoms  = sum(1 for r in results if r["Anomaly_Flag"])
        return jsonify({
            "results": results,
            "summary": {
                "total":         len(results),
                "high_risk":     high,
                "medium_risk":   medium,
                "low_risk":      low,
                "anomalies":     anoms,
                "critical_pct":  round(high / len(results) * 100, 2),
            }
        })
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/batch-csv", methods=["POST"])
@require_model
def batch_csv():
    """
    Score containers from an uploaded CSV file.
    Form field: file (multipart/form-data)
    Returns: CSV download with predictions.
    """
    import io
    from flask import Response

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Use multipart/form-data with field 'file'."}), 400

    f = request.files["file"]
    try:
        df = pd.read_csv(io.BytesIO(f.read()))
        records = df.to_dict("records")
        results = score_containers(records)

        out_df = pd.DataFrame(results)
        csv_bytes = out_df.to_csv(index=False).encode("utf-8")
        return Response(
            csv_bytes,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=risk_predictions.csv"}
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/feedback", methods=["POST"])
def feedback():
    """
    Submit officer feedback after inspection.
    Body:
      {
        "Container_ID": "NEW_001",
        "Predicted_Level_Binary": "Critical",
        "Officer_Outcome": "Low Risk",
        "Action_Taken": "Document review",
        "Officer_ID": "OFFICER_12",
        "Comment": "False alarm due to weight sensor drift"
      }
    """
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    container_id = str(data.get("Container_ID", "")).strip()
    predicted = normalize_binary_level(data.get("Predicted_Level_Binary", ""))
    outcome = normalize_binary_level(data.get("Officer_Outcome", ""))
    action = str(data.get("Action_Taken", "")).strip()
    officer = str(data.get("Officer_ID", "")).strip() or "UNKNOWN"
    comment = str(data.get("Comment", "")).strip()

    if not container_id:
        return jsonify({"error": "Container_ID is required."}), 400
    if not predicted:
        return jsonify({"error": "Predicted_Level_Binary must be Critical or Low Risk."}), 400
    if not outcome:
        return jsonify({"error": "Officer_Outcome must be Critical or Low Risk."}), 400

    record = {
        "timestamp_utc": pd.Timestamp.utcnow().isoformat(),
        "Container_ID": container_id,
        "Predicted_Level_Binary": predicted,
        "Officer_Outcome": outcome,
        "Match": int(predicted == outcome),
        "Action_Taken": action,
        "Officer_ID": officer,
        "Comment": comment,
    }

    p = Path(FEEDBACK_LOG_PATH)
    with p.open("a") as f:
        f.write(json.dumps(record) + "\n")

    return jsonify({"status": "ok", "recorded": record})


@app.route("/feedback-export", methods=["GET"])
def feedback_export():
    fmt = request.args.get("format", "csv").lower()
    include_features = request.args.get("include_features", "true").lower() != "false"
    rows = load_feedback_records()
    if not rows:
        return jsonify({"error": "No feedback records available yet."}), 404

    df = pd.DataFrame(rows)
    if include_features:
        rt_path = resolve_rt_path()
        if Path(rt_path).exists():
            rt = pd.read_csv(rt_path)
            if "Container_ID" in rt.columns:
                rt_idx = rt.drop_duplicates("Container_ID", keep="last")
                merged = df.merge(rt_idx, on="Container_ID", how="left")
                df = merged

    df["Target_Label"] = df.get("Officer_Outcome", "")
    if fmt == "json":
        return jsonify({
            "records": df.fillna("").to_dict("records"),
            "count": int(len(df)),
            "note": "Use Target_Label as supervised target for retraining."
        })

    # default csv download
    from flask import Response
    csv_bytes = df.fillna("").to_csv(index=False).encode("utf-8")
    return Response(
        csv_bytes,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=feedback_retrain_dataset.csv"},
    )


@app.route("/retrain-trigger", methods=["POST"])
def retrain_trigger():
    data = request.get_json(force=True, silent=True) or {}
    requested_by = str(data.get("requested_by", "unknown")).strip() or "unknown"
    note = str(data.get("note", "")).strip()

    feedback_stats = compute_feedback_stats_payload()
    event = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "requested_by": requested_by,
        "note": note,
        "feedback_count": feedback_stats.get("total_feedback", 0),
        "match_rate": feedback_stats.get("match_rate", 0.0),
        "status": "queued",
    }
    with Path(RETRAIN_LOG_PATH).open("a") as f:
        f.write(json.dumps(event) + "\n")

    return jsonify({
        "status": "queued",
        "event": event,
        "next_steps": [
            "Download feedback retrain dataset via GET /feedback-export",
            "Run: python risk_engine.py to retrain and regenerate outputs",
            "Restart API to load refreshed model parameters",
        ],
    })


@app.route("/feedback-stats", methods=["GET"])
def feedback_stats():
    return jsonify(compute_feedback_stats_payload())


@app.route("/audit-report", methods=["GET"])
def audit_report():
    fmt = request.args.get("format", "json").lower()
    payload = build_audit_payload()

    if fmt == "pdf":
        try:
            from io import BytesIO
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas
            buf = BytesIO()
            c = canvas.Canvas(buf, pagesize=A4)
            width, height = A4
            y = height - 40

            def line(txt, size=10, gap=14):
                nonlocal y
                c.setFont("Helvetica", size)
                c.drawString(40, y, txt)
                y -= gap

            line("SmartContainer Audit & Governance Report", size=14, gap=20)
            line(f"Generated (UTC): {payload['generated_at_utc']}")
            line(f"Model Ready: {payload.get('model_ready')}")
            line(f"Train Size: {payload.get('train_size')}")
            drift = payload.get("drift", {})
            line(f"Drift Status: {drift.get('status', 'n/a')}")
            line(f"Overall PSI: {drift.get('overall_psi', 'n/a')}")
            fb = payload.get("feedback", {})
            line(f"Feedback Count: {fb.get('total_feedback', 0)}")
            line(f"Feedback Match Rate: {fb.get('match_rate', 0)}%")
            bs = payload.get("batch_summary", {})
            line(f"Batch Size: {bs.get('batch_size', 'n/a')}")
            line(f"High Risk: {bs.get('high_risk', 'n/a')} | Medium: {bs.get('medium_risk', 'n/a')} | Low: {bs.get('low_risk', 'n/a')}")
            line(f"Anomalies Total: {bs.get('anomalies_total', 'n/a')}")
            c.showPage()
            c.save()
            buf.seek(0)
            from flask import Response
            return Response(
                buf.getvalue(),
                mimetype="application/pdf",
                headers={"Content-Disposition": "attachment; filename=audit_report.pdf"},
            )
        except Exception as e:
            return jsonify({"error": f"PDF generation failed: {e}"}), 500

    return jsonify(payload)


# ── Error handlers ────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error": "Endpoint not found.",
        "available_endpoints": [
            "GET  /health",
            "GET  /stats",
            "GET  /drift",
            "GET  /threshold-analysis",
            "GET  /network",
            "GET  /feedback-export",
            "GET  /feedback-stats",
            "GET  /audit-report",
            "POST /predict",
            "POST /batch",
            "POST /batch-csv",
            "POST /feedback",
            "POST /retrain-trigger",
        ]
    }), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed on this endpoint."}), 405


# ── Entrypoint ────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 62)
    print("   SmartContainer Risk Engine — REST API")
    print("=" * 62)
    train_model()
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    print(f"\n[API] Starting on http://0.0.0.0:{port}")
    print(f"[API] Endpoints:")
    print(f"      GET  http://localhost:{port}/health")
    print(f"      GET  http://localhost:{port}/stats")
    print(f"      GET  http://localhost:{port}/drift")
    print(f"      GET  http://localhost:{port}/threshold-analysis")
    print(f"      GET  http://localhost:{port}/network")
    print(f"      GET  http://localhost:{port}/feedback-export")
    print(f"      GET  http://localhost:{port}/feedback-stats")
    print(f"      GET  http://localhost:{port}/audit-report")
    print(f"      POST http://localhost:{port}/predict")
    print(f"      POST http://localhost:{port}/batch")
    print(f"      POST http://localhost:{port}/batch-csv")
    print(f"      POST http://localhost:{port}/feedback")
    print(f"      POST http://localhost:{port}/retrain-trigger")
    print()
    app.run(host="0.0.0.0", port=port, debug=debug)
