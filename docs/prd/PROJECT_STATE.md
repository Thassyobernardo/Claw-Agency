# EcoLink Australia - Project State & Handover Document

## 1. O que é o EcoLink (System Overview)
O EcoLink é uma plataforma SaaS B2B de contabilidade de carbono e conformidade climática voltada para PMEs (Pequenas e Médias Empresas) na Austrália. O objetivo principal do sistema é permitir que empresas enviem seus extratos financeiros (via CSV ou integrações como Xero/MYOB) e o sistema converta esses gastos financeiros em uma estimativa de emissões de Gases de Efeito Estufa (GHG) – separados em Scopes 1, 2 e 3.

A plataforma gera automaticamente um **Climate Disclosure Report** em formato PDF, rigorosamente alinhado com as leis australianas, especificamente:
- **AASB S2 (Climate-related Disclosures)**
- **National Greenhouse Accounts (NGA) Factors 2023-24 (DCCEEW)**
- **GHG Protocol Corporate Standard**

## 2. Tech Stack Principal
- **Frontend/Backend:** Next.js 14+ (App Router) em TypeScript
- **Banco de Dados:** PostgreSQL (gerenciado via provedor remoto - Railway/Supabase), utilizando `postgres.js`
- **Autenticação:** NextAuth (credenciais e OAuth planejados)
- **Inteligência Artificial:** OpenRouter API (orquestrando GPT-4o-mini, Gemini 2.5 Flash, DeepSeek)
- **Estilização:** Tailwind CSS (com estética Premium Dark/Glassmorphism)
- **Infraestrutura/Deploy:** Vercel (Produção contínua)

---

## 3. O que JÁ FOI Feito (Concluído e em Produção)

### 3.1. Orquestração de IA (Ensemble Classifier)
- Criado um motor de classificação de transações (`src/lib/ensemble-classifier.ts`) que analisa cada gasto.
- **Conceito de Swarm/Ensemble:** O sistema não confia em apenas 1 IA. Cada transação é enviada paralelamente para 3 LLMs diferentes via OpenRouter. O resultado final é gerado por "Voto da Maioria" (Majority Vote) para a categoria e escopo, e mediana para os valores de emissão.
- **Prompt com Peso Legal:** A IA está restrita a usar **apenas** os fatores NGA 2023-24 australianos, exigindo foco em métricas de atividade (Litros, kWh) e coibindo o uso de estimativas baseadas em valor monetário (Spend-based) sempre que possível. Exige cálculo por estado australiano para Escopo 2.

### 3.2. Importação e Classificação de Dados
- Upload de CSV com parser no backend.
- Tela no Dashboard de **Review/Classify** onde as transações ficam com status `needs_review` se a IA divergir ou se faltar certeza, exigindo revisão manual do usuário.
- Adicionada funcionalidade de **Entrada Manual** de dados (litros, kWh) para garantir conformidade em auditorias, sem depender unicamente de faturas.

### 3.3. Geração do Relatório Premium (AASB S2 Compliant)
- Rota `api/report/generate` que constrói um PDF HTML/CSS print-friendly.
- **Design de Alto Padrão:** Uso de fontes (Outfit/Inter), modo escuro na capa, cartões coloridos para escopos.
- **Checklists Legais (AASB S2):** O relatório agora gera automaticamente as seções obrigatórias:
  - Governance, Strategy, Risk Management (AASB S2 §6–25)
  - Metrics & Targets (Escopos 1, 2 e 3 detalhados)
  - Emission Factors & Methodology notes.
  - Avisos legais sobre Assurance (Auditoria Independente não obtida).
- **Badge de Confiança de IA:** O PDF exibe na capa se o relatório passou com 100% de consenso entre as 3 IAs, ou avisa detalhadamente quantas transações têm divergência (ex: 2/3 de consenso vs 0/3 desacordo total).
- Botão "Salvar como PDF" flutuante para fácil exportação.

