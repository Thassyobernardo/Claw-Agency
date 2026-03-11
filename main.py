import os
import logging
import threading
import re
import requests
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
from groq import Groq
from database import (
    get_stats,
    get_leads,
    get_tenant_stats,
    get_tenant_leads,
    save_lead,
    log_action,
    get_upwork_proposals_count_today,
    get_other_platforms_proposals_count_today,
    get_cold_emails_sent_today,
)
from config.skills import get_skill_for_job
from config.quotas import (
    UPWORK_MAX_PROPOSALS_PER_DAY,
    UPWORK_MIN_BUDGET_USD,
    OTHER_PLATFORMS_MAX_PER_DAY,
    COLD_EMAIL_MAPS_MAX_PER_DAY,
    parse_budget_to_usd,
    OTHER_PLATFORM_SOURCES,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

# Cliente Groq global (inicializado sob demanda)
groq_client = None


# ---------------- PLAYWRIGHT SNIPER (APPLY ASSISTIDO) ----------------
def run_upwork_sniper(job_url: str, proposal_text: str) -> None:
    """
    Abre a URL exata da vaga no Upwork, garante login
    e tenta chegar até o campo de cover letter para colar o texto.
    Não clica em "Submit" – você revisa e envia manualmente.
    """
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

    email = os.getenv("UPWORK_EMAIL")
    password = os.getenv("UPWORK_PASSWORD")

    if not email or not password:
        log.warning("UPWORK_EMAIL/UPWORK_PASSWORD não configurados; sniper não será executado.")
        return

    try:
        log.info(f"🎯 [SNIPER] Abrindo vaga específica no Upwork: {job_url}")
        with sync_playwright() as p:
            user_data_dir = "./upwork_profile"
            context = p.chromium.launch_persistent_context(
                user_data_dir,
                headless=True,
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
            )
            page = context.new_page()

            # 1) Abre a página da vaga
            page.goto(job_url, wait_until="domcontentloaded", timeout=60000)

            # 2) Se cair na tela de login, tenta autenticar
            current_url = page.url.lower()
            if "login" in current_url or "log-in" in current_url:
                log.info("🔐 [SNIPER] Tela de login detectada, tentando autenticar...")
                try:
                    page.fill('input[name="username"]', email, timeout=15000)
                except PlaywrightTimeoutError:
                    # Tentativa alternativa de seletor
                    try:
                        page.fill('input#login_username', email, timeout=15000)
                    except PlaywrightTimeoutError:
                        log.warning("Não foi possível encontrar campo de email no Upwork.")
                try:
                    page.click('button[type="submit"]', timeout=15000)
                except PlaywrightTimeoutError:
                    log.warning("Não foi possível clicar no botão de continuar login (email).")

                # Campo de senha
                try:
                    page.fill('input[type="password"]', password, timeout=20000)
                    page.click('button[type="submit"]', timeout=15000)
                except PlaywrightTimeoutError:
                    log.warning("Não foi possível preencher/clicar no campo de senha.")

            # 3) Tenta achar e clicar em "Submit a proposal"
            try:
                submit_button = None
                # Botão com texto "Submit a proposal"
                for locator in [
                    'button:has-text("Submit a proposal")',
                    'a:has-text("Submit a proposal")',
                ]:
                    try:
                        submit_button = page.locator(locator).first
                        if submit_button and submit_button.is_enabled():
                            break
                    except Exception:
                        continue

                if submit_button:
                    log.info("📝 [SNIPER] Clicando em 'Submit a proposal'...")
                    submit_button.click(timeout=30000)
                else:
                    log.warning("[SNIPER] Não encontrei botão 'Submit a proposal'. Apenas deixei a vaga aberta.")

            except Exception as e:
                log.warning(f"[SNIPER] Erro ao tentar clicar em 'Submit a proposal': {e}")

            # 4) Tenta localizar o campo de cover letter e colar a proposta
            try:
                textarea = None
                possible_selectors = [
                    'textarea[name="coverLetter"]',
                    'textarea[data-qa="cover-letter-textarea"]',
                    'textarea',
                ]
                for sel in possible_selectors:
                    try:
                        t = page.locator(sel).first
                        if t and t.is_visible():
                            textarea = t
                            break
                    except Exception:
                        continue

                if textarea:
                    log.info("✍️ [SNIPER] Colando proposta no campo de cover letter (sem enviar).")
                    textarea.fill(proposal_text[:4000])  # limite de segurança
                else:
                    log.warning("[SNIPER] Não consegui localizar o campo de cover letter.")

            except Exception as e:
                log.warning(f"[SNIPER] Erro ao tentar preencher cover letter: {e}")

            # Mantém o contexto salvo (cookies/sessão) e fecha
            context.close()
        log.info("✅ [SNIPER] Execução concluída (texto colado se campos foram encontrados).")
    except Exception as e:
        log.error(f"❌ [SNIPER] Erro crítico no sniper do Upwork: {e}")


# ---------------- CORS & SECURITY ----------------
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response


@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def handle_options(path):
    return "", 204


def check_auth(req):
    """
    Autorização simples via header Authorization: Bearer <JWT_SECRET>.
    Mantém compatível com o painel sem hardcode de token.
    """
    token = req.headers.get("Authorization")
    expected_secret = os.getenv("JWT_SECRET")
    if not expected_secret:
        # Se não tiver JWT_SECRET definido, não bloqueia (modo dev)
        return True
    expected_token = f"Bearer {expected_secret}"
    return token == expected_token


# ---------------- TELEGRAM ----------------
def send_telegram(text: str) -> None:
    token = os.getenv("TELEGRAM_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        log.warning("Telegram não configurado (TELEGRAM_TOKEN/TELEGRAM_CHAT_ID ausentes).")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        requests.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
            timeout=10,
        )
    except Exception as e:
        log.error(f"Erro no Telegram: {e}")


# ---------------- APIFY (O CAÇADOR) ----------------
def get_jobs_from_apify():
    """
    Dispara um Actor no Apify para buscar vagas.
    Formato IDEAL de cada item retornado pelo Actor:
    {
        "title": str,
        "description": str,
        "budget": str,
        "url": str  # URL pública da vaga no Upwork
    }
    Se não houver configuração, devolve exemplos fake para não quebrar.
    """
    log.info("🔍 Acionando Apify para extrair vagas...")
    apify_token = os.getenv("APIFY_TOKEN")
    actor_id = os.getenv("APIFY_ACTOR_ID")  # configure no .env

    # Fallback seguro se não tiver credenciais configuradas
    if not apify_token or not actor_id:
        log.warning("Apify não configurado (APIFY_TOKEN/APIFY_ACTOR_ID). Usando vagas mock.")
        return [
            {
                "title": "Need a Power BI Dashboard for Sales",
                "description": "Looking for a data analyst to connect our SQL database to Power BI and build a dynamic dashboard.",
                "budget": "$500",
                "url": "https://www.upwork.com/jobs/~example-power-bi-dashboard",
            },
            {
                "title": "IT Project Manager for SaaS migration",
                "description": "Need an experienced PM to lead a team of 3 devs migrating our legacy system to AWS.",
                "budget": "$1500",
                "url": "https://www.upwork.com/jobs/~example-it-project-manager",
            },
        ]

    try:
        # 1) Dispara o Actor e espera ele terminar
        url = (
            f"https://api.apify.com/v2/acts/{actor_id}/runs"
            f"?token={apify_token}&waitForFinish=120000&timeout=120000"
        )
        resp = requests.post(url, json={}, timeout=130)
        resp.raise_for_status()
        data = resp.json().get("data", {}) or {}

        status = data.get("status")
        if status not in {"SUCCEEDED", "SUCCEEDED_WITH_WARNINGS"}:
            log.warning(f"Run do Apify terminou com status {status}.")

        dataset_id = data.get("defaultDatasetId")
        if not dataset_id:
            log.warning("Run do Apify não retornou defaultDatasetId.")
            return []

        # 2) Lê os items do dataset desse run
        items_url = (
            f"https://api.apify.com/v2/datasets/{dataset_id}/items"
            f"?token={apify_token}&clean=true&format=json"
        )
        items_resp = requests.get(items_url, timeout=60)
        items_resp.raise_for_status()
        items = items_resp.json()

        if not items:
            log.warning("Dataset do Apify veio vazio.")
        else:
            log.info(f"Apify retornou {len(items)} vagas.")

        return items
    except Exception as e:
        log.error(f"Erro ao chamar Apify: {e}")
        return []


# ---------------- GROQ AI (O CÉREBRO) ----------------
def generate_smart_proposal(
    job_title: str, job_description: str, skill: dict | None = None
) -> str:
    """
    Gera proposta com Groq. Se skill for passado, usa a persona dessa skill;
    senão usa uma persona genérica.
    """
    log.info(f"🧠 Gerando proposta com IA Groq para: {job_title}")
    groq_api_key = os.getenv("GROQ_API_KEY")

    if not groq_api_key:
        log.warning("GROQ_API_KEY não configurada. Usando mensagem default.")
        return "Olá, vi a sua vaga e tenho a experiência técnica necessária para ajudar. Podemos falar?"

    persona = (skill or {}).get("persona") or (
        "um especialista técnico e solucionador de problemas versátil."
    )
    if skill:
        log.info(f"   Skill usada: {skill.get('name', skill.get('id', '?'))}")

    system_prompt = (
        f"Você é {persona}. Escreva uma 'Cover Letter' curta, direta e altamente "
        f"persuasiva para o Upwork.\n"
        f"O cliente postou esta vaga: '{job_title}'.\n"
        f"Detalhes: '{job_description}'.\n"
        "Regras:\n"
        "- Não use clichês como 'I am writing to apply'.\n"
        "- Vá direto ao ponto mostrando como pode resolver o problema.\n"
        "- O idioma da proposta deve ser o mesmo idioma em que a vaga foi escrita "
        "(Inglês, Espanhol ou Português).\n"
        "- Assine como 'Thassyo'."
    )

    try:
        global groq_client
        if groq_client is None:
            groq_client = Groq(api_key=groq_api_key)

        chat_completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Escreva a proposta agora."},
            ],
            temperature=0.7,
            max_tokens=300,
        )

        return chat_completion.choices[0].message.content
    except Exception as e:
        log.error(f"Erro no Groq (SDK): {e}")
        return "Olá, vi a sua vaga e tenho a experiência técnica necessária para ajudar. Podemos falar?"


