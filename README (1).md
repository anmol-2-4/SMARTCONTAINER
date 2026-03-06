# SmartContainer Risk Engine
### National Level Hackathon — AI/ML-Based Customs Inspection Prioritization

---

## Problem Statement Coverage

| Requirement | Status | Implementation |
|---|---|---|
| Risk Score (0–100) | ✅ | Blended RF + Isolation Forest score |
| Risk Categorization | ✅ | **High / Medium / Low** (Must Have) + Critical/Low Risk (Output Spec) |
| Anomaly Detection | ✅ | 3 types: weight discrepancy, value-to-weight, behavioural |
| Explainability | ✅ | Per-container natural language explanation (up to 3 signals) |
| Batch Processing | ✅ | Full CSV input/output |
| Summary Report | ✅ | Console output + `summary_report.json` |
| Web Dashboard | ✅ | React 5-tab interactive dashboard |
| REST API | ✅ | Flask API — 5 endpoints (predict, batch, stats, health, batch-csv) |
| Docker Deployment | ✅ | Dockerfile + docker-compose.yml |
| Customs Workflow Design | ✅ | System Design tab in dashboard |

---

## Project Structure

```
SmartContainer-Risk-Engine/
│
├── risk_engine.py                    # Main ML batch pipeline (run this first)
├── api.py                            # Flask REST API server (5 endpoints)
│
├── Dockerfile                        # Docker image definition
├── docker-compose.yml                # Multi-service Docker Compose
├── requirements.txt                  # Python dependencies
│
├── SmartContainer_Dashboard.jsx      # React dashboard (5 tabs, real data)
├── SmartContainer_Presentation.pptx  # Hackathon presentation (11 slides)
│
├── risk_predictions.csv              # OUTPUT: 8,481 scored containers
├── summary_report.json               # OUTPUT: aggregate stats
└── README.md                         # This file
```

---

## Quick Start

### Option 1: Direct Python

```bash
# Install dependencies
pip install -r requirements.txt

# Place input files in same directory (or update paths in risk_engine.py):
#   Historical_Data.csv  — labelled training data (54,000 records)
#   Real-Time_Data.csv   — batch to score (8,481 containers)

# Run the batch pipeline
python risk_engine.py

# Outputs: risk_predictions.csv  |  summary_report.json
```

**Runtime:** ~2–3 minutes (400-tree Random Forest + 300-tree Isolation Forest on 54K records)

### Option 2: Flask REST API

```bash
pip install -r requirements.txt

# Set the path to your historical training data
export HIST_PATH=./Historical_Data.csv

# Start the API server
python api.py

# API available at: http://localhost:5000
```

### Option 3: Docker (Recommended for deployment)

```bash
# Build and start with Docker Compose
docker-compose up --build

# API available at: http://localhost:5000
# Outputs saved to: ./outputs/
```

```bash
# Or manually with Docker
docker build -t smartcontainer-risk-engine .

docker run -p 5000:5000 \
  -v $(pwd)/Historical_Data.csv:/app/Historical_Data.csv \
  -v $(pwd)/Real-Time_Data.csv:/app/Real-Time_Data.csv \
  -v $(pwd)/outputs:/app/outputs \
  smartcontainer-risk-engine
```

---

## REST API Reference

Base URL: `http://localhost:5000`

### `GET /health`
Health check and model status.
```json
{
  "status": "ok",
  "model_ready": true,
  "train_size": 54000,
  "thresholds": { "high": 50, "medium": 20 },
  "version": "1.0.0"
}
```

### `GET /stats`
Returns `summary_report.json` — aggregate statistics from the last batch run.

### `POST /predict`
Score a single container. Returns full risk profile + explanation.

**Request:**
```json
{
  "Container_ID":     "CONT_99121",
  "Declared_Weight":  1200.0,
  "Measured_Weight":  1620.0,
  "Declared_Value":   8500.0,
  "Dwell_Time_Hours": 134.5,
  "Origin_Country":   "CN",
  "HS_Code":          "850340",
  "Importer_ID":      "IMP_9912",
  "Exporter_ID":      "EXP_0044",
  "Shipping_Line":    "COSCO",
  "Trade_Regime":     "Import",
  "Destination_Port": "AEJEA",
  "Declaration_Time": "02:17:00"
}
```

**Response:**
```json
{
  "Container_ID":        "CONT_99121",
  "Risk_Score":          81.4,
  "Risk_Level":          "High",
  "Risk_Level_Binary":   "Critical",
  "Explanation_Summary": "Weight excess 35%; Extended dwell 135h; Off-hours declaration 02:17",
  "P_Clear":     0.0002,
  "P_Low_Risk":  0.0031,
  "P_Critical":  0.9967,
  "Anomaly_Flag":  1,
  "Anomaly_Score": 0.8832
}
```

### `POST /batch`
Score up to 10,000 containers in a single request. Body: JSON array of container objects.

**Response:**
```json
{
  "results": [...],
  "summary": {
    "total": 500,
    "high_risk": 6,
    "medium_risk": 93,
    "low_risk": 401,
    "anomalies": 62,
    "critical_pct": 1.2
  }
}
```

### `POST /batch-csv`
Upload a CSV file and receive a scored CSV back.

```bash
curl -X POST http://localhost:5000/batch-csv \
  -F "file=@Real-Time_Data.csv" \
  -o risk_predictions.csv
```

---

## Output: `risk_predictions.csv`

