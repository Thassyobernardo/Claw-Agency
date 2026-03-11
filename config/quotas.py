# Quotas diárias — Upwork (peixes grandes), volume (Remote OK / LinkedIn), Cold Email (Maps)
# Upwork: 3/dia, foco em trabalhos caros. Outras plataformas: 16/dia. Cold Email Maps: 20/dia.

import os
import re

def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default

# Upwork = peixes grandes (poucas propostas/dia, perfil seguro)
UPWORK_MAX_PROPOSALS_PER_DAY = _int_env("UPWORK_MAX_PROPOSALS_PER_DAY", 3)
# Mínimo de orçamento (USD) para enviar no Upwork — só "peixes grandes"
UPWORK_MIN_BUDGET_USD = _int_env("UPWORK_MIN_BUDGET_USD", 300)

# Volume = Remote OK + LinkedIn (robô envia para tudo que encaixe)
OTHER_PLATFORMS_MAX_PER_DAY = _int_env("OTHER_PLATFORMS_MAX_PER_DAY", 16)

# Cold Email (Maps) = 20/dia — empresas que nem sabem que precisam de ti
COLD_EMAIL_MAPS_MAX_PER_DAY = _int_env("COLD_EMAIL_MAPS_MAX_PER_DAY", 20)

# Fontes que contam como "outras plataformas" (volume)
OTHER_PLATFORM_SOURCES = ("apify_remoteok", "apify_linkedin", "apify_wwr")


def parse_budget_to_usd(budget_str: str) -> int | None:
    """
    Tenta extrair valor numérico do orçamento em USD (ou converte € grosseiramente).
    Ex.: "$500" -> 500, "€300" -> ~330, "N/A" -> None.
    """
    if not budget_str or not isinstance(budget_str, str):
        return None
    # Remove espaços e pega números (com possível , ou .)
    cleaned = re.sub(r"[^\d.,]", "", budget_str.replace(",", "."))
    if not cleaned:
        return None
    try:
        value = float(cleaned)
        if "€" in budget_str or "eur" in budget_str.lower():
            value *= 1.1  # aproximação EUR -> USD
        return int(value)
    except ValueError:
        return None