# ---------------- FONTES DE VAGAS (multi-plataforma) ----------------
def _ensure_job_format(j: dict) -> None:
    """Normaliza campos de job (Store LinkedIn/Remote OK podem usar nomes diferentes)."""
    if not j.get("title") and j.get("jobTitle"):
        j["title"] = j["jobTitle"]
    if not j.get("title") and j.get("position"):
        j["title"] = j["position"]
    if not j.get("url") and j.get("jobUrl"):
        j["url"] = j["jobUrl"]
    if not j.get("url") and j.get("link"):
        j["url"] = j["link"]
    if not j.get("description") and j.get("jobDescription"):
        j["description"] = j["jobDescription"]
    j.setdefault("title", j.get("title") or "Sem título")
    j.setdefault("description", j.get("description") or "")
    j.setdefault("budget", j.get("budget") or "N/A")
    j.setdefault("url", j.get("url") or "")


def get_jobs_from_remoteok():
    """
    Remote OK — volume diário, 100% robô. Envia para tudo que encaixe (ex.: Data Analyst).
    Configure REMOTEOK_ACTOR_ID + APIFY_TOKEN para usar um Actor Apify que raspe Remote OK.
    """
    token = os.getenv("APIFY_TOKEN")
    actor_id = os.getenv("REMOTEOK_ACTOR_ID")
    if not token or not actor_id:
        return []
    try:
        url = f"https://api.apify.com/v2/acts/{actor_id}/runs?token={token}&waitForFinish=120000&timeout=120000"
        resp = requests.post(url, json={}, timeout=130)
        resp.raise_for_status()
        data = resp.json().get("data", {}) or {}
        dataset_id = data.get("defaultDatasetId")
        if not dataset_id:
            return []
        items_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={token}&clean=true&format=json"
        items_resp = requests.get(items_url, timeout=60)
        items_resp.raise_for_status()
        items = items_resp.json() or []
        for j in items:
            j["platform"] = "remoteok"
            _ensure_job_format(j)
        log.info(f"Remote OK retornou {len(items)} vagas.")
        return items
    except Exception as e:
        log.warning(f"Remote OK: {e}")
        return []


