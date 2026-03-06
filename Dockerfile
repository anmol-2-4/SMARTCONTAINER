# ── SmartContainer Risk Engine — Dockerfile ──────────────────────
# Builds a production-ready container for the REST API.
#
# Build:
#   docker build -t smartcontainer-risk-engine .
#
# Run (with local data files):
#   docker run -p 5000:5000 \
#     -v $(pwd)/Historical_Data.csv:/app/Historical_Data.csv \
#     -v $(pwd)/Real-Time_Data.csv:/app/Real-Time_Data.csv \
#     smartcontainer-risk-engine
#
# Or via docker-compose:
#   docker-compose up

FROM python:3.11-slim

# Metadata
LABEL maintainer="SmartContainer Team"
LABEL description="AI/ML-based customs container risk scoring REST API"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY api.py .
COPY risk_engine.py .

# Create directory for data and outputs
RUN mkdir -p /app/data /app/outputs

# Environment variables (can be overridden at runtime)
ENV HIST_PATH=/app/Historical_Data.csv
ENV SUMMARY_PATH=/app/outputs/summary_report.json
ENV PORT=5000
ENV DEBUG=false

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Run the API server
CMD ["python", "api.py"]
