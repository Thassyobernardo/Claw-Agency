import os
import tweepy
import time

# Chaves lidas do Railway
X_API_KEY = os.getenv("X_API_KEY")
X_API_SECRET = os.getenv("X_API_SECRET")
X_ACCESS_TOKEN = os.getenv("X_ACCESS_TOKEN")
X_ACCESS_SECRET = os.getenv("X_ACCESS_SECRET")

# Autenticação
client = tweepy.Client(
    consumer_key=X_API_KEY, consumer_secret=X_API_SECRET,
    access_token=X_ACCESS_TOKEN, access_token_secret=X_ACCESS_SECRET
)

def caçar_e_vender():
    print("🎯 CLAW: Iniciando caçada ativa por leads...")
    query = "need to automate my business OR marketing agency automation -is:retweet"
    try:
        tweets = client.search_recent_tweets(query=query, max_results=5)
        if tweets.data:
            for tweet in tweets.data:
                msg = f"Stop wasting time with manual tasks! 🚀 I can automate your workflow for $29.99. Check it out: https://buy.stripe.com/test_9B614meMU0AO7WM7ISeIw00"
                client.create_tweet(text=msg, in_reply_to_tweet_id=tweet.id)
                print(f"✅ Lead respondido: {tweet.id}")
                time.sleep(60) 
        else:
            print("⏳ Monitorando o mercado...")
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    while True:
        caçar_e_vender()
        time.sleep(900)
