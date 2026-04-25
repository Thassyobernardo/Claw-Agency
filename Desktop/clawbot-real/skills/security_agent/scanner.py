"""
EcoLink Australia — Security Agent
Scanner de segredos e vulnerabilidades.
"""
from __future__ import annotations

import os
import re
import subprocess
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Literal
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("ecolink.security")

# ---------------------------------------------------------------------------
# Padrões de segredos conhecidos (regex)
# ---------------------------------------------------------------------------
SECRET_PATTERNS: list[tuple[str, str]] = [
    (r"sk_live_[a-zA-Z0-9]+",        "Stripe Live Key"),
    (r"sk_test_[a-zA-Z0-9]+",        "Stripe Test Key"),
    (r"AIza[0-9A-Za-z\-_]{35}",      "Google/Gemini API Key"),
    (r"xoxb-[0-9]{11}-[0-9a-zA-Z]+", "Slack Bot Token"),
    (r"ghp_[a-zA-Z0-9]{36}",         "GitHub Personal Token"),
    (r"re_[a-zA-Z0-9]{32}",          "Resend API Key"),
    (r"gsk_[a-zA-Z0-9]{52}",         "Groq API Key"),
    (r"whsec_[a-zA-Z0-9]+",          "Stripe Webhook Secret"),
    (r"(?i)password\s*=\s*['\"][^'\"]{6,}['\"]", "Hardcoded Password"),
    (r"(?i)secret\s*=\s*['\"][^'\"]{8,}['\"]",   "Hardcoded Secret"),
]

# Extensões de arquivo a verificar
SCAN_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".md"}

# Arquivos/pastas a ignorar sempre
SKIP_DIRS = {"node_modules", ".next", "__pycache__", ".git", "dist", "build", ".swarm", ".claude"}
SKIP_FILES = {".env", ".env.local", ".env.example", ".securityignore"}


# ---------------------------------------------------------------------------
# Modelos de resultado
# ---------------------------------------------------------------------------
class Finding:
    def __init__(
        self,
        severity: Literal["critical", "high", "medium", "low", "info"],
        category: str,
        title: str,
        detail: str,
        file: str = "",
        line: int = 0,
        recommendation: str = "",
    ):
        self.severity = severity
        self.category = category
        self.title = title
        self.detail = detail
        self.file = file
        self.line = line
        self.recommendation = recommendation
        self.ts = datetime.utcnow().isoformat() + "Z"

    def to_dict(self) -> dict:
        return {
            "severity":       self.severity,
            "category":       self.category,
            "title":          self.title,
            "detail":         self.detail,
            "file":           self.file,
            "line":           self.line,
            "recommendation": self.recommendation,
            "timestamp":      self.ts,
        }


