"""
EcoLink Australia — Security Agent Notifier
Envia alertas de segurança via Telegram.
"""
from __future__ import annotations

import os
import logging
import httpx

logger = logging.getLogger("ecolink.security.notifier")

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")

SEVERITY_EMOJI = {
    "critical": "🚨",
    "high":     "🔴",
    "medium":   "⚠️",
    "low":      "🟡",
    "info":     "ℹ️",
}


def _build_message(summary: dict) -> str:
    total    = summary.get("total_findings", 0)
    by_sev   = summary.get("by_severity", {})
    critical = by_sev.get("critical", 0)
    high     = by_sev.get("high", 0)
    medium   = by_sev.get("medium", 0)
    ts       = summary.get("scanned_at", "?")

    lines = [
        "<b>🛡️ EcoLink Security Agent — Relatório</b>",
        f"📅 {ts}",
        "",
        f"📊 <b>Resumo:</b> {total} achado(s)",
        f"  🚨 Crítico : {critical}",
        f"  🔴 Alto    : {high}",
        f"  ⚠️  Médio   : {medium}",
        "",
    ]

    # Listar até 5 achados críticos/altos
    findings = summary.get("findings", {})
    shown = 0
    for sev in ["critical", "high", "medium"]:
        for f in findings.get(sev, []):
            if shown >= 5:
                break
            emoji = SEVERITY_EMOJI.get(sev, "•")
            title = f['title'].replace("<", "&lt;").replace(">", "&gt;")
            lines.append(f"{emoji} <b>{title}</b>")
            if f.get("file"):
                lines.append(f"   📄 <code>{f['file']}</code>")
            if f.get("recommendation"):
                rec = f['recommendation'][:120].replace("<", "&lt;").replace(">", "&gt;")
                lines.append(f"   💡 <i>{rec}</i>")
            lines.append("")
            shown += 1

    if total - shown > 0:
        lines.append(f"<i>...e mais {total - shown} achado(s).</i>")

    if critical == 0 and high == 0:
        lines.append("✅ <b>Nenhuma vulnerabilidade crítica ou alta encontrada!</b>")

    return "\n".join(lines)


async def send_telegram_alert(summary: dict) -> bool:
    """Envia o relatório de auditoria para o Telegram usando HTML."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram não configurado.")
        return False

    message = _build_message(summary)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id":    TELEGRAM_CHAT_ID,
                    "text":       message,
                    "parse_mode": "HTML",
                },
            )
            resp.raise_for_status()
            logger.info("Alerta de segurança enviado ao Telegram.")
            return True
    except Exception as exc:
        logger.error("Falha ao enviar alerta Telegram: %s", exc)
        return False
