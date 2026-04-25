
import os
from resend import Resend

def send_verification_email(to_email: str, name: str, verification_link: str):
    """
    Envia e-mail de verificacao usando Resend.
    """
    resend_key = os.environ.get("RESEND_API_KEY")
    if not resend_key:
        print("❌ Erro: RESEND_API_KEY nao encontrada.")
        return False
    
    client = Resend(resend_key)
    
    html_content = f"""
    <h1>Welcome to EcoLink Australia, {name}!</h1>
    <p>Please verify your email to start your 14-day free trial and generate your first AASB S2 carbon report.</p>
    <a href="{verification_link}" style="background-color: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
    <p>If you didn't create an account, you can ignore this email.</p>
    """
    
    try:
        client.emails.send({
            "from": "EcoLink <onboarding@ecolink.com.au>",
            "to": to_email,
            "subject": "Verify your EcoLink account",
            "html": html_content
        })
        return True
    except Exception as e:
        print(f"❌ Falha ao enviar e-mail: {e}")
        return False
