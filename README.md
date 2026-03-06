# SMARTCONTAINER
AI-powered risk intelligence platform for customs container screening.

Team: `Syntax_Error`  
Members: `Anmol Gupta`, `Hari Om Mishra`, `Sagar Yadav`

## What It Does
- Trains on historical customs data.
- Scores incoming real-time containers with a `0-100` risk score.
- Classifies containers into `Critical / Low Risk` (and multi-level risk internally).
- Detects anomalies (weight mismatch, value-to-weight outliers, behavior patterns).
- Generates explainable reasons for each prediction.
- Provides a live dashboard + API for operational use.

## Project Flow
1. Train model on `Historical Data.csv` / `Historical_Data.csv`.
2. Run inference on `Real-Time Data.csv` / `Real-Time_Data.csv`.
3. Show decisions, drift, feedback, and audit artifacts in dashboard.

## Tech Stack
- Backend: `Python`, `Flask`, `scikit-learn`
- Frontend: `React`
- Models: `Random Forest` + `Isolation Forest`
- Deployment: local run, Docker-ready

## Run Locally

### 1) Backend API
```bash
cd /home/anmol/Desktop/s_cont
pip install -r requirements.txt
python3 api.py
```

API starts at: `http://localhost:5000`

### 2) Frontend Dashboard
```bash
cd /home/anmol/Desktop/s_cont/dashboard
npm install
npm start
```

Dashboard starts at: `http://localhost:3000`

## Key API Endpoints
- `GET /health`
- `GET /stats`
- `GET /drift`
- `GET /threshold-analysis`
- `GET /network`
- `POST /predict`
- `POST /batch`
- `POST /batch-csv`
- `POST /feedback`
- `GET /feedback-export`
- `POST /retrain-trigger`
- `GET /feedback-stats`
- `GET /audit-report`

## Output Artifacts
- `risk_predictions.csv`
- `summary_report.json`
- `feedback_log.jsonl`
- `retrain_requests.jsonl`

## Hackathon Highlights
- Real-time risk triage for officers.
- Human-in-the-loop feedback loop.
- Drift monitoring and threshold optimization.
- Audit report export for governance.
- Explainable risk profile per container.

## Judge Quick Demo
1. Start backend (`python3 api.py`).
2. Start dashboard (`npm start` in `dashboard/`).
3. Open `http://localhost:3000`.
4. Use **Check Container** for single prediction and **Workflow** for audit/drift/feedback.

## Repository
GitHub: `https://github.com/anmol-2-4/SMARTCONTAINER`
