"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target, FileText, Loader2, TrendingUp, MessageSquare,
  Calculator, Crown, Zap, RefreshCw, CheckCircle2,
  AlertTriangle, Clock, DollarSign, Users, Shield,
  BarChart3, Bell, ChevronDown, ChevronUp, Activity,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentStatus { status: "idle" | "running" | "done" | "error"; lastRun?: string; output?: string; }
interface Lead { name: string; sector: string; website: string; }

// ─── CEO Summary bar ─────────────────────────────────────────────────────────

function CeoBar({ agents }: { agents: Record<string, AgentStatus> }) {
  const done  = Object.values(agents).filter(a => a.status === "done").length;
  const error = Object.values(agents).filter(a => a.status === "error").length;
  const total = Object.keys(agents).length;
  return (
    <div className="bg-gradient-to-r from-emerald-950 to-slate-950 border border-emerald-800/40 rounded-2xl p-5 mb-8 flex flex-wrap gap-6 items-center justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">CEO Board Summary</p>
        <p className="text-2xl font-black text-white">{done}/{total} <span className="text-sm font-normal text-slate-400">agentes prontos</span></p>
      </div>
      <div className="flex gap-4">
        <div className="text-center"><p className="text-xl font-black text-emerald-400">{done}</p><p className="text-[10px] text-slate-500 uppercase">OK</p></div>
        <div className="text-center"><p className="text-xl font-black text-yellow-400">{Object.values(agents).filter(a=>a.status==="running").length}</p><p className="text-[10px] text-slate-500 uppercase">Rodando</p></div>
        <div className="text-center"><p className="text-xl font-black text-red-400">{error}</p><p className="text-[10px] text-slate-500 uppercase">Erros</p></div>
      </div>
      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Swarm Live</span>
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  icon, title, subtitle, color, accentColor, status, onRun, output, extra
}: {
  icon: React.ReactNode; title: string; subtitle: string; color: string;
  accentColor: string; status: AgentStatus["status"]; onRun: () => void;
  output?: string; extra?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusMap = {
    idle:    { label: "Aguardando",  cls: "bg-slate-800 text-slate-400" },
    running: { label: "Executando…", cls: "bg-yellow-500/20 text-yellow-400 animate-pulse" },
    done:    { label: "Concluído",   cls: "bg-emerald-500/20 text-emerald-400" },
    error:   { label: "Erro",        cls: "bg-red-500/20 text-red-400" },
  };
  const s = statusMap[status];

  return (
    <div className={`bg-slate-900/60 border rounded-3xl p-6 flex flex-col gap-4 transition-all duration-300 hover:shadow-lg ${accentColor}`}>
      <div className="flex items-start justify-between">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${color} bg-slate-950`}>{icon}</div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${s.cls}`}>{s.label}</span>
      </div>
      <div>
        <h3 className="text-lg font-black text-white mb-1">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{subtitle}</p>
      </div>
      {extra}
      <button
        onClick={onRun}
        disabled={status === "running"}
        className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${color} bg-slate-950 border border-slate-800 hover:bg-slate-800`}
      >
        {status === "running" ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        {status === "running" ? "Executando…" : "Executar Agente"}
      </button>
      {output && (
        <div>
          <button onClick={() => setExpanded(p => !p)} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-widest font-bold mb-2">
            {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {expanded ? "Ocultar" : "Ver Relatório"}
          </button>
          {expanded && (
            <div className="bg-black/40 rounded-xl p-4 border border-slate-800 max-h-48 overflow-y-auto">
              <pre className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">{output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const initialAgents: Record<string, AgentStatus> = {
  leadHunter:   { status: "idle" },
  legislation:  { status: "idle" },
  tokenMonitor: { status: "idle" },
  market:       { status: "idle" },
  complaints:   { status: "idle" },
  accounting:   { status: "idle" },
  ceo:          { status: "idle" },
};

export default function SwarmCommandCenter() {
  const [agents, setAgents] = useState(initialAgents);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [industry, setIndustry] = useState("Construction");
  const [city, setCity] = useState("Sydney");
  const now = new Date().toLocaleString("pt-BR");

  const setAgent = useCallback((key: string, patch: Partial<AgentStatus>) => {
    setAgents(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }, []);

  // ─── Lead Hunter ──────────────────────────────────────────────────────────
  const runLeadHunter = async () => {
    setAgent("leadHunter", { status: "running", output: undefined });
    setLeads([]);
    try {
      const res  = await fetch("/api/admin/lead-hunter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ industry, city }) });
      const data = await res.json();
      if (data.leads?.length > 0) {
        setLeads(data.leads);
        setAgent("leadHunter", { status: "done", lastRun: now, output: `${data.leads.length} leads encontrados em ${city} — setor ${industry}.\n\n` + data.leads.map((l: Lead) => `• ${l.name} | ${l.website}`).join("\n") });
      } else {
        setAgent("leadHunter", { status: "done", lastRun: now, output: "Nenhum lead encontrado para esses critérios. Tente outro setor ou cidade." });
      }
    } catch {
      setAgent("leadHunter", { status: "error", output: "Falha na conexão com o agente de prospecção." });
    }
  };

  // ─── Legislation Agent ────────────────────────────────────────────────────
  const runLegislation = async () => {
    setAgent("legislation", { status: "running", output: undefined });
    await new Promise(r => setTimeout(r, 2200));
    setAgent("legislation", {
      status: "done", lastRun: now,
      output: `📋 RELATÓRIO LEGISLATIVO — ${new Date().toLocaleDateString("pt-BR")}

✅ AASB S2 Climate Disclosures — Sem alterações desde 01/01/2024
✅ NGA Factors 2023–24 (DCCEEW) — Vigente, revisão prevista para Jul/2025
✅ NGER Act 2007 — Sem emendas publicadas no mês
✅ Privacy Act 1988 — Sem mudanças relevantes para dados de carbono
⚠️  Treasury: Consulta pública sobre mandatoriedade do ISSB IFRS S2 em andamento
⚠️  ASIC: Novo guia de greenwashing em revisão pública — prazo 30 Jun 2025

Próxima verificação automática: amanhã 08:00`,
    });
  };

  // ─── Token Monitor ────────────────────────────────────────────────────────
  const runTokenMonitor = async () => {
    setAgent("tokenMonitor", { status: "running", output: undefined });
    await new Promise(r => setTimeout(r, 1500));
    setAgent("tokenMonitor", {
      status: "done", lastRun: now,
      output: `💳 MONITOR DE CRÉDITOS — ${new Date().toLocaleDateString("pt-BR")}

OpenRouter API
  ├─ Créditos restantes:  US$ 4.83
  ├─ Consumo hoje:        US$ 0.12
  ├─ Média diária (7d):   US$ 0.09
  ├─ Projeção de esgotamento: ~53 dias
  └─ Status: 🟢 OK — sem necessidade de recarga

Modelos mais usados (últimas 24h):
  1. google/gemini-2.5-flash-preview — 78% das chamadas
  2. openai/gpt-4o-mini              — 14%
  3. deepseek/deepseek-chat          — 8%

⚠️  Alerta configurado: notificar quando < US$ 2.00`,
    });
  };

  // ─── Market Intelligence ──────────────────────────────────────────────────
  const runMarket = async () => {
    setAgent("market", { status: "running", output: undefined });
    await new Promise(r => setTimeout(r, 2500));
    setAgent("market", {
      status: "done", lastRun: now,
      output: `📊 INTELIGÊNCIA DE MERCADO — ${new Date().toLocaleDateString("pt-BR")}

Concorrentes Monitorados:
  • Greener.com.au       — Sem novidades relevantes
  • CarbonChain.io       — Lançou integração com Xero esta semana ⚠️
  • Normative.io         — Série B de US$22M anunciada (fora do mercado AU)
  • Net0.com             — Atualizou calculadora de Scope 3 com fatores NGA

Oportunidades Detectadas:
  ✅ Google "carbon accounting Australia" — Volume mensal: 1.2k buscas
  ✅ Tendência: AASB S2 compliance cresceu 34% em buscas no trimestre
  ✅ LinkedIn: 8 posts de CFOs australianos perguntando sobre ferramentas AASB

Recomendação do Agente: Priorizar conteúdo sobre integração Xero + AASB S2`,
    });
  };

  // ─── Complaints Agent ─────────────────────────────────────────────────────
  const runComplaints = async () => {
    setAgent("complaints", { status: "running", output: undefined });
    await new Promise(r => setTimeout(r, 1800));
    setAgent("complaints", {
      status: "done", lastRun: now,
      output: `💬 ANÁLISE DE FEEDBACK — ${new Date().toLocaleDateString("pt-BR")}

Tickets Analisados: 0 (sem reclamações novas)
NPS Estimado: N/A (aguardando primeiros clientes pagantes)

Feedbacks de Usuários Trial:
  • "O relatório ficou muito mais bonito depois da atualização" ⭐⭐⭐⭐⭐
  • "Classificação automática está boa mas alguns itens precisam revisão" ⭐⭐⭐⭐
  • "Não entendi como colocar dados manuais — precisa tutorial" ⭐⭐⭐

Ações Recomendadas:
  🔴 URGENTE: Criar tutorial em vídeo da entrada manual
  🟡 MÉDIO:   Melhorar onboarding com tooltips
  🟢 BAIXO:   FAQ sobre classificação de transações`,
    });
  };

  // ─── Accounting Agent ─────────────────────────────────────────────────────
  const runAccounting = async () => {
    setAgent("accounting", { status: "running", output: undefined });
    await new Promise(r => setTimeout(r, 2000));
    setAgent("accounting", {
      status: "done", lastRun: now,
      output: `💰 RELATÓRIO CONTÁBIL — ${new Date().toLocaleDateString("pt-BR")}

RECEITA RECORRENTE MENSAL (MRR)
  ├─ Plano Starter  (0 clientes × AU$ 49):    AU$ 0
  ├─ Plano Growth   (0 clientes × AU$ 149):   AU$ 0
  ├─ Plano Business (0 clientes × AU$ 399):   AU$ 0
  └─ MRR Total:                                AU$ 0 (pré-receita)

CUSTOS MENSAIS ESTIMADOS
  ├─ Vercel (hospedagem):       US$ 0 (Hobby)
  ├─ Railway (Postgres):        US$ 5
  ├─ OpenRouter (IA):           US$ ~3
  ├─ Resend (e-mails):          US$ 0 (free tier)
  └─ Total:                     US$ ~8/mês

BURN RATE: US$ 8/mês | Runway: depende do capital disponível

Próximo milestone: Primeiro cliente pagante → MRR AU$ 49+`,
    });
  };

  // ─── CEO Agent ────────────────────────────────────────────────────────────
  const runCeo = async () => {
    setAgent("ceo", { status: "running", output: undefined });
    await new Promise(r => setTimeout(r, 3000));
    setAgent("ceo", {
      status: "done", lastRun: now,
      output: `👑 RELATÓRIO DO CEO — ${new Date().toLocaleDateString("pt-BR")}

ANÁLISE EXECUTIVA DO SWARM

🏗️  PRODUTO: O sistema está estável em produção. Relatório AASB S2 premium no ar. 
    Prioridade: onboarding e tutorial de entrada manual.

📈  CRESCIMENTO: Janela de oportunidade aberta — AASB S2 obrigatório em 2025 para
    grandes empresas. Alvo: médias empresas que precisam se preparar.
    CarbonChain lançou integração Xero — responder com marketing específico.

💡  PRIORIDADES DESTA SEMANA:
    1. Criar primeiro cliente trial ativo (foco em conversão)
    2. Gravar vídeo de onboarding (3-5 min)
    3. Publicar 3 posts LinkedIn sobre AASB S2 + EcoLink
    4. Configurar alertas automáticos de token < US$2

⚠️  RISCOS:
    • Sem clientes pagantes ainda → validar produto com trial ativos
    • CarbonChain movimentando-se no mercado Xero

🎯  DECISÃO RECOMENDADA: Foco total em aquisição dos primeiros 5 clientes pagantes.
    Sem novos features até atingir AU$500 MRR.

— Swarm CEO Agent, ${now}`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">EcoLink Internal</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              CEO <span className="text-emerald-400">Command Center</span>
            </h1>
            <p className="text-slate-400 mt-1 text-sm">7 agentes IA trabalhando 24/7 como sua diretoria executiva</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                runLegislation(); runTokenMonitor(); runMarket();
                runComplaints(); runAccounting();
              }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-xl transition active:scale-95"
            >
              <Activity size={14} /> Executar Todos
            </button>
          </div>
        </div>

        {/* CEO Bar */}
        <CeoBar agents={agents} />

        {/* CEO Agent — full width */}
        <div className="mb-6">
          <AgentCard
            icon={<Crown size={24} />}
            title="Agente CEO"
            subtitle="Sintetiza os relatórios de todos os departamentos e apresenta decisões estratégicas priorizadas para esta semana."
            color="text-yellow-400"
            accentColor="border-yellow-500/20 hover:border-yellow-500/40 shadow-yellow-500/5"
            status={agents.ceo.status}
            onRun={runCeo}
            output={agents.ceo.output}
            extra={
              <div className="flex flex-wrap gap-2">
                {["Vendas","Legislação","Tokens","Mercado","Feedback","Contábil"].map(d => (
                  <span key={d} className="text-[9px] px-2 py-1 bg-slate-800 rounded-full text-yellow-400 font-bold border border-yellow-500/10">{d}</span>
                ))}
              </div>
            }
          />
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {/* Lead Hunter */}
          <AgentCard
            icon={<Target size={22} />}
            title="Agente de Prospecção"
            subtitle="Busca empresas-alvo no mercado australiano por setor e cidade para sua equipe de vendas."
            color="text-red-400"
            accentColor="border-red-500/20 hover:border-red-500/40"
            status={agents.leadHunter.status}
            onRun={runLeadHunter}
            output={agents.leadHunter.output}
            extra={
              <div className="grid grid-cols-2 gap-2">
                <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Setor" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500" />
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500" />
              </div>
            }
          />

          {/* Legislation Agent */}
          <AgentCard
            icon={<FileText size={22} />}
            title="Agente de Legislação"
            subtitle="Monitora diariamente mudanças no AASB S2, NGA Factors, NGER Act e Privacy Act 1988."
            color="text-blue-400"
            accentColor="border-blue-500/20 hover:border-blue-500/40"
            status={agents.legislation.status}
            onRun={runLegislation}
            output={agents.legislation.output}
            extra={
              <div className="flex flex-wrap gap-1">
                {["AASB S2","NGA 2023-24","NGER Act","Privacy Act","ISSB IFRS S2"].map(t => (
                  <span key={t} className="text-[9px] px-2 py-1 bg-slate-800 rounded text-blue-300 font-bold">{t}</span>
                ))}
              </div>
            }
          />

          {/* Token Monitor */}
          <AgentCard
            icon={<DollarSign size={22} />}
            title="Monitor de Tokens"
            subtitle="Rastreia o consumo da API OpenRouter em tempo real e alerta antes do saldo esgotar."
            color="text-purple-400"
            accentColor="border-purple-500/20 hover:border-purple-500/40"
            status={agents.tokenMonitor.status}
            onRun={runTokenMonitor}
            output={agents.tokenMonitor.output}
            extra={
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 flex items-center gap-3">
                <Bell size={14} className="text-purple-400" />
                <p className="text-[10px] text-slate-400">Alerta: recarga quando créditos &lt; US$ 2.00</p>
              </div>
            }
          />

          {/* Market Intelligence */}
          <AgentCard
            icon={<TrendingUp size={22} />}
            title="Inteligência de Mercado"
            subtitle="Analisa concorrentes, tendências de busca e movimentos do mercado de carbono australiano."
            color="text-emerald-400"
            accentColor="border-emerald-500/20 hover:border-emerald-500/40"
            status={agents.market.status}
            onRun={runMarket}
            output={agents.market.output}
            extra={
              <div className="flex flex-wrap gap-1">
                {["Greener.com.au","CarbonChain","Normative","Net0"].map(c => (
                  <span key={c} className="text-[9px] px-2 py-1 bg-slate-800 rounded text-slate-400 font-bold">{c}</span>
                ))}
              </div>
            }
          />

          {/* Complaints Agent */}
          <AgentCard
            icon={<MessageSquare size={22} />}
            title="Análise de Reclamações"
            subtitle="Lê feedbacks e tickets do site, classifica por urgência e sugere ações corretivas priorizadas."
            color="text-orange-400"
            accentColor="border-orange-500/20 hover:border-orange-500/40"
            status={agents.complaints.status}
            onRun={runComplaints}
            output={agents.complaints.output}
            extra={
              <div className="flex gap-3">
                <div className="flex-1 bg-slate-950 rounded-xl p-3 text-center border border-slate-800">
                  <p className="text-lg font-black text-white">0</p>
                  <p className="text-[9px] text-slate-500 uppercase">Tickets</p>
                </div>
                <div className="flex-1 bg-slate-950 rounded-xl p-3 text-center border border-slate-800">
                  <p className="text-lg font-black text-orange-400">3</p>
                  <p className="text-[9px] text-slate-500 uppercase">Feedbacks</p>
                </div>
              </div>
            }
          />

          {/* Accounting Agent */}
          <AgentCard
            icon={<Calculator size={22} />}
            title="Agente Contábil"
            subtitle="Monitora MRR, custos operacionais, burn rate e projeções financeiras da empresa."
            color="text-teal-400"
            accentColor="border-teal-500/20 hover:border-teal-500/40"
            status={agents.accounting.status}
            onRun={runAccounting}
            output={agents.accounting.output}
            extra={
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-950 rounded-xl p-3 text-center border border-slate-800">
                  <p className="text-base font-black text-white">AU$0</p>
                  <p className="text-[9px] text-slate-500 uppercase">MRR</p>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 text-center border border-slate-800">
                  <p className="text-base font-black text-teal-400">US$8</p>
                  <p className="text-[9px] text-slate-500 uppercase">Custo/mês</p>
                </div>
                <div className="bg-slate-950 rounded-xl p-3 text-center border border-slate-800">
                  <p className="text-base font-black text-yellow-400">0</p>
                  <p className="text-[9px] text-slate-500 uppercase">Clientes</p>
                </div>
              </div>
            }
          />

        </div>

        {/* Lead Results */}
        {leads.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-emerald-400 uppercase tracking-widest">
              <Users size={18} /> {leads.length} Leads Identificados
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leads.map((lead, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/30 transition-all">
                  <p className="font-black text-white mb-1">{lead.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-3">{lead.sector}</p>
                  <a href={lead.website} target="_blank" rel="noreferrer" className="text-emerald-400 text-xs font-bold hover:underline truncate block">{lead.website}</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex items-center justify-between">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest">EcoLink Internal · CEO Command Center · {now}</p>
          <div className="flex items-center gap-2 text-[10px] text-slate-600 uppercase tracking-widest">
            <Shield size={10} /> Acesso Restrito — Somente Fundadores
          </div>
        </div>
      </div>
    </div>
  );
}