def get_jobs_from_linkedin():
    """
    LinkedIn — volume diário. Configure LINKEDIN_ACTOR_ID + APIFY_TOKEN para um Actor que raspe vagas LinkedIn.
    """
    token = os.getenv("APIFY_TOKEN")
    actor_id = os.getenv("LINKEDIN_ACTOR_ID")
    if not token or not actor_id:
        return []
    try:
        url = f"https://api.apify.com/v2/acts/{actor_id}/runs?token={token}&waitForFinish=120000&timeout=120000"
        resp = requests.post(url, json={}, timeout=130)
        resp.raise_for_status()
        data = resp.json().get("data", {}) or {}
        dataset_id = data.get("defaultDatasetId")
        if not dataset_id:
            return []
        items_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={token}&clean=true&format=json"
        items_resp = requests.get(items_url, timeout=60)
        items_resp.raise_for_status()
        items = items_resp.json() or []
        for j in items:
            j["platform"] = "linkedin"
            _ensure_job_format(j)
        log.info(f"LinkedIn retornou {len(items)} vagas.")
        return items
    except Exception as e:
        log.warning(f"LinkedIn: {e}")
        return []


def get_jobs_from_sources():
    """
    Agrega vagas: Upwork (peixes grandes) + Remote OK + LinkedIn (volume).
    Cada item tem 'platform': 'upwork' | 'remoteok' | 'linkedin'.
    """
    jobs = []
    # Upwork (Apify) — peixes grandes
    for j in get_jobs_from_apify():
        j = dict(j)
        j["platform"] = "upwork"
        jobs.append(j)
    # Volume: Remote OK
    for j in get_jobs_from_remoteok():
        jobs.append(dict(j))
    # Volume: LinkedIn
    for j in get_jobs_from_linkedin():
        jobs.append(dict(j))
    return jobs