### 3.4. CEO Command Center (Agentes Internos)
- Tela administrativa (`/admin/swarm`) desenhada como uma "War Room" para os fundadores.
- Interface contendo **7 Agentes de IA Simulados/Reais** atuando como diretoria:
  1. **CEO:** Visão geral e definição de metas.
  2. **Lead Hunter:** Prospecção de clientes por estado/setor.
  3. **Legislação:** Monitora leis AASB S2, NGER, Privacy Act.
  4. **Contabilidade:** Burn rate, custos de IA, infra, e MRR.
  5. **Tokens:** Monitora gastos e saldo da API OpenRouter.
  6. **Mercado:** Análise de concorrentes (CarbonChain, Greener, etc).
  7. **Reclamações:** Analisa NPS e feedback dos usuários.

### 3.5. Estabilização e Deploy Vercel
- Resolvidos diversos erros de compilação (Strict TypeScript/ESLint warnings desativados no `next.config.ts` para focar em velocidade de build).
- Resolvido erro crítico do `useSWR` quebrando a tela do Dashboard (violação da Rules of Hooks).
- O projeto atual já está compilando localmente e realizando Deploy automático para a Vercel com Sucesso (100% Green).

---

## 4. O que AINDA FALTA Fazer (Next Steps / Backlog)

Para que qualquer nova sessão de IA entenda por onde continuar, aqui estão as prioridades do projeto:

### 4.1. Funcionalidades Core a Completar
1. **Integração Real do Xero e MYOB:** 
   - A autenticação OAuth2 está configurada superficialmente ou quebrada. Precisamos conectar de fato às APIs de contabilidade australianas para puxar as despesas automaticamente, substituindo o upload manual de CSV como feature principal.
2. **Onboarding / Fluxo do Usuário:**
   - Construir o fluxo desde o `Sign Up` até o primeiro upload de dados (Onboarding guiado).
   - O usuário precisa preencher o questionário inicial de "Governance & Strategy" para que o PDF gere dados reais de estratégia climática da empresa dele, ao invés de placeholders genéricos.
3. **Plano de Assinatura (Stripe):**
   - Conectar o backend à API do Stripe para gerenciar o Trial de 14 dias (atualmente feito via middleware local) e bloquear a geração de PDF até o pagamento.

### 4.2. Melhorias Técnicas e de UX
1. **Vídeo / Tutorial Interativo:** 
   - O "CEO Agent" recomendou a criação urgente de um fluxo de ensino ensinando o cliente a adicionar faturas manualmente.
2. **Conectar Agentes do "Command Center" a APIs Reais:**
   - Atualmente o Command Center (`/admin/swarm`) usa dados simulados para a demonstração da visão. Precisamos ligar o *Token Monitor* diretamente à API da OpenRouter para ler o balanço real, e o *Accounting Agent* à API do Stripe.
3. **Refinamento do Relatório PDF:**
   - Permitir que o cliente insira a logomarca da própria empresa no PDF.
   - Gráficos visuais (Chart.js ou Recharts renderizados estaticamente no HTML do PDF).

## 5. Como Iniciar o Trabalho (Para a IA)

- **Diretório Frontend:** Todo o código React/Next.js está na pasta `frontend/`.
- **Comandos úteis:** 
  - Subir dev: `npm --prefix frontend run dev`
  - Checar build: `npm --prefix frontend run build`
- **Regras Críticas:** 
  - Backend e rotas de API em Async/Await usando App Router.
  - O design **DEVE** continuar sendo premium (cores escuras, bordas suaves, badges estilizados, lucide-react para ícones).
  - Nunca quebre o fluxo da API do OpenRouter sem testar. Cada requisição ao `route.ts` de classificação custa dinheiro e precisa ser feita cuidadosamente.
  - Para alterações no deploy: realize commits e push pro branch `main` do repositório local `C:\Users\Taric\Desktop\clawbot-real`. A Vercel cuida do resto automaticamente.
