import os
import requests
from openai import OpenAI
import time
import json

GUMROAD_TOKEN = os.getenv("GUMROAD_TOKEN")
DEVTO_API_KEY = os.getenv("DEVTO_API_KEY")
XAI_API_KEY = os.getenv("XAI_API_KEY")

client_ai = OpenAI(
    api_key=XAI_API_KEY,
    base_url="https://api.x.ai/v1"
)

def perguntar_grok(prompt):
    response = client_ai.chat.completions.create(
        model="grok-3-latest",
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
    text = perguntar_grok(prompt).strip()
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
    return perguntar_grok(prompt)

def publicar_gumroad(info, conteudo):
    print("Publicando no Gumroad...")
    headers = {"Authorization": f"Bearer {GUMROAD_TOKEN}"}
    data = {
        "name": info["title"],
        "description": info["description"],
        "price": int(info["price"] * 100),
        "url": info["title"].lower().replace(" ", "-"),
    }
    response = requests.post(
        "https://api.gumroad.com/v2/products",
        headers=headers,
        data=data
    )
    result = response.json()
    if result.get("success"):
        product_url = result["product"]["short_url"]
        print(f"Produto criado: {product_url}")
        return product_url
    else:
        print(f"Erro Gumroad: {result}")
        return None

def publicar_devto(info, product_url):
    print("Publicando artigo no Dev.to...")
    prompt = f"""Write a compelling blog article (800 words) about "{info['title']}". 
    It should educate readers and naturally mention that a complete guide is available at {product_url}.
    Use markdown format. Make it SEO friendly."""
    artigo = perguntar_grok(prompt)

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
        product_url = publicar_gumroad(info, conteudo)
        if product_url:
            publicar_devto(info, product_url)
            print("Ciclo completo! Produto no ar.")
        else:
            print("Falhou ao publicar no Gumroad.")
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    executar()
    while True:
        print("Aguardando 24h para proximo ciclo...")
        time.sleep(86400)
        executar()
