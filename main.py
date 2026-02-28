import os
import requests
from groq import Groq
import time
import json
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

DEVTO_API_KEY = os.getenv("DEVTO_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD")
EMAIL_DESTINO = os.getenv("EMAIL_DESTINO")

client_ai = Groq(api_key=GROQ_API_KEY)

def perguntar_ai(prompt):
    response = client_ai.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

def pesquisar_tendencias():
    print("Pesquisando tendencias...")
    prompt = """You are a market research expert. Analyze current trends and identify the TOP 1 most profitable ebook topic right now in 2026. Focus on: AI tools, automation, making money online, productivity. Return ONLY a JSON like this:
    {
        "topic": "topic name",
        "title": "ebook title",
        "description": "short description",
        "price": 19.99,
        "keywords": ["kw1", "kw2"]
    }"""
    text = perguntar_ai(prompt).strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return json.loads(text.strip())

def escrever_ebook(info):
    print(f"Escrevendo ebook: {info['title']}...")
    prompt = f"""Write a complete, professional ebook about "{info['title']}". 
    Include: Introduction, 5 detailed chapters with practical tips, and Conclusion.
    Make it valuable, actionable and at least 2000 words.
    Format with clear headers and sections."""
    return perguntar_ai(prompt)

def enviar_email(info, conteudo):
    print("Enviando ebook por email...")
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_USER
        msg['To'] = EMAIL_DESTINO
        msg['Subject'] = f"CLAW: Novo ebook pronto - {info['title']}"

        corpo = f"""
Ola! O CLAW gerou um novo ebook para voce publicar.

TITULO: {info['title']}
DESCRICAO: {info['description']}
PRECO SUGERIDO: ${info['price']}
KEYWORDS: {', '.join(info['keywords'])}

INSTRUCOES:
1. Copie o conteudo do ebook abaixo
2. Cole em um documento Word ou Google Docs
3. Salve como PDF
4. Faca upload no Payhip (payhip.com) ou Gumroad
5. Me mande o link do produto

------- CONTEUDO DO EBOOK -------

{conteudo}
"""
        msg.attach(MIMEText(corpo, 'plain'))

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(GMAIL_USER, GMAIL_PASSWORD.replace(' ', ''))
        server.sendmail(GMAIL_USER, EMAIL_DESTINO, msg.as_string())
        server.quit()
        print(f"Email enviado para {EMAIL_DESTINO}")
        return True
    except Exception as e:
        print(f"Erro ao enviar email: {e}")
        return False

def publicar_devto(info, product_url="https://payhip.com"):
    print("Publicando artigo no Dev.to...")
    prompt = f"""Write a compelling blog article (800 words) about "{info['title']}". 
    It should educate readers and naturally mention that a complete guide is available at {product_url}.
    Use markdown format. Make it SEO friendly."""
    artigo = perguntar_ai(prompt)

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
        return url
    else:
        print(f"Erro Dev.to: {response.text}")
        return None

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
        print(f"Erro: {e}")

if __name__ == "__main__":
    executar()
    while True:
        print("Aguardando 24h para proximo ciclo...")
        time.sleep(86400)
        executar()
