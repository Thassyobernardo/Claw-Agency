# EcoLink Australia — Project Brief
> Documento de referência leve. Leia antes de qualquer sessão de código.
> Última atualização: Fase 3 concluída.

---

## 🎯 O Negócio em 2 Linhas

A partir de 2026, grandes corporações australianas vão **exigir relatórios de emissões Escopo 3** dos seus fornecedores (PMEs). PMEs que não tiverem esses dados perdem contratos. O EcoLink resolve isso automaticamente: conecta no Xero/MYOB da PME, lê os gastos, e usa IA para calcular a pegada de carbono.

**Modelo:** SaaS B2B, assinatura mensal. Cliente = PME australiana. Comprador real = pressão dos contratos corporativos.

---

## 🏗️ Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS v4, TypeScript |
| Backend IA | Python 3, FastAPI, Groq (primário), Gemini (fallback) |
| Banco de Dados | PostgreSQL (Railway) |
| Cache / Fila | Redis (Railway) |
| Deploy | Docker + Railway (`railway.json` + `Dockerfile` — não alterar) |
| Notificações | Telegram Bot |
| Integração contábil | Xero OAuth 2.0 (UI pronta, OAuth na Fase 5) |

---

## 📁 Estrutura de Arquivos (o que importa)

```
/
├── .env                          ✅ Configurado (EcoLink vars + Xero)
├── openclaw.json                 ✅ Renomeado "EcoLink Core", skills atualizados
├── SOUL.md                       ✅ IA reescrita como Auditor ESG Australiano
├── requirements.txt              ✅ Atualizado (sem Apify/Cloudinary)
├── package.json                  ✅ Renomeado ecolink-australia
├── Dockerfile                    🔒 Intocado (deploy Railway)
├── railway.json                  🔒 Intocado (deploy Railway)
│
├── database/
│   ├── schema.sql                ✅ 5 tabelas completas
│   ├── migrate.ts                ✅ Runner idempotente (--schema / --seed)
│   └── seeds/
│       └── emission_factors.sql  ✅ 30 fatores NGA reais 2023-24
│
├── skills/spend_to_carbon_analyzer/
│   ├── __init__.py               ✅
│   ├── models.py                 ✅ Pydantic schemas (request/response)
│   ├── db.py                     ✅ Pool de conexão + queries
│   ├── classifier.py             ✅ Motor IA (keyword → Groq → Gemini)
│   ├── calculator.py             ✅ Cálculo CO2e (activity-based + spend-based)
│   ├── main.py                   ✅ FastAPI endpoints (/analyse /factors /health)
│   └── SKILL.md                  ✅ Documentação do skill
│
└── frontend/src/
    ├── app/
    │   ├── page.tsx              ⚠️ AINDA fala de "Tradies" — Fase 4
    │   ├── layout.tsx            ⚠️ Manter, só atualizar fonte/cores
    │   └── globals.css           ⚠️ Cores antigas (laranja) — Fase 4
    └── components/
        ├── Hero.tsx              ⚠️ Rebrand completo — Fase 4
        ├── AutomationFlow.tsx    ⚠️ Reescrever como "How It Works"
        ├── Pricing.tsx           ⚠️ Planos novos (ESG SaaS)
        ├── Showreel.tsx          ⚠️ Trocar por vídeo explicativo
        ├── Contact.tsx           ⚠️ Manter, atualizar copy
        └── Navbar.tsx            ⚠️ Rebrand
```

---

## ✅ O Que Está Feito (Fases 1–3)

### Fase 1 — Identidade
- `.env` limpo: sem Apify, Instagram, Cloudinary. Com Xero vars.
- `openclaw.json`: nome "EcoLink Core", skills ESG.
- `SOUL.md`: IA é Auditor ESG, não caçador de leads.

### Fase 2 — Banco de Dados
5 tabelas PostgreSQL prontas para rodar com `npm run migrate`:

| Tabela | Para quê |
|---|---|
| `companies` | PMEs cadastradas (ABN, Xero tenant, plano) |
| `users` | Logins (owner/admin/analyst/viewer) |
| `emission_factors` | 30 fatores NGA 2023-24 (Scope 1/2/3) |
| `transactions` | Gastos importados + resultado da classificação IA |
| `carbon_reports` | Relatórios finais AASB S1/S2 |

