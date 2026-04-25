
import asyncio
import json
from skills.security_agent.scanner import run_full_audit
from skills.security_agent.notifier import send_telegram_alert

async def main():
    # Executa o scan
    print("🛡️ Iniciando auditoria de seguranca...")
    report = run_full_audit()
    
    # Imprime no terminal
    print(json.dumps(report, indent=2))
    
    # Verifica se deve enviar para o Telegram (se houver Critical ou High)
    critical = report.get("by_severity", {}).get("critical", 0)
    high = report.get("by_severity", {}).get("high", 0)
    
    if critical > 0 or high > 0:
        print(f"\n🚨 {critical} problemas criticos e {high} altos encontrados!")
        print("📲 Enviando alerta para o Telegram...")
        success = await send_telegram_alert(report)
        if success:
            print("✅ Alerta enviado com sucesso!")
        else:
            print("❌ Falha ao enviar alerta. Verifique o TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env")
    else:
        print("\n✅ Nenhum problema critico ou alto encontrado. Nada enviado para o Telegram.")

if __name__ == "__main__":
    asyncio.run(main())