# ---------------- CORE MISSION ----------------
def run_claw_mission():
    try:
        send_telegram("🚀 *Claw Agent iniciado!* Buscando vagas em todas as fontes...")

        jobs = get_jobs_from_sources()
        if not jobs:
            send_telegram("⚠️ Nenhuma vaga encontrada desta vez.")
            return

        send_telegram(
            f"✅ Encontrei {len(jobs)} vagas. "
            f"Upwork (peixes grandes): max {UPWORK_MAX_PROPOSALS_PER_DAY}/dia. "
            f"Volume (Remote OK/LinkedIn): max {OTHER_PLATFORMS_MAX_PER_DAY}/dia."
        )

        enable_sniper = os.getenv("ENABLE_SNIPER_AUTO", "false").lower() == "true"
        upwork_today = get_upwork_proposals_count_today()
        other_today = get_other_platforms_proposals_count_today()
        max_jobs_this_run = int(os.getenv("CLAW_MAX_JOBS_PER_RUN", "20"))

        for job in jobs[:max_jobs_this_run]:
            title = job.get("title", "Sem título")
            description = job.get("description", "")
            budget = job.get("budget", "N/A")
            url = job.get("url", "Sem URL")
            platform = job.get("platform", "upwork")

            # Upwork: só peixes grandes (min budget) e limite 3/dia
            if platform == "upwork":
                if upwork_today >= UPWORK_MAX_PROPOSALS_PER_DAY:
                    log.info(f"⏸️ Limite Upwork atingido hoje ({upwork_today}/{UPWORK_MAX_PROPOSALS_PER_DAY}). Pulando: {title[:50]}...")
                    continue
                budget_usd = parse_budget_to_usd(budget)
                if budget_usd is not None and budget_usd < UPWORK_MIN_BUDGET_USD:
                    log.info(f"⏸️ Upwork: orçamento ${budget_usd} < ${UPWORK_MIN_BUDGET_USD} (peixes grandes). Pulando: {title[:50]}...")
                    continue

            # Volume (Remote OK / LinkedIn): limite 16/dia
            if platform in ("remoteok", "linkedin", "wwr"):
                if other_today >= OTHER_PLATFORMS_MAX_PER_DAY:
                    log.info(f"⏸️ Limite volume atingido hoje ({other_today}/{OTHER_PLATFORMS_MAX_PER_DAY}). Pulando: {title[:50]}...")
                    continue

            skill = get_skill_for_job(title, description)
            proposal = generate_smart_proposal(title, description, skill=skill)

            platform_label = {"upwork": "Upwork", "remoteok": "Remote OK", "linkedin": "LinkedIn", "wwr": "WWR"}.get(platform, platform)
            mensagem = (
                f"🎯 *NOVO LEAD* ({platform_label})\n\n"
                f"🛠 *Skill:* {skill.get('name', skill.get('id', '?'))}\n"
                f"💼 *Vaga:* {title}\n"
                f"💰 *Orçamento:* {budget}\n"
                f"🔗 *Link:* {url}\n\n"
                f"📝 *Proposta (Groq):*\n{proposal}\n\n"
                f"🔗 *Ação:* Copiar e colar no site."
            )
            send_telegram(mensagem)

            source_db = f"apify_{platform}"
            try:
                save_lead(
                    name=title[:255] if title else f"{platform_label} Lead",
                    email="",
                    phone="",
                    sector=job.get("category") or platform_label,
                    location=job.get("client_country") or "",
                    score=85,
                    source=source_db,
                    notes=url or (description[:500] if description else ""),
                    skill_used=skill.get("id", ""),
                )
                log_action("claw_proposal_sent", f"Vaga: {title[:80]} | Skill: {skill.get('id')}")
            except Exception as db_err:
                log.warning(f"Não foi possível salvar lead no banco: {db_err}")

            if platform == "upwork":
                upwork_today += 1
            elif platform in ("remoteok", "linkedin", "wwr"):
                other_today += 1

            # Sniper só para Upwork (URL conhecida)
            if platform == "upwork" and enable_sniper and url.startswith("http"):
                threading.Thread(
                    target=run_upwork_sniper,
                    args=(url, proposal),
                    daemon=True,
                ).start()

        log.info("✅ Missão finalizada com sucesso.")

    except Exception as e:
        log.error(f"❌ Erro Crítico: {e}")
        send_telegram(f"🚨 *Erro Crítico no Robô:* {str(e)[:200]}")


