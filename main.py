import os
import logging
import threading
import re
import requests
from datetime import datetime
from flask import Flask, jsonify, request
from groq import Groq

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
def generate_smart_proposal(job_title: str, job_description: str) -> str:
    log.info(f"🧠 Gerando proposta com IA Groq para: {job_title}")
    groq_api_key = os.getenv("GROQ_API_KEY")

    if not groq_api_key:
        log.warning("GROQ_API_KEY não configurada. Usando mensagem default.")
        return "Olá, vi a sua vaga e tenho a experiência técnica necessária para ajudar. Podemos falar?"

    title_lower = job_title.lower()
    if any(w in title_lower for w in ["data", "sql", "python", "bi", "power"]):
        persona = (
            "um Analista de Dados e Especialista em Python/Power BI altamente "
            "analítico e focado em resultados de negócio."
        )
    elif any(w in title_lower for w in ["project", "manager", "gestão"]):
        persona = (
            "um experiente Gestor de Projetos de TI (Project Manager) focado em "
            "organização, agilidade e liderança técnica."
        )
    else:
        persona = "um especialista técnico e solucionador de problemas versátil."

    system_prompt = (
        f"Você é {persona} Escreva uma 'Cover Letter' curta, direta e altamente "
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


# ---------------- CORE MISSION ----------------
def run_claw_mission():
    try:
        send_telegram("🚀 *Claw Agent iniciado!* Acionando Apify para rastrear o mercado...")

        jobs = get_jobs_from_apify()
        if not jobs:
            send_telegram("⚠️ Nenhuma vaga encontrada no Apify desta vez.")
            return

        send_telegram(f"✅ Encontrei {len(jobs)} vagas alvo. A gerar propostas com IA...")

        enable_sniper = os.getenv("ENABLE_SNIPER_AUTO", "false").lower() == "true"

        for job in jobs[:3]:
            title = job.get("title", "Sem título")
            description = job.get("description", "")
            budget = job.get("budget", "N/A")
            url = job.get("url", "Sem URL")

            proposal = generate_smart_proposal(title, description)
            mensagem = (
                f"🎯 *NOVO LEAD (Via Apify)*\n\n"
                f"💼 *Vaga:* {title}\n"
                f"💰 *Orçamento:* {budget}\n"
                f"🔗 *Link da Vaga:* {url}\n\n"
                f"📝 *Proposta Gerada pelo Groq:*\n{proposal}\n\n"
                f"🔗 *Ação:* Vá ao Upwork para copiar e colar!"
            )
            send_telegram(mensagem)

            # Opcional: ativar sniper automático via variável de ambiente
            if enable_sniper and url.startswith("http"):
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
    # Mock estático por enquanto; pode ligar no database.py depois
    return jsonify({"total_leads": 210, "new_this_week": 25, "emails_sent": 112})


@app.route("/api/my-leads", methods=["GET"])
def my_leads():
    # Mock vazio; depois podemos conectar na tabela tenant_leads
    return jsonify([])


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "agent": "claw", "time": datetime.utcnow().isoformat()}), 200


@app.route("/", methods=["GET"])
def index():
    return jsonify({"agent": "Claw Agency", "version": "3.0.0", "status": "running"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)