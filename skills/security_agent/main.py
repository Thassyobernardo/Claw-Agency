"""
EcoLink Australia — Security Agent FastAPI App

Endpoints:
  GET  /security/health      — health check do agente
  GET  /security/scan        — executa auditoria completa agora
  GET  /security/report      — retorna o último relatório em cache
  POST /security/schedule    — agenda auditoria periódica (cron)

Run:
  uvicorn skills.security_agent.main:app --reload --port 8001
"""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks, Security, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader

from .scanner  import run_full_audit
from .notifier import send_telegram_alert

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ecolink.security.api")

# ---------------------------------------------------------------------------
# Estado global (cache do último relatório)
# ---------------------------------------------------------------------------
_last_report: dict = {}
_scan_lock = asyncio.Lock()

PROJECT_ROOT = Path(os.environ.get("PROJECT_ROOT", Path(__file__).parent.parent.parent))

# ---------------------------------------------------------------------------
# Auth (mesma API Key do projeto principal)
# ---------------------------------------------------------------------------
_API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


async def _verify_api_key(api_key: str = Security(_API_KEY_HEADER)) -> str:
    expected = os.environ.get("INTERNAL_API_KEY")
    if not expected or api_key != expected:
        raise HTTPException(status_code=403, detail="Invalid or missing API key.")
    return api_key


# ---------------------------------------------------------------------------
# Background: scan periódico
# ---------------------------------------------------------------------------
async def _periodic_scan(interval_hours: int = 24) -> None:
    """Roda uma auditoria a cada `interval_hours` horas em background."""
    while True:
        await asyncio.sleep(interval_hours * 3600)
        logger.info("Iniciando scan periódico de segurança...")
        await _run_scan_and_notify()


async def _run_scan_and_notify() -> dict:
    global _last_report
    async with _scan_lock:
        # Roda o scanner (síncrono) em thread separada para não bloquear o event loop
        loop = asyncio.get_event_loop()
        report = await loop.run_in_executor(None, run_full_audit, str(PROJECT_ROOT))
        _last_report = report

        # Notificar via Telegram apenas se houver achados críticos ou altos
        critical = report.get("by_severity", {}).get("critical", 0)
        high     = report.get("by_severity", {}).get("high", 0)
        if critical > 0 or high > 0:
            await send_telegram_alert(report)

    return report


# ---------------------------------------------------------------------------
# Lifespan: inicia scan periódico ao subir a API
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Security Agent iniciado. Agendando scan periódico (24h).")
    task = asyncio.create_task(_periodic_scan(interval_hours=24))
    yield
    task.cancel()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="EcoLink Security Agent",
    description=(
        "Agente autônomo de segurança que monitora segredos expostos, "
        "vulnerabilidades de dependências, histórico Git e variáveis de ambiente."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

_allowed_origins = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:18789",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "Accept"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/security/health", tags=["Security Agent"])
async def health() -> dict:
    """Health check público — não requer autenticação."""
    return {
        "status":    "ok",
        "agent":     "EcoLink Security Agent",
        "version":   "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "last_scan": _last_report.get("scanned_at", "nunca"),
    }


@app.get(
    "/security/scan",
    tags=["Security Agent"],
    dependencies=[Depends(_verify_api_key)],
)
async def trigger_scan(background_tasks: BackgroundTasks) -> dict:
    """
    Dispara uma auditoria de segurança completa.
    O resultado fica disponível em GET /security/report após a conclusão.
    """
    background_tasks.add_task(_run_scan_and_notify)
    return {
        "status":  "scanning",
        "message": "Auditoria iniciada em background. Consulte /security/report em alguns segundos.",
    }


@app.get(
    "/security/report",
    tags=["Security Agent"],
    dependencies=[Depends(_verify_api_key)],
)
async def get_report() -> dict:
    """Retorna o último relatório de auditoria em cache."""
    if not _last_report:
        raise HTTPException(
            status_code=404,
            detail="Nenhum relatório disponível. Execute GET /security/scan primeiro.",
        )
    return _last_report


@app.get(
    "/security/scan/sync",
    tags=["Security Agent"],
    dependencies=[Depends(_verify_api_key)],
)
async def trigger_scan_sync() -> dict:
    """
    Executa a auditoria de forma síncrona e retorna o resultado imediatamente.
    Pode demorar alguns segundos dependendo do tamanho do projeto.
    """
    report = await _run_scan_and_notify()
    return report
