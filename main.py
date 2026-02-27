# -*- coding: utf-8 -*-
import os
import tweepy
import requests
import time

# 1. Conexão com as chaves que você vai colocar no Railway (Variables)
X_API_KEY = os.getenv("X_API_KEY")
X_API_SECRET = os.getenv("X_API_SECRET")
X_ACCESS_TOKEN = os.getenv("X_ACCESS_TOKEN")
X_ACCESS_SECRET = os.getenv("X_ACCESS_SECRET")
GROK_API_KEY = os.getenv("GROK_API_KEY")

# Inicializando o cliente do X (Twitter)
client = tweepy.Client(
    consumer_key=X_API_KEY, consumer_secret=X_API_SECRET,
    access_token=X_ACCESS_TOKEN, access_token_secret=X_ACCESS_SECRET
)

def pensar_com_grok(prompt):
    """Usa a inteligência do Grok para decidir o que responder"""
    url = "https://api.x.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROK_API_KEY}"}
    data = {
        "model": "grok-beta",
        "messages": [
            {"role": "system", "content": "You are Claw, an elite AI Agent. Your goal is to sell business automation systems for $29.99. Be professional, direct, and persuasive in English."},
            {"role": "user", "content": prompt}
        ]
    }
    try:
        response = requests.post(url, headers=headers, json=data)
        return response.json()['choices'][0]['message']['content']
    except Exception as e:
        return f"Check out this automation solution: https://buy.stripe.com/test_9B614meMU0AO7WM7ISeIw00"

def caçar_e_vender():
    """Busca leads e responde automaticamente no X"""
    print("🎯 CLAW: Iniciando caçada ativa por leads em Luxemburgo...")
    
    # Termos que o Claw vai buscar (pessoas precisando de automação ou ajuda com agência)
    query = "need to automate my business OR agency help OR marketing automation help -is:retweet"
    
    try:
        tweets = client.search_recent_tweets(query=query, max_results=10)
        
        if tweets.data:
            for tweet in tweets.data:
                print(f"👀 Analisando tweet: {tweet.text}")
                
                # O Grok cria a resposta ideal baseada no tweet da pessoa
                resposta = pensar_com_grok(f"Create a short, killer reply (max 200 chars) for this tweet: '{tweet.text}'.
