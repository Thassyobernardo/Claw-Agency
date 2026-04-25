# ============================================================
# CLAWBOT-REAL â€” Inicializacao rapida do Swarm
# Execute: .\start_swarm.ps1
# ============================================================

Write-Host ""
Write-Host "Iniciando Ruflo MCP Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx -y ruflo@latest mcp start" -WindowStyle Normal

Start-Sleep -Seconds 5

Write-Host "Verificando saude do servidor..." -ForegroundColor Cyan
npx -y ruflo@latest mcp health

Write-Host ""
Write-Host "Inicializando Swarm clawbot-swarm..." -ForegroundColor Cyan
npx -y ruflo@latest mcp exec --tool swarm_init --topology mesh --maxAgents 5

Write-Host ""
Write-Host "Spawning agentes..." -ForegroundColor Cyan

npx -y ruflo@latest mcp exec --tool agent_spawn --name carbon_auditor --prompt "Voce eh o auditor de carbono da EcoLink Australia. Classifique transacoes em categorias NGA e calcule emissoes CO2e."
npx -y ruflo@latest mcp exec --tool agent_spawn --name data_researcher --prompt "Voce eh o pesquisador da EcoLink. Busque atualizacoes NGA e AASB S1/S2."
npx -y ruflo@latest mcp exec --tool agent_spawn --name lead_hunter --prompt "Voce eh o agente de prospeccao da EcoLink. Encontre SMEs australianas para conformidade ESG."
npx -y ruflo@latest mcp exec --tool agent_spawn --name report_writer --prompt "Voce eh o redator de relatorios AASB S1/S2 da EcoLink."

Write-Host ""
Write-Host "Listando agentes ativos..." -ForegroundColor Cyan
npx -y ruflo@latest mcp exec --tool agent_list

Write-Host ""
Write-Host "Swarm clawbot-swarm iniciado com sucesso!" -ForegroundColor Green