# ---------------------------------------------------------------------------
# Scanner de segredos em arquivos do projeto
# ---------------------------------------------------------------------------
def scan_files_for_secrets(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    
    # Carregar .securityignore
    ignored_files = set()
    ignore_file = root / ".securityignore"
    if ignore_file.exists():
        for line in ignore_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                ignored_files.add(line.replace("/", os.sep))

    for path in root.rglob("*"):
        # Ignorar pastas proibidas
        if any(skip in path.parts for skip in SKIP_DIRS):
            continue
        # Ignorar arquivos proibidos
        if path.name in SKIP_FILES:
            continue
            
        rel_path = str(path.relative_to(root))
        if rel_path in ignored_files:
            continue

        # Apenas extensões relevantes
        if path.suffix not in SCAN_EXTENSIONS:
            continue
        if not path.is_file():
            continue

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for line_no, line in enumerate(content.splitlines(), start=1):
            for pattern, label in SECRET_PATTERNS:
                if re.search(pattern, line):
                    # Mascarar o valor encontrado para não expor em logs
                    masked = re.sub(pattern, "[REDACTED]", line).strip()
                    findings.append(Finding(
                        severity="critical",
                        category="secret_exposure",
                        title=f"{label} hardcoded em arquivo",
                        detail=f"Linha {line_no}: {masked}",
                        file=str(path.relative_to(root)),
                        line=line_no,
                        recommendation=(
                            f"Mova o valor para uma variável de ambiente e use "
                            f"os.environ.get() ou process.env. "
                            f"Revogue a chave imediatamente se ela foi exposta no Git."
                        ),
                    ))

    return findings


# ---------------------------------------------------------------------------
# Verificar se .env aparece no histórico Git
# ---------------------------------------------------------------------------
def check_git_history(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    try:
        result = subprocess.run(
            ["git", "log", "--all", "--full-history", "--", ".env"],
            capture_output=True,
            text=True,
            cwd=str(root),
            timeout=15,
        )
        if result.stdout.strip():
            findings.append(Finding(
                severity="critical",
                category="git_history",
                title=".env já foi commitado no histórico Git",
                detail=(
                    "O arquivo .env aparece no histórico de commits. "
                    "Qualquer pessoa com acesso ao repositório pode recuperar os segredos."
                ),
                file=".env",
                recommendation=(
                    "Execute: git filter-repo --path .env --invert-paths "
                    "para remover do histórico. Depois revogue TODAS as chaves expostas."
                ),
            ))
        else:
            logger.info("Git history: .env nunca foi commitado. OK.")
    except FileNotFoundError:
        findings.append(Finding(
            severity="info",
            category="git_history",
            title="Git não encontrado — histórico não verificado",
            detail="Instale o Git para habilitar esta verificação.",
            recommendation="winget install --id Git.Git -e",
        ))
    except subprocess.TimeoutExpired:
        logger.warning("Timeout ao verificar histórico Git.")

    return findings


# ---------------------------------------------------------------------------
# Verificar variáveis de ambiente críticas presentes
# ---------------------------------------------------------------------------
def check_env_vars(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    
    # Tentar carregar do .env manualmente se necessário
    env_values = {}
    env_path = root / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env_values[k.strip()] = v.strip()

    required_vars = {
        "DATABASE_URL":       "critical",
        "INTERNAL_API_KEY":   "high",
        "NEXTAUTH_SECRET":    "high",
        "STRIPE_SECRET_KEY":  "high",
        "TOKEN_ENCRYPTION_KEY": "high",
        "GROQ_API_KEY":       "medium",
        "GEMINI_API_KEY":     "medium",
    }

    for var, severity in required_vars.items():
        # Verifica no ambiente real OU no dicionário do .env
        value = os.environ.get(var) or env_values.get(var, "")
        if not value:
            findings.append(Finding(
                severity=severity,  # type: ignore[arg-type]
                category="missing_env",
                title=f"Variável de ambiente ausente: {var}",
                detail=f"{var} não está definida no ambiente nem no .env.",
                recommendation=f"Adicione {var} ao arquivo .env e ao Railway Variables.",
            ))
        elif len(value) < 8:
            findings.append(Finding(
                severity="high",
                category="weak_secret",
                title=f"Valor muito curto para {var}",
                detail=f"{var} tem apenas {len(value)} caracteres — muito fraco.",
                recommendation=f"Gere um novo valor: openssl rand -base64 32",
            ))

    return findings


# ---------------------------------------------------------------------------
# npm audit
# ---------------------------------------------------------------------------
def run_npm_audit(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    try:
        result = subprocess.run(
            ["npm", "audit", "--json"],
            capture_output=True,
            text=True,
            cwd=str(root),
            timeout=60,
        )
        data = json.loads(result.stdout or "{}")
        vuln = data.get("metadata", {}).get("vulnerabilities", {})
        critical = vuln.get("critical", 0)
        high = vuln.get("high", 0)
        moderate = vuln.get("moderate", 0)

        if critical > 0:
            findings.append(Finding(
                severity="critical",
                category="npm_vulnerability",
                title=f"npm audit: {critical} vulnerabilidade(s) crítica(s)",
                detail=f"Critical: {critical} | High: {high} | Moderate: {moderate}",
                recommendation="Execute: npm audit fix --force",
            ))
        elif high > 0:
            findings.append(Finding(
                severity="high",
                category="npm_vulnerability",
                title=f"npm audit: {high} vulnerabilidade(s) alta(s)",
                detail=f"High: {high} | Moderate: {moderate}",
                recommendation="Execute: npm audit fix",
            ))
        elif moderate > 0:
            findings.append(Finding(
                severity="medium",
                category="npm_vulnerability",
                title=f"npm audit: {moderate} vulnerabilidade(s) moderada(s)",
                detail=f"Moderate: {moderate}",
                recommendation="Execute: npm audit fix",
            ))
        else:
            logger.info("npm audit: sem vulnerabilidades críticas.")
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError) as e:
        findings.append(Finding(
            severity="info",
            category="npm_vulnerability",
            title="npm audit não pôde ser executado",
            detail=str(e),
            recommendation="Certifique-se de que npm está instalado e o package.json existe.",
        ))

    return findings


# ---------------------------------------------------------------------------
# pip-audit (Python dependencies)
# ---------------------------------------------------------------------------
def run_pip_audit() -> list[Finding]:
    findings: list[Finding] = []
    try:
        result = subprocess.run(
            ["pip-audit", "--format", "json"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        data = json.loads(result.stdout or "[]")
        if isinstance(data, list) and data:
            for vuln in data:
                pkg  = vuln.get("name", "?")
                ver  = vuln.get("version", "?")
                vulns = vuln.get("vulns", [])
                for v in vulns:
                    findings.append(Finding(
                        severity="high",
                        category="pip_vulnerability",
                        title=f"Vulnerabilidade Python: {pkg} {ver}",
                        detail=f"{v.get('id', '?')}: {v.get('description', '')[:200]}",
                        recommendation=f"Execute: pip install --upgrade {pkg}",
                    ))
        else:
            logger.info("pip-audit: sem vulnerabilidades Python.")
    except FileNotFoundError:
        findings.append(Finding(
            severity="info",
            category="pip_vulnerability",
            title="pip-audit não instalado",
            detail="pip-audit não encontrado no PATH.",
            recommendation="Execute: pip install pip-audit",
        ))
    except (subprocess.TimeoutExpired, json.JSONDecodeError) as e:
        logger.warning("pip-audit falhou: %s", e)

    return findings


# ---------------------------------------------------------------------------
# Runner principal
# ---------------------------------------------------------------------------
def run_full_audit(project_root: str | None = None) -> dict:
    root = Path(project_root or os.getcwd())
    
    # Forçar carga do .env da raiz do projeto
    env_path = root / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
        
    logger.info("Iniciando auditoria de segurança em: %s", root)

    all_findings: list[Finding] = []
    all_findings += scan_files_for_secrets(root)
    all_findings += check_git_history(root)
    all_findings += check_env_vars(root)
    all_findings += run_npm_audit(root)
    all_findings += run_pip_audit()

    by_severity: dict[str, list[dict]] = {
        "critical": [], "high": [], "medium": [], "low": [], "info": []
    }
    for f in all_findings:
        by_severity.setdefault(f.severity, []).append(f.to_dict())

    summary = {
        "scanned_at": datetime.utcnow().isoformat() + "Z",
        "project_root": str(root),
        "total_findings": len(all_findings),
        "by_severity": {k: len(v) for k, v in by_severity.items()},
        "findings": by_severity,
    }

    logger.info(
        "Auditoria concluida: %d achados (critical=%d, high=%d, medium=%d)",
        len(all_findings),
        len(by_severity["critical"]),
        len(by_severity["high"]),
        len(by_severity["medium"]),
    )

    return summary
