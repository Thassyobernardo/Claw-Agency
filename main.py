import os
import requests
from groq import Groq
import time
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import traceback

DEVTO_API_KEY = os.getenv("DEVTO_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD")
EMAIL_DESTINO = os.getenv("EMAIL_DESTINO")

client_ai = Groq(api_key=GROQ_API_KEY)

def perguntar_ai(prompt, max_tokens=1000):
    response = client_ai.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens
    )
    return response.choices[0].message.content

def pesquisar_tendencias():
    print("Pesquisando tendencias...")
    prompt = """Identify the TOP 1 most profitable ebook topic in 2026. Return ONLY a JSON:
    {
        "title": "ebook title",
        "description": "one sentence description",
        "price": 19.99,
        "keywords": ["kw1", "kw2", "kw3"]
    }"""
    text = perguntar_ai(prompt, max_tokens=200).strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return json.loads(text.strip())

def escrever_ebook(info):
    print(f"Escrevendo ebook: {info['title']}...")
    prompt = f"""Write a professional ebook outline about "{info['title']}". 
    Include: Introduction, 5 chapter titles with 3 bullet points each, and Conclusion.
    Keep it concise but valuable."""
    return perguntar_ai(prompt, max_tokens=800)

def enviar_email(info, conteudo):
    print("Enviando ebook por email...")
    print(f"GMAIL_USER: {GMAIL_USER}")
    print(f"EMAIL_DESTINO: {EMAIL_DESTINO}")
    print(f"PASSWORD definida: {bool(GMAIL_PASSWORD)}")
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_USER
        msg['To'] = EMAIL_DESTINO
        msg['Subject'] = f"CLAW: Novo ebook pronto - {info['title']}"
        corpo = f"""
CLAW gerou um novo ebook!

TITULO: {info['title']}
DESCRICAO: {info['description']}
PRECO SUGERIDO: ${info['price']}

INSTRUCOES:
1. Copie o conteudo abaixo
2. Cole no Google Docs e salve como PDF
3. Faca upload no Payhip (payhip.com)
4. Me mande o link do produto

------- CONTEUDO -------

{conteudo}
"""
        msg.attach(MIMEText(corpo, 'plain'))
        print("Conectando ao Gmail SMTP...")
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        print("Fazendo login...")
        server.login(GMAIL_USER, GMAIL_PASSWORD.replace(' ', ''))
        print("Enviando mensagem...")
        server.sendmail(GMAIL_USER, EMAIL_DESTINO, msg.as_string())
        server.quit()
        print(f"Email enviado com sucesso para {EMAIL_DESTINO}")
        return True
    except Exception as e:
        print(f"ERRO ao enviar email: {e}")
        traceback.print_exc()
        return False

def publicar_devto(info):
    print("Publicando artigo no Dev.to...")
    prompt = f"""Write a short blog article (400 words) about "{info['title']}". 
    Use markdown. End with a call to action to learn more."""
    artigo = perguntar_ai(prompt, max_tokens=600)
    headers = {
        "api-key": DEVTO_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "article": {
            "title": info["title"],
            "published": True,
            "body_markdown": artigo,
            "tags": info["keywords"][:4]
        }
    }
    response = requests.post(
        "https://dev.to/api/articles",
        headers=headers,
        json=data
    )
    if response.status_code == 201:
        url = response.json().get("url")
        print(f"Artigo publicado: {url}")
    else:
        print(f"Erro Dev.to: {response.text}")

def executar():
    print("CLAW: Iniciando ciclo de vendas...")
    try:
        info = pesquisar_tendencias()
        print(f"Topico escolhido: {info['title']}")
        conteudo = escrever_ebook(info)
        enviar_email(info, conteudo)
        publicar_devto(info)
        print("Ciclo completo!")
    except Exception as e:
        print(f"Erro geral: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    executar()
    while True:
        print("Aguardando 24h para proximo ciclo...")
        time.sleep(86400)
        executar()
