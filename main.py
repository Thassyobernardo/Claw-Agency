import os
import tweepy
from google import genai
import time

X_API_KEY = os.getenv("TWITTER_API_KEY")
X_API_SECRET = os.getenv("TWITTER_API_SECRET")
X_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
X_ACCESS_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

print(f"X_API_KEY presente: {bool(X_API_KEY)}")
print(f"X_API_SECRET presente: {bool(X_API_SECRET)}")
print(f"X_ACCESS_TOKEN presente: {bool(X_ACCESS_TOKEN)}")
print(f"X_ACCESS_SECRET presente: {bool(X_ACCESS_SECRET)}")
print(f"GEMINI_API_KEY presente: {bool(GEMINI_API_KEY)}")

try:
    client_ai = genai.Client(api_key=GEMINI_API_KEY)
    response = client_ai.models.generate_content(
        model="gemini-2.0-flash",
        contents="say hi"
    )
    print(f"GEMINI OK: {response.text}")
except Exception as e:
    print(f"GEMINI ERRO: {e}")

try:
    client = tweepy.Client(
        consumer_key=X_API_KEY, consumer_secret=X_API_SECRET,
        access_token=X_ACCESS_TOKEN, access_token_secret=X_ACCESS_SECRET
    )
    me = client.get_me()
    print(f"TWITTER OK: {me}")
except Exception as e:
    print(f"TWITTER ERRO: {e}")
