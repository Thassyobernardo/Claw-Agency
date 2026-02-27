# -*- coding: utf-8 -*-
import os
import tweepy
import requests
import time

# Conexão com as chaves do Railway
X_API_KEY = os.getenv("X_API_KEY")
X_API_SECRET = os.getenv("X_API_SECRET")
X_ACCESS_TOKEN = os.getenv("X_ACCESS_TOKEN")
X_ACCESS_SECRET = os.getenv("X_ACCESS_SECRET")
GROK_API_KEY = os.getenv("GROK_API_KEY")

# Inicializando o cliente do X
client = tweepy.Client(
    consumer_key=X_API_KEY, consumer_secret=X_API_SECRET,
    access_token=X_ACCESS_TOKEN, access_token_secret=X_ACCESS_SECRET
)

def pensar_com_grok(prompt):
    url = "https://api.x.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROK_API_KEY}"}
    data = {
        "model": "grok-beta",
        "messages": [
            {"role": "system", "content": "You are Claw, an AI Agent. Sell automation for $29.99. English only."},
            {"role": "user", "content": prompt}
        ]
    }
    try:
        response = requests.post(url, headers=headers, json=data)
        return response.json()['choices'][0]['message']['content']
    except:
        return "Check our automation: https://buy.stripe.com/test_9B614meMU0AO7WM7ISeIw00"

def caçar_e_vender():
    print("🎯 CLAW: Iniciando caçada ativa...")
    query = "need to automate my business OR marketing automation help -is:retweet"
    try:
        tweets = client.search_recent_tweets(query=query, max_results=5)
        if tweets.data:
            for tweet in tweets.data:
                # LINHA CORRIGIDA ABAIXO
                prompt_grok = f"Create a short reply for: '{tweet.text}'. Link: https://buy.stripe.com/test_9B614meMU0AO7WM7ISeIw00"
                resposta = pensar_com_grok(prompt_grok)
                client.create_tweet(text=resposta, in_reply_to_tweet_id=tweet.id)
                print(f"✅ Respondido: {tweet.id}")
                time.sleep(300)
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    while True:
        caçar_e_vender()
        time.sleep(1800)