| Column | Description |
|---|---|
| `Container_ID` | Unique container identifier |
| `Risk_Score` | Float 0–100 (higher = riskier) |
| `Risk_Level` | **High / Medium / Low** (3-level, per Must Have) |
| `Risk_Level_Binary` | **Critical / Low Risk** (2-level, per Output Spec) |
| `Explanation_Summary` | Natural language justification (up to 3 signals) |
| `P_Clear` | Model probability of Clear status |
| `P_Low_Risk` | Model probability of Low Risk |
| `P_Critical` | Model probability of Critical |
| `Anomaly_Flag` | 1 = flagged by Isolation Forest |
| `Anomaly_Type_Weight` | 1 = weight discrepancy >25% |
| `Anomaly_Type_ValueWt` | 1 = value-to-weight statistical outlier |
| `Anomaly_Type_Behaviour` | 1 = importer/country risk flag |
| `Anomaly_Score` | Normalised Isolation Forest score (0–1) |
| `Weight_Diff_Pct` | |Measured − Declared| / Declared |
| `Value_Per_Kg` | Declared value divided by declared weight |
| `Origin_Country` | ISO country code |
| `HS_Code` | Harmonised System commodity code |
| `Dwell_Time_Hours` | Hours in port |
| `Declaration_Date` | Date of shipment declaration |

---

## Risk Thresholds

```
Score ≥ 50  → High Risk   (Critical)     — Immediate physical inspection
Score 20–49 → Medium Risk                — Secondary screening / document review
Score < 20  → Low Risk                   — Standard clearance
```

---

## Model Architecture

### Random Forest Classifier
- **400 trees**, max depth 12, min_samples_leaf 5
- Class weights: Clear×1, Low Risk×2, Critical×15 (handles 1% class imbalance)
- Stratified 85/15 train/test split
- **AUC-ROC: 1.0000** | **F1 (Critical): 0.9939** | **Accuracy: 99.88%**

### Isolation Forest (Anomaly Detection)
- **300 trees**, contamination rate 12%
- Trained on full historical data, applied to real-time batch
- Detects 3 anomaly types: weight, value-to-weight, behavioural

### Blended Score Formula
```
Risk_Score = (0.70 × P(Critical) × 100
           + 0.70 × P(Low Risk)  × 40
           + 0.30 × Anomaly_Score_norm × 100) ÷ 1.70
```

---

## 30 Engineered Features

| Group | Features |
|---|---|
| Weight Discrepancy (6) | diff_abs, diff_pct, ratio, over_flag, under_flag, large_disc |
| Value / Weight (5) | value_per_kg, log_vpk, log_value, very_low_value, high_value |
| Value Anomaly (2) | vpw_zscore, vpw_outlier (per-HS-chapter z-score) |
| Dwell Time (4) | dwell, log_dwell, long_flag, very_long_flag |
| Declaration Time (2) | decl_hour, night_flag |
| HS Code (2) | chapter, chapter_crit_rate |
| Trade Regime (2) | is_transit, is_export |
| Behavioural (3) | country_crit_rate, importer_crit_rate, exporter_crit_rate |
| Shipping (2) | shipping_freq, rare_line_flag |
| Routing + Composite (2) | dest_port_enc, multi_risk_score |

---

## Anomaly Detection — 3 Signal Types

1. **Weight Discrepancy** — |Measured − Declared| > 25% of declared weight
2. **Value-to-Weight Ratio** — Z-score > 2.5 std deviations from HS-chapter median
3. **Behavioural Irregularities** — importer_crit_rate > 5% OR country_crit_rate > 3%

---

## Dashboard (React)

Open `SmartContainer_Dashboard.jsx` in claude.ai as an artifact.

**5 tabs:**
- **Overview** — KPIs, score distribution, risk breakdown, dwell time, origin/HS analysis
- **Inspection Queue** — Top 15 critical containers with full details and explanations
- **Feature Analysis** — Feature importance bars, anomaly detection breakdown, all 30 features
- **System Design** — Customs workflow integration, REST API docs, deployment commands, sample API payloads
- **Model Info** — Architecture specs, performance metrics, scoring formula, dataset summary

---

## Results Summary (Real-Time Batch of 8,481 Containers)

| Metric | Value |
|---|---|
| Total containers processed | 8,481 |
| High Risk (score ≥ 50) | 73 (0.9%) |
| Medium Risk (20–49) | 1,754 (20.7%) |
| Low Risk (< 20) | 6,654 (78.5%) |
| Anomalies detected (Isolation Forest) | 1,049 (12.4%) |
| — Weight discrepancy type | 25 |
| — Value-to-weight type | 267 |
| — Behavioural type | 458 |
| Model AUC-ROC | 1.0000 |
| Test Accuracy | 99.88% |
| F1 (Critical) | 0.9939 |

---

## Key Findings

1. **Weight discrepancy dominates risk prediction** — 56.95% combined feature importance for weight features. Critical containers average 22.9% weight variance vs 2.5% for cleared (9.2× difference).
2. **Importer history is highly predictive** — 9.96% feature importance. All top 15 critical containers have importers with elevated historical critical rates (14–100%).
3. **Dwell time separates risk levels** — Critical containers average 75.3h vs 40.7h for cleared (1.85× longer).
4. **HS chapters 84/85/90/95 account for 61% of critical containers** despite being only 28% of total volume. Electronics, machinery, toys, and optics are highest-risk commodity classes.
5. **Isolation Forest aligns with RF predictions** — 100% of top 15 critical containers are flagged as anomalies by both models, validating the ensemble approach.
6. **Model achieves perfect AUC-ROC (1.000)** — Highly discriminative features, particularly the combination of weight discrepancy with importer behavioural history.

---

## Tech Stack

- **Python 3.x** — pandas, numpy, scikit-learn
- **Flask** — REST API server
- **Gunicorn** — Production WSGI server
- **Docker** — Containerization
- **React + Recharts** — Interactive dashboard
