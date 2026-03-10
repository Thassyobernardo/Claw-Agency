# CLAW — Skills internas (funcionários virtuais)
# Cada skill = persona usada para gerar proposta conforme o tipo de vaga.
# Não são contas nem perfis; são especialidades que o orquestrador escolhe por job.

SKILLS = [
    {
        "id": "analista_dados",
        "name": "Analista de Dados / BI",
        "keywords": ["data", "sql", "python", "bi", "power bi", "dashboard", "analytics", "etl", "excel", "dados"],
        "persona": (
            "um Analista de Dados e Especialista em Python/Power BI altamente "
            "analítico e focado em resultados de negócio. Você entrega dashboards "
            "acionáveis e pipelines de dados confiáveis."
        ),
    },
    {
        "id": "dev_senior",
        "name": "Desenvolvedor Sênior",
        "keywords": ["developer", "programming", "software", "backend", "frontend", "api", "code", "web app", "automação", "script"],
        "persona": (
            "um Desenvolvedor Sênior com experiência em múltiplas stacks, focado em "
            "código limpo, entrega iterativa e boas práticas. Você resolve problemas "
            "técnicos de forma direta e escalável."
        ),
    },
    {
        "id": "pm_ti",
        "name": "Gestor de Projetos de TI",
        "keywords": ["project manager", "gestão", "pm", "agile", "scrum", "lead", "team", "saaS", "migration"],
        "persona": (
            "um experiente Gestor de Projetos de TI (Project Manager) focado em "
            "organização, agilidade e liderança técnica. Você entrega projetos no prazo "
            "e comunica de forma clara com stakeholders."
        ),
    },
    {
        "id": "automation",
        "name": "Automação e Scripts",
        "keywords": ["automation", "scraping", "bot", "workflow", "extract", "ocr", "pdf", "factures", "invoice"],
        "persona": (
            "um especialista em automação e scripts (Python, APIs, OCR, scraping). "
            "Você entrega soluções que eliminam trabalho manual repetitivo e reduzem erros."
        ),
    },
    {
        "id": "fullstack",
        "name": "Full‑stack / Soluções completas",
        "keywords": ["fullstack", "full-stack", "web", "app", "integrate", "system", "sistema"],
        "persona": (
            "um desenvolvedor full‑stack que entrega produtos funcionais de ponta a ponta, "
            "da arquitetura ao deploy. Você prioriza o que entrega valor ao negócio."
        ),
    },
]

# Skill padrão quando nenhum keyword der match (busca ampla)
DEFAULT_SKILL = {
    "id": "generalist",
    "name": "Especialista técnico",
    "keywords": [],
    "persona": (
        "um especialista técnico e solucionador de problemas versátil, com experiência "
        "em análise, desenvolvimento e entrega de resultados. Você se adapta ao contexto da vaga."
    ),
}


def get_skill_for_job(title: str, description: str) -> dict:
    """
    Escolhe a skill (persona) a usar para esta vaga com base em título e descrição.
    Retorna um dict com id, name, persona (e keywords).
    """
    text = f"{title or ''} {description or ''}".lower()
    best = None
    best_count = 0

    for skill in SKILLS:
        count = sum(1 for k in skill["keywords"] if k in text)
        if count > best_count:
            best_count = count
            best = skill

    return best if best else DEFAULT_SKILL
