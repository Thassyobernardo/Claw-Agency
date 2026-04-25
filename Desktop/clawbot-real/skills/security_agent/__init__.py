"""
EcoLink Australia — Security Agent
Agente autônomo que monitora a segurança do projeto:
  - Segredos expostos em arquivos e histórico Git
  - Chaves de API expiradas ou comprometidas
  - Vulnerabilidades de dependências (pip + npm)
  - Permissões de arquivo inseguras
  - Alertas via Telegram

Run:
  uvicorn skills.security_agent.main:app --reload --port 8001
"""
