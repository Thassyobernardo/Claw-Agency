FROM python:3.11-slim

WORKDIR /app

# System deps: build, Postgres, e dependências do Chromium (Playwright)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Chromium para o Sniper (Upwork) em produção — path fixo para o runtime achar
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.cache/ms-playwright
RUN playwright install chromium

COPY . .

RUN mkdir -p builds

EXPOSE 8080

CMD ["/bin/sh", "-c", "gunicorn main:app --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 120"]