### Fase 3 — Motor de IA
API Python/FastAPI com 4 endpoints:

```
POST /analyse     → recebe array de transações → retorna CO2e por scope
GET  /factors     → lista fatores NGA (filtrar por scope/estado)
GET  /factors/:id → fator único
GET  /health      → health check
```

**Pipeline de classificação por transação:**
```
Descrição da transação
        ↓
[1] Keyword pre-match (rápido, sem LLM)
        ↓ (se falhar)
[2] Groq llama-3.3-70b (JSON mode, temp 0.1)
        ↓ (se falhar)
[3] Gemini 2.0 Flash (fallback)
        ↓
Confiança ≥ 70%?  →  "classified"
Confiança < 70%?  →  "needs_review"
Sem match?        →  "factor_not_found"
        ↓
Cálculo CO2e:
  Activity-based: litros/kWh × fator NGA  (preferido)
  Spend-based:    AUD × fator NGA          (fallback)
```

**Exemplo real:**
```
"BP Station Sydney $150"
→ Keyword match: "bp" → Combustion — Petrol (Scope 1)
→ Estimate: $150 / $2.10/L = ~71.4 L
→ 71.4 L × 2.289 kg CO2e/L = 163.4 kg CO2e ✅
```

---

## ⚠️ O Que Falta (Fase 4 — Frontend)

### Cores do design EcoLink (a trocar)
| Token | Valor | Uso |
|---|---|---|
| `aw-white` | `#FFFFFF` | Fundo principal |
| `aw-slate` | `#2D3748` | Texto e elementos escuros (troca o charcoal) |
| `aw-green` | `#16A34A` | Cor primária da marca (troca o laranja) |
| `aw-green-light` | `#DCFCE7` | Badges, highlights |
| `aw-gray` | `#F8FAFC` | Fundo de seções alternadas |

### Seções da Landing Page a criar/reescrever
| Componente | Status | O que fazer |
|---|---|---|
| `Navbar` | Reescrever | Logo EcoLink, links: How It Works / Pricing / Login |
| `Hero` | Reescrever | Headline ESG, subtext conformidade AASB, CTA "Start Free Trial" |
| `HowItWorks` | Criar (era AutomationFlow) | 3 passos: Connect → Analyse → Report. **+ vídeo explicativo embed** |
| `Pricing` | Reescrever | 3 planos: Starter $49/mo, Professional $149/mo, Enterprise custom |
| `Showreel` | Substituir | Dashboard preview estático (screenshot ou mockup SVG) |
| `Contact` | Atualizar copy | Manter estrutura, trocar copy |
| `Dashboard` (nova rota) | Criar `/dashboard` | Gráficos Scope 1/2/3 + botão "Connect Xero" |

### O vídeo explicativo (pedido desta mensagem)
Na seção `HowItWorks`, vamos usar embed de **Loom ou YouTube** com um placeholder elegante. A estrutura será:
```
[Vídeo embed 16:9 com play button]
"See how EcoLink turns your Xero invoices into a compliant carbon report in under 60 seconds."
```
Como ainda não temos o vídeo gravado, o componente vai renderizar um **placeholder interativo** (thumbnail estática + botão de play que abre modal) — fácil de trocar pelo URL real depois.

---

## 🔜 Fases Futuras (pós Fase 4)

| Fase | O quê |
|---|---|
| 5 | Xero OAuth completo (callback + token storage + sync) |
| 6 | Dashboard com dados reais (recharts ou chart.js) |
| 7 | Geração de PDF do relatório AASB S1/S2 |
| 8 | Autenticação (NextAuth ou Clerk) |
| 9 | MYOB integration |

---

## 🚀 Como Rodar Localmente

```bash
# 1. Banco de dados
npm run migrate

# 2. API Python (porta 8000)
npm run api:dev

# 3. Frontend Next.js (porta 3000)
cd frontend && npm run dev
```

---

## ⚡ Regras de Código (sempre lembrar)

- Todo texto do frontend: **English Australian (en-AU)**
- Design: **Functional Clarity** — sem excesso de animações
- `Dockerfile` e `railway.json`: **nunca editar**
- Emission factors: **nunca inventar** — só usar tabela NGA do banco
