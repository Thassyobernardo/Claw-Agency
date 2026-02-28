import os
import requests
from groq import Groq
import time
import json

LEMONSQUEEZY_API_KEY = os.getenv("LEMONSQUEEZY_API_KEY")
LEMONSQUEEZY_STORE_ID = os.getenv("LEMONSQUEEZY_STORE_ID")
DEVTO_API_KEY = os.getenv("DEVTO_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

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

def publicar_lemonsqueezy(info, conteudo):
    print("Publicando no Lemon Squeezy...")
    headers = {
        "Authorization": f"Bearer {LEMONSQUEEZY_API_KEY}",
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json"
    }
    data = {
        "data": {
            "type": "products",
            "attributes": {
                "name": info["title"],
                "description": info["description"],
            },
            "relationships": {
                "store": {
                    "data": {
                        "type": "stores",
                        "id": str(LEMONSQUEEZY_STORE_ID)
                    }
                }
            }
        }
    }
    response = requests.post(
        "https://api.lemonsqueezy.com/v1/products",
        headers=headers,
        json=data
    )
    print(f"LemonSqueezy status: {response.status_code}")
    print(f"LemonSqueezy response: {response.text[:300]}")

    if response.status_code in [200, 201]:
        result = response.json()
        product_id = result["data"]["id"]
        product_url = f"https://clawagencyhq.lemonsqueezy.com/buy/{product_id}"
        print(f"Produto criado: {product_url}")
        return product_url
    else:
        print(f"Erro LemonSqueezy: {response.text}")
        return None

def publicar_devto(info, product_url):
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
        product_url = publicar_lemonsqueezy(info, conteudo)
        if product_url:
            publicar_devto(info, product_url)
            print("Ciclo completo! Produto no ar.")
        else:
            print("Falhou ao publicar no Lemon Squeezy.")
    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    executar()
    while True:
        print("Aguardando 24h para proximo ciclo...")
        time.sleep(86400)
        executar()
