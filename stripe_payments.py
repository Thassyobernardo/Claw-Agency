import os
import stripe
from database import get_db_connection

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

PLANS = {
    "starter": {
        "name": "Starter",
        "price": 297,
        "price_id": os.environ.get("STRIPE_STARTER_PRICE_ID", ""),
        "leads_per_month": 100,
        "agents": 1
    },
    "growth": {
        "name": "Growth",
        "price": 597,
        "price_id": os.environ.get("STRIPE_GROWTH_PRICE_ID", ""),
        "leads_per_month": 500,
        "agents": 3
    },
    "enterprise": {
        "name": "Enterprise",
        "price": 997,
        "price_id": os.environ.get("STRIPE_ENTERPRISE_PRICE_ID", ""),
        "leads_per_month": 9999,
        "agents": 99
    }
}

def create_checkout_session(user_id, email, plan_key, success_url, cancel_url):
    try:
        plan = PLANS.get(plan_key)
        if not plan or not plan["price_id"]:
            # Criar produto e preço no Stripe se não existir
            product = stripe.Product.create(
                name=f"Claw Agency {plan['name']}",
                description=f"{plan['leads_per_month']} leads/month · {plan['agents']} AI agent(s)"
            )
            price = stripe.Price.create(
                product=product.id,
                unit_amount=plan["price"] * 100,
                currency="eur",
                recurring={"interval": "month"}
            )
            price_id = price.id
        else:
            price_id = plan["price_id"]

        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            customer_email=email,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            metadata={"user_id": str(user_id), "plan": plan_key},
            subscription_data={"metadata": {"user_id": str(user_id), "plan": plan_key}}
        )
        return session.url, None
    except Exception as e:
        return None, str(e)

def handle_webhook(payload, sig_header):
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            import json
            event = json.loads(payload)
        
        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = session["metadata"].get("user_id")
            plan = session["metadata"].get("plan")
            customer_id = session.get("customer")
            subscription_id = session.get("subscription")
            
            if user_id:
                _update_user_subscription(user_id, plan, customer_id, subscription_id)
        
        elif event["type"] in ["customer.subscription.deleted", "customer.subscription.updated"]:
            sub = event["data"]["object"]
            _handle_subscription_change(sub)
        
        return True, None
    except Exception as e:
        return False, str(e)

def _update_user_subscription(user_id, plan, customer_id, subscription_id):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE users SET 
                plan = %s,
                stripe_customer_id = %s,
                stripe_subscription_id = %s,
                status = 'active'
            WHERE id = %s
        """, (plan, customer_id, subscription_id, user_id))
        conn.commit()
    finally:
        cur.close()
        conn.close()

def _handle_subscription_change(subscription):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        status = subscription.get("status")
        sub_id = subscription.get("id")
        new_status = "active" if status == "active" else "suspended"
        cur.execute("""
            UPDATE users SET status = %s
            WHERE stripe_subscription_id = %s
        """, (new_status, sub_id))
        conn.commit()
    finally:
        cur.close()
        conn.close()

def get_customer_portal_url(customer_id, return_url):
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url
        )
        return session.url, None
    except Exception as e:
        return None, str(e)
