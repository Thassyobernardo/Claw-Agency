import os
import tweepy
import google.generativeai as genai
import time

# 1. Chaves do Railway
X_API_KEY = os.getenv("X_API_KEY")
X_API_SECRET = os.getenv("X_API_SECRET")
X_ACCESS_TOKEN = os.getenv("X_ACCESS_TOKEN")
X_ACCESS_SECRET = os.getenv("X_ACCESS_SECRET")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configurar Gemini
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# Configurar X
client = tweepy.Client(
    consumer_key=X_API_KEY, consumer_secret=X_API_SECRET,
    access_token=X_ACCESS_TOKEN, access_token_secret=X_ACCESS_SECRET
)

def pensar_com_gemini(texto_tweet):
    prompt = f"Create a short, aggressive sales reply (max 180 chars) for this tweet: '{texto_tweet}'. Sell automation for $29.99. Use this link: https://buy.stripe.com/test_9B614meMU0AO7WM7ISeIw00. English only."
    try:
        response = model.generate_content(prompt)
        return response.text
    except:
        return "Automate your business for just $29.99! Check it out: https://buy.stripe.com/test_9B614meMU0AO7WM7ISeIw00"

def caçar():
    print("🎯 CLAW: Caçando com o cérebro do Gemini...")
    query = "need to automate my business OR marketing agency help -is:retweet"
    try:
        tweets = client.search_recent_tweets(query=query, max_results=5)
        if tweets.data:
            for tweet in tweets.data:
                resposta = pensar_com_gemini(tweet.text)
                client.create_tweet(text=resposta, in_reply_to_tweet_id=tweet.id)
                print(f"✅ Respondido com sucesso!")
                time.sleep(60)
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    while True:
        caçar()
        time.sleep(900)
