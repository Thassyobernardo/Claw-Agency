import requests

OPENROUTER_API_KEY = "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"

response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "model": "anthropic/claude-3.5-haiku",
        "messages": [
            {
                "role": "user",
                "content": "Você é um especialista em tecnologia. Liste 5 tendências e acontecimentos reais de tecnologia que estão em destaque agora. Foque em: IA, startups australianas, inovação em negócios locais. Para cada item escreva TITULO (max 8 palavras) e RESUMO (2 frases explicando o impacto prático para pequenas empresas). Numerado de 1 a 5."
            }
        ]
    }
)

data = response.json()
print(data["choices"][0]["message"]["content"])
print("\nFuncionou!")