# ---------------- PANEL ENDPOINTS ----------------
@app.route("/api/copilot/action", methods=["POST"])
def handle_action():
    # Ative a linha abaixo se quiser exigir Authorization no botão do painel:
    # if not check_auth(request): return jsonify({"error": "Unauthorized"}), 401

    log.info("🚀 COMANDO RECEBIDO DO PAINEL! Orquestrador iniciando...")
    threading.Thread(target=run_claw_mission, daemon=True).start()
    return jsonify({"status": "started"}), 200


@app.route("/api/login", methods=["POST"])
def login():
    return jsonify({"token": "claw-token", "name": "Thassyo Bernardo"}), 200


@app.route("/api/my-stats", methods=["GET"])
def my_stats():
    """
    Estatísticas para o painel.
    Se no futuro houver multi-tenant, podemos ler um user_id do token.
    Por enquanto, usa agregados globais de leads/emails.
    """
    try:
        # Stats globais
        global_stats = get_stats()
        return jsonify(
            {
                "total_leads": global_stats.get("leads", 0),
                "emails_sent": global_stats.get("emails_sent", 0),
                # Aproximação simples: novos na última semana ~ scans_today
                "new_this_week": global_stats.get("scans_today", 0),
            }
        )
    except Exception as e:
        log.error(f"/api/my-stats error: {e}")
        return jsonify({"total_leads": 0, "new_this_week": 0, "emails_sent": 0}), 500


@app.route("/api/my-leads", methods=["GET"])
def my_leads():
    """
    Retorna os leads mais recentes para popular o painel.
    Por enquanto, retorna leads globais (tabela leads).
    """
    try:
        limit = int(request.args.get("limit", 50))
        leads = get_leads(limit=limit)
        return jsonify(leads)
    except Exception as e:
        log.error(f"/api/my-leads error: {e}")
        return jsonify([]), 500


