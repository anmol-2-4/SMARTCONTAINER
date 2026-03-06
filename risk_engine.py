"""
SmartContainer Risk Engine
==========================
National Hackathon Submission

Problem Statement Implementation:
  ✅ Risk Prediction        — Risk Score (0–100)
  ✅ Risk Categorization    — High / Medium / Low  (3-level per Must Have)
                           — Critical / Low Risk   (2-level per Output Spec)
  ✅ Anomaly Detection      — Weight discrepancy, Value-to-weight, Behavioural irregularities
  ✅ Explainability         — Per-container natural language explanation
  ✅ Batch Processing       — Processes full CSV input
  ✅ Output CSV             — All required fields
  ✅ Summary Report         — Printed + saved as JSON

Usage:
    python risk_engine.py
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import json, warnings
from pathlib import Path
warnings.filterwarnings("ignore")

HIST_PATH_CANDIDATES = ["Historical_Data.csv", "Historical Data.csv"]
RT_PATH_CANDIDATES   = ["Real-Time_Data.csv", "Real-Time Data.csv"]
OUT_CSV   = "risk_predictions.csv"
OUT_JSON  = "summary_report.json"

HIGH_THRESHOLD   = 50
MEDIUM_THRESHOLD = 20
RF_TREES    = 400
RF_DEPTH    = 12
RF_MIN_LEAF = 5
ISO_TREES   = 300
ISO_CONTAM  = 0.12
RF_WEIGHT   = 0.70
ISO_WEIGHT  = 0.30

print("=" * 68)
print("   SmartContainer Risk Engine — National Hackathon Submission")
print("=" * 68)

def resolve_data_path(candidates):
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    raise FileNotFoundError(
        "Input file not found. Tried: " + ", ".join(candidates)
    )

# ── 1. Load ───────────────────────────────────────────────────────
print("\n[1/7] Loading data...")
hist_path = resolve_data_path(HIST_PATH_CANDIDATES)
rt_path = resolve_data_path(RT_PATH_CANDIDATES)
hist = pd.read_csv(hist_path)
rt   = pd.read_csv(rt_path)
print(f"       Using files: {hist_path} | {rt_path}")
print(f"       Historical : {len(hist):>6,} records | labels: {dict(hist['Clearance_Status'].value_counts())}")
print(f"       Real-time  : {len(rt):>6,}  records")

# ── 2. Behavioural risk maps ──────────────────────────────────────
def crit_rate(df, col):
    return df.groupby(col)["Clearance_Status"].apply(lambda x: (x=="Critical").mean()).to_dict()

country_crit  = crit_rate(hist, "Origin_Country")
importer_crit = crit_rate(hist, "Importer_ID")
exporter_crit = crit_rate(hist, "Exporter_ID")
ship_freq     = hist["Shipping_Line"].value_counts(normalize=True).to_dict()

hist_tmp = hist.copy()
hist_tmp["_ch"] = hist_tmp["HS_Code"].astype(str).str[:2]
hs_crit = hist_tmp.groupby("_ch")["Clearance_Status"].apply(lambda x: (x=="Critical").mean()).to_dict()

# ── 3. Feature engineering ────────────────────────────────────────
print("\n[2/7] Feature engineering...")

def engineer(df, country_crit, importer_crit, exporter_crit, hs_crit, ship_freq):
    fe = pd.DataFrame(index=df.index)
    fe["Container_ID"] = df["Container_ID"].values

    dw = df["Declared_Weight"].clip(lower=1e-3).values
    mw = df["Measured_Weight"].clip(lower=1e-3).values

    # Weight discrepancy
    fe["weight_diff_abs"]     = np.abs(mw - dw)
    fe["weight_diff_pct"]     = np.abs(mw - dw) / dw
    fe["weight_ratio"]        = mw / dw
    fe["weight_over_flag"]    = (mw > dw * 1.10).astype(int)
    fe["weight_under_flag"]   = (mw < dw * 0.90).astype(int)
    fe["weight_large_disc"]   = (fe["weight_diff_pct"] > 0.15).astype(int)

    # Value-to-weight
    val = df["Declared_Value"].clip(lower=0).values
    fe["value_per_kg"]        = val / (dw + 1e-6)
    fe["log_value_per_kg"]    = np.log1p(fe["value_per_kg"])
    fe["log_declared_value"]  = np.log1p(val)
    fe["very_low_value"]      = (val < 100).astype(int)
    fe["high_value"]          = (val > 1_000_000).astype(int)

    # VPW z-score per HS chapter
    df2 = df.copy()
    df2["_ch"]  = df2["HS_Code"].astype(str).str[:2]
    df2["_vpw"] = fe["value_per_kg"].values
    ch_stats    = df2.groupby("_ch")["_vpw"].agg(["median","std"])
    df2         = df2.join(ch_stats, on="_ch")
    fe["vpw_zscore"]  = ((df2["_vpw"] - df2["median"]) / (df2["std"] + 1e-6)).clip(-5,5).fillna(0).values
    fe["vpw_outlier"] = (np.abs(fe["vpw_zscore"]) > 2.5).astype(int)

    # Dwell time
    fe["dwell_time"]          = df["Dwell_Time_Hours"].values
    fe["log_dwell"]           = np.log1p(df["Dwell_Time_Hours"].values)
    fe["long_dwell_flag"]     = (df["Dwell_Time_Hours"] > 100).astype(int).values
    fe["very_long_dwell_flag"]= (df["Dwell_Time_Hours"] > 150).astype(int).values

    # Declaration hour
    hours = pd.to_datetime(df["Declaration_Time"], format="%H:%M:%S", errors="coerce").dt.hour
    fe["decl_hour"]       = hours.fillna(12).astype(int).values
    fe["night_decl_flag"] = ((hours <= 5) | (hours >= 22)).astype(int).fillna(0).values

    # HS Code
    hs_str = df["HS_Code"].astype(str)
    fe["hs_chapter"]    = hs_str.str[:2].apply(lambda x: int(x) if x.isdigit() else 0).values
    fe["hs_crit_rate"]  = hs_str.str[:2].map(hs_crit).fillna(0).values

    # Trade regime
    regime = df["Trade_Regime (Import / Export / Transit)"]
    fe["is_transit"]  = (regime == "Transit").astype(int).values
    fe["is_export"]   = (regime == "Export").astype(int).values

    # Behavioural maps
    fe["country_crit_rate"]  = df["Origin_Country"].map(country_crit).fillna(0).values
    fe["importer_crit_rate"] = df["Importer_ID"].map(importer_crit).fillna(0).values
    fe["exporter_crit_rate"] = df["Exporter_ID"].map(exporter_crit).fillna(0).values
    fe["shipping_freq"]      = df["Shipping_Line"].map(ship_freq).fillna(0).values
    fe["rare_line_flag"]     = (fe["shipping_freq"] < 0.005).astype(int)

    # Destination port
    fe["dest_port_enc"] = LabelEncoder().fit_transform(df["Destination_Port"].values)

    # Multi-signal composite
    fe["multi_risk_score"] = (
        fe["weight_large_disc"].values +
        fe["long_dwell_flag"].values +
        fe["night_decl_flag"].values +
        fe["very_low_value"].values +
        fe["vpw_outlier"].values +
        (fe["country_crit_rate"].values  > 0.015).astype(int) +
        (fe["importer_crit_rate"].values > 0.03 ).astype(int)
    )

    return fe

hist_fe = engineer(hist, country_crit, importer_crit, exporter_crit, hs_crit, ship_freq)
rt_fe   = engineer(rt,   country_crit, importer_crit, exporter_crit, hs_crit, ship_freq)
FEAT_COLS = [c for c in hist_fe.columns if c != "Container_ID"]
print(f"       → {len(FEAT_COLS)} features")

# ── 4. Anomaly detection ──────────────────────────────────────────
print("\n[3/7] Isolation Forest anomaly detection...")
X_hist = hist_fe[FEAT_COLS].values.astype(float)
X_rt   = rt_fe[FEAT_COLS].values.astype(float)

scaler   = StandardScaler()
X_hist_s = scaler.fit_transform(X_hist)
X_rt_s   = scaler.transform(X_rt)

iso = IsolationForest(n_estimators=ISO_TREES, contamination=ISO_CONTAM, random_state=42, n_jobs=-1)
iso.fit(X_hist_s)

iso_raw  = -iso.decision_function(X_rt_s)
iso_norm = (iso_raw - iso_raw.min()) / (iso_raw.max() - iso_raw.min() + 1e-9)
is_anomaly = (iso.predict(X_rt_s) == -1).astype(int)

rt_r = rt.reset_index(drop=True)
rt_fe_r = rt_fe.reset_index(drop=True)
anom_wt  = (rt_fe_r["weight_diff_pct"] > 0.25).astype(int)
anom_vpw = rt_fe_r["vpw_outlier"].astype(int)
anom_beh = ((rt_fe_r["importer_crit_rate"] > 0.05) | (rt_fe_r["country_crit_rate"] > 0.03)).astype(int)

print(f"       Total      : {is_anomaly.sum()} ({is_anomaly.mean()*100:.1f}%)")
print(f"       Weight     : {anom_wt.sum()} | Value-Wt: {anom_vpw.sum()} | Behavioural: {anom_beh.sum()}")

# ── 5. Train classifier ───────────────────────────────────────────
print("\n[4/7] Training Random Forest...")
label_map  = {"Clear": 0, "Low Risk": 1, "Critical": 2}
ilabel_map = {0: "Clear", 1: "Low Risk", 2: "Critical"}
y_hist = hist["Clearance_Status"].map(label_map).values

X_tr, X_te, y_tr, y_te = train_test_split(X_hist, y_hist, test_size=0.15, stratify=y_hist, random_state=42)

rf = RandomForestClassifier(n_estimators=RF_TREES, max_depth=RF_DEPTH, min_samples_leaf=RF_MIN_LEAF,
                             class_weight={0:1,1:2,2:15}, n_jobs=-1, random_state=42)
rf.fit(X_tr, y_tr)

y_pred = rf.predict(X_te)
y_prob = rf.predict_proba(X_te)
print(classification_report(y_te, y_pred, target_names=["Clear","Low Risk","Critical"], digits=4, zero_division=0))

aucs = {}
for i, cls in enumerate(["Clear","Low Risk","Critical"]):
    try:
        aucs[cls] = round(roc_auc_score((y_te==i).astype(int), y_prob[:,i]), 4)
        print(f"       AUC-ROC [{cls}]: {aucs[cls]}")
    except:
        aucs[cls] = 0.0

# ── 6. Score real-time batch ──────────────────────────────────────
print("\n[5/7] Scoring real-time batch...")
rt_prob = rf.predict_proba(X_rt)
rt_pred = rf.predict(X_rt)

risk_raw   = (RF_WEIGHT * rt_prob[:,2] * 100 + RF_WEIGHT * rt_prob[:,1] * 40 + ISO_WEIGHT * iso_norm * 100) / 1.7
risk_score = np.clip(risk_raw, 0, 100).round(1)

def three_level(s, p): return "High" if (s>=HIGH_THRESHOLD or p==2) else "Medium" if (s>=MEDIUM_THRESHOLD or p==1) else "Low"
def two_level(s, p):   return "Critical" if (s>=HIGH_THRESHOLD or p==2) else "Low Risk"

risk_3 = [three_level(risk_score[i], rt_pred[i]) for i in range(len(rt))]
risk_2 = [two_level(risk_score[i],   rt_pred[i]) for i in range(len(rt))]

# ── 7. Explainability ─────────────────────────────────────────────
print("\n[6/7] Generating explanations...")
feat_imp = dict(zip(FEAT_COLS, rf.feature_importances_))

def explain(idx):
    f = dict(zip(FEAT_COLS, X_rt[idx]))
    reasons = []
    wdp = f["weight_diff_pct"]
    if wdp > 0.25:
        dire = "excess" if f["weight_over_flag"] else "deficit"
        reasons.append(f"Weight {dire} of {wdp*100:.0f}% vs declared ({rt_r.at[idx,'Declared_Weight']:.1f}→{rt_r.at[idx,'Measured_Weight']:.1f} kg)")
    elif wdp > 0.10:
        reasons.append(f"Weight discrepancy of {wdp*100:.0f}% detected")
    if f["vpw_outlier"]:
        reasons.append(f"Unusual value-to-weight ratio (${f['value_per_kg']:.1f}/kg) — outlier for HS chapter")
    if f["very_low_value"]:
        reasons.append(f"Suspiciously low declared value (${rt_r.at[idx,'Declared_Value']:.2f})")
    if f["importer_crit_rate"] > 0.05:
        reasons.append(f"Importer has {f['importer_crit_rate']*100:.1f}% historical critical rate")
    if f["country_crit_rate"] > 0.03:
        reasons.append(f"Origin {rt_r.at[idx,'Origin_Country']} elevated risk ({f['country_crit_rate']*100:.1f}% crit rate)")
    if f["very_long_dwell_flag"]:
        reasons.append(f"Extreme dwell time ({rt_r.at[idx,'Dwell_Time_Hours']:.0f}h > 150h)")
    elif f["long_dwell_flag"]:
        reasons.append(f"Extended dwell time ({rt_r.at[idx,'Dwell_Time_Hours']:.0f}h > 100h)")
    if f["hs_crit_rate"] > 0.015:
        reasons.append(f"HS chapter {str(rt_r.at[idx,'HS_Code'])[:2]} has elevated inspection history")
    if f["night_decl_flag"]:
        reasons.append(f"Off-hours declaration at {rt_r.at[idx,'Declaration_Time'][:5]}")
    if f["multi_risk_score"] >= 3:
        reasons.append(f"Multiple risk signals triggered ({int(f['multi_risk_score'])})")
    if is_anomaly[idx] and not reasons:
        reasons.append("Statistical anomaly — unusual shipment profile (Isolation Forest)")
    if not reasons:
        return "All indicators normal; no anomalies detected" if risk_3[idx]=="Low" else "Minor statistical deviation"
    return "; ".join(reasons[:3])

explanations = [explain(i) for i in range(len(rt))]

# ── 8. Output CSV ─────────────────────────────────────────────────
output = pd.DataFrame({
    "Container_ID"           : rt["Container_ID"].values,
    "Risk_Score"             : risk_score,
    "Risk_Level"             : risk_3,
    "Risk_Level_Binary"      : risk_2,
    "Explanation_Summary"    : explanations,
    "P_Clear"                : rt_prob[:,0].round(4),
    "P_Low_Risk"             : rt_prob[:,1].round(4),
    "P_Critical"             : rt_prob[:,2].round(4),
    "Anomaly_Flag"           : is_anomaly,
    "Anomaly_Type_Weight"    : anom_wt.values,
    "Anomaly_Type_ValueWt"   : anom_vpw.values,
    "Anomaly_Type_Behaviour" : anom_beh.values,
    "Anomaly_Score"          : iso_norm.round(4),
    "Weight_Diff_Pct"        : rt_fe_r["weight_diff_pct"].round(4).values,
    "Value_Per_Kg"           : rt_fe_r["value_per_kg"].round(2).values,
    "Origin_Country"         : rt["Origin_Country"].values,
    "HS_Code"                : rt["HS_Code"].values,
    "Dwell_Time_Hours"       : rt["Dwell_Time_Hours"].values,
    "Declaration_Date"       : rt["Declaration_Date (YYYY-MM-DD)"].values,
})
output.to_csv(OUT_CSV, index=False)

# ── 9. Summary JSON ───────────────────────────────────────────────
vc3 = output["Risk_Level"].value_counts().to_dict()
vc2 = output["Risk_Level_Binary"].value_counts().to_dict()

score_buckets = {
    "0-10":  int((output["Risk_Score"] < 10).sum()),
    "10-25": int(((output["Risk_Score"]>=10) & (output["Risk_Score"]<25)).sum()),
    "25-50": int(((output["Risk_Score"]>=25) & (output["Risk_Score"]<50)).sum()),
    "50-75": int(((output["Risk_Score"]>=50) & (output["Risk_Score"]<75)).sum()),
    "75-100":int((output["Risk_Score"]>=75).sum()),
}

origin_risk = (output.groupby("Origin_Country")
    .agg(count=("Risk_Score","count"), avg_score=("Risk_Score","mean"),
         high=("Risk_Level", lambda x:(x=="High").sum()))
    .reset_index().sort_values("high",ascending=False).head(15).round(2).to_dict("records"))

hs_risk = (output.assign(hs_ch=output["HS_Code"].astype(str).str[:2])
    .groupby("hs_ch").agg(count=("Risk_Score","count"), avg_score=("Risk_Score","mean"),
         high=("Risk_Level", lambda x:(x=="High").sum()))
    .reset_index().sort_values("high",ascending=False).head(12).round(2).to_dict("records"))

top_high = (output[output["Risk_Level"]=="High"].sort_values("Risk_Score",ascending=False).head(15)
    [["Container_ID","Risk_Score","P_Critical","Origin_Country","HS_Code",
      "Dwell_Time_Hours","Weight_Diff_Pct","Anomaly_Flag","Explanation_Summary"]]
    .round(3).to_dict("records"))

top_feats = sorted(feat_imp.items(), key=lambda x: x[1], reverse=True)[:10]

summary = {
    "batch_size": len(output), "hist_size": len(hist),
    "high_risk": int(vc3.get("High",0)), "medium_risk": int(vc3.get("Medium",0)),
    "low_risk": int(vc3.get("Low",0)), "critical_2level": int(vc2.get("Critical",0)),
    "anomalies_total": int(is_anomaly.sum()),
    "anomalies_weight": int(anom_wt.sum()), "anomalies_value_wt": int(anom_vpw.sum()),
    "anomalies_behaviour": int(anom_beh.sum()),
    "model_auc": aucs,
    "avg_risk_scores": {
        "High":   round(float(output[output["Risk_Level"]=="High"]["Risk_Score"].mean()),1) if vc3.get("High",0)   else 0,
        "Medium": round(float(output[output["Risk_Level"]=="Medium"]["Risk_Score"].mean()),1) if vc3.get("Medium",0) else 0,
        "Low":    round(float(output[output["Risk_Level"]=="Low"]["Risk_Score"].mean()),1),
    },
    "dwell_avg": output.groupby("Risk_Level")["Dwell_Time_Hours"].mean().round(1).to_dict(),
    "weight_diff_avg": output.groupby("Risk_Level")["Weight_Diff_Pct"].mean().round(4).to_dict(),
    "score_buckets": score_buckets, "origin_risk": origin_risk, "hs_risk": hs_risk,
    "top_high_risk": top_high,
    "top_features": [{"name": f, "importance": round(v,4)} for f,v in top_feats],
    "hist_label_dist": hist["Clearance_Status"].value_counts().to_dict(),
    "rt_actual_dist": rt["Clearance_Status"].value_counts().to_dict(),
}
with open(OUT_JSON,"w") as f:
    json.dump(summary, f, indent=2)

# ── 10. Print summary ─────────────────────────────────────────────
print(); print("="*68)
print("   SUMMARY REPORT")
print("="*68)
print(f"   Total containers processed    : {len(output):,}")
print(f"   Training data                 : {len(hist):,} historical records")
print()
print("   3-Level Risk (Must Have):")
print(f"   ├─ High Risk   (score ≥{HIGH_THRESHOLD})    : {vc3.get('High',0):>4} ({vc3.get('High',0)/len(output)*100:.1f}%)")
print(f"   ├─ Medium Risk ({MEDIUM_THRESHOLD}–{HIGH_THRESHOLD-1})        : {vc3.get('Medium',0):>4} ({vc3.get('Medium',0)/len(output)*100:.1f}%)")
print(f"   └─ Low Risk    (score <{MEDIUM_THRESHOLD})    : {vc3.get('Low',0):>4} ({vc3.get('Low',0)/len(output)*100:.1f}%)")
print()
print("   2-Level Risk (Output Spec):")
print(f"   ├─ Critical                   : {vc2.get('Critical',0):>4} ({vc2.get('Critical',0)/len(output)*100:.1f}%)")
print(f"   └─ Low Risk                   : {vc2.get('Low Risk',0):>4} ({vc2.get('Low Risk',0)/len(output)*100:.1f}%)")
print()
print("   Anomaly Detection:")
print(f"   ├─ Total                      : {is_anomaly.sum():>4} ({is_anomaly.mean()*100:.1f}%)")
print(f"   ├─ Weight discrepancy type    : {anom_wt.sum():>4}")
print(f"   ├─ Value-to-weight type       : {anom_vpw.sum():>4}")
print(f"   └─ Behavioural type           : {anom_beh.sum():>4}")
print()
print("   Model AUC-ROC:")
for cls, auc in aucs.items():
    print(f"   [{cls:<12}]             : {auc:.4f}")
print(f"\n   Outputs: {OUT_CSV}  |  {OUT_JSON}")
print("="*68)
