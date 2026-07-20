FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps (psycopg[binary] ships its own libpq, so this stays minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/v1/health || exit 1

# --proxy-headers/--forwarded-allow-ips: Caddy is the sole ingress and connects
# from a Docker-network IP, which uvicorn does not trust by default. Without
# these, request.client.host is Caddy's IP for every request on the planet, so
# slowapi's per-IP rate limits collapse into one global bucket: "30/minute" on
# report creation would cap the entire platform at 30 reports a minute, and ten
# login attempts would lock out auth for everyone. Safe only because nothing
# reaches this container except the reverse proxy.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