@app.route("/api/jobs", methods=["GET"])
def jobs_feed():
    """
    Retorna vagas agregadas (Upwork + RemoteOK + LinkedIn via Apify).

    Query params:
      - limit: int (default 20, max 100)
      - include_mock: true/false (default false) — útil para testar sem Apify configurado
    """
    try:
        limit = int(request.args.get("limit", 20))
        limit = max(1, min(limit, 100))
        include_mock = (request.args.get("include_mock", "false").lower() == "true")
        debug = (request.args.get("debug", "false").lower() == "true")

        debug_info = None
        if debug:
            # Executa cada fonte separadamente para diagnosticar rapidamente.
            debug_info = {
                "env": {
                    "has_apify_token": bool(os.getenv("APIFY_TOKEN")),
                    "apify_actor_id": os.getenv("APIFY_ACTOR_ID") or "",
                    "remoteok_actor_id": os.getenv("REMOTEOK_ACTOR_ID") or "",
                    "linkedin_actor_id": os.getenv("LINKEDIN_ACTOR_ID") or "",
                },
                "sources": {},
            }

            def _run_source(name: str, fn):
                try:
                    items = fn() or []
                    return {"ok": True, "count": len(items), "error": None}
                except Exception as e:
                    return {"ok": False, "count": 0, "error": str(e)[:300]}

            debug_info["sources"]["upwork"] = _run_source("upwork", get_jobs_from_apify)
            debug_info["sources"]["remoteok"] = _run_source("remoteok", get_jobs_from_remoteok)
            debug_info["sources"]["linkedin"] = _run_source("linkedin", get_jobs_from_linkedin)

        jobs = get_jobs_from_sources()

        # Normaliza + filtra "peixes grandes" no Upwork
        filtered = []
        for j in jobs:
            j = dict(j or {})
            _ensure_job_format(j)

            platform = (j.get("platform") or "").lower()
            if platform == "upwork":
                budget_usd = parse_budget_to_usd(j.get("budget"))
                # Se conseguir ler orçamento, aplica filtro "peixes grandes".
                # Se NÃO conseguir ler (ex.: hourly / N/A), mantém a vaga e deixa budget_usd = None.
                if budget_usd is not None:
                    if budget_usd < UPWORK_MIN_BUDGET_USD:
                        continue
                    j["budget_usd"] = budget_usd
                else:
                    j["budget_usd"] = None

            filtered.append(j)

        # Se Apify não estiver configurado, Upwork volta mock; deixa opcional incluir isso
        if not include_mock:
            filtered = [j for j in filtered if not str(j.get("url", "")).startswith("https://www.upwork.com/jobs/~example")]

        # Limita saída
        filtered = filtered[:limit]

        return jsonify(
            {
                "jobs": filtered,
                "meta": {
                    "limit": limit,
                    "returned": len(filtered),
                    "upwork_min_budget_usd": UPWORK_MIN_BUDGET_USD,
                },
                "debug": debug_info,
            }
        ), 200
    except Exception as e:
        log.error(f"/api/jobs error: {e}")
        return jsonify({"jobs": [], "meta": {"returned": 0, "error": str(e)}}), 500


@app.route("/api/quotas", methods=["GET"])
def quotas():
    """
    Quotas diárias: Upwork (peixes grandes), volume (Remote OK/LinkedIn), Cold Email (Maps).
    Use para o painel ou para validar antes de enviar cold email (max 20/dia).
    """
    try:
        return jsonify({
            "upwork": {
                "sent_today": get_upwork_proposals_count_today(),
                "max_per_day": UPWORK_MAX_PROPOSALS_PER_DAY,
                "min_budget_usd": UPWORK_MIN_BUDGET_USD,
            },
            "other_platforms": {
                "sent_today": get_other_platforms_proposals_count_today(),
                "max_per_day": OTHER_PLATFORMS_MAX_PER_DAY,
            },
            "cold_email_maps": {
                "sent_today": get_cold_emails_sent_today(),
                "max_per_day": COLD_EMAIL_MAPS_MAX_PER_DAY,
            },
        }), 200
    except Exception as e:
        log.error(f"/api/quotas: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "agent": "claw", "time": datetime.utcnow().isoformat()}), 200


@app.route("/app", methods=["GET"])
def serve_dashboard():
    """Serve o painel CLAW (frontend) para que /api/* fique no mesmo domínio."""
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), "app.html", mimetype="text/html")


@app.route("/", methods=["GET"])
def index():
    return jsonify({"agent": "Claw Agency", "version": "3.0.0", "status": "running"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)