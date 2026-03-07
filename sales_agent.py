import os
import logging
import json
import time
import resend
import zipfile
import database as db

import config

log = logging.getLogger(__name__)

# Premium French Templates with Storytelling & PAS Framework
# Skill: copywriting, sales-psychology
STAGES = {
    0: {
        "subject": config.EMAIL_SUBJECT_FR + ": {title}",
        "template": """
        <html>
        <body style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8f9fa; padding: 40px; color: #212529; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e9ecef;">
                <div style="background: #0052cc; padding: 30px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">Prototype d'Automatisation Sur Mesure</h1>
                    <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Conçu pour : {title}</p>
                </div>
                <div style="padding: 40px;">
                    <p style="font-size: 17px; font-weight: 500; color: #0052cc; margin-bottom: 20px;">{hook}</p>
                    
                    <p style="margin-bottom: 25px;">
                        Après avoir analysé vos besoins, nous avons identifié un goulot d'étranglement critique qui pourrait être optimisé.
                        <strong>{agitation}</strong>
                    </p>

                    <div style="background: #f0f7ff; border-left: 4px solid #0052cc; padding: 25px; margin-bottom: 30px; border-radius: 0 8px 8px 0;">
                        <h3 style="margin: 0 0 10px; font-size: 15px; color: #0052cc; text-transform: uppercase; letter-spacing: 1px;">La Solution Ingénierie</h3>
                        <p style="margin: 0; font-size: 16px; color: #444;">{solution}</p>
                    </div>

                    <p style="font-size: 15px; color: #666; margin-bottom: 35px;">
                        Le code source fonctionnel et les instructions d'installation sont joints à cet e-mail. 
                        Vous pouvez déployer cette preuve de concept dès aujourd'hui. Pour la version prête pour la production et un support technique complet, 
                        veuillez initialiser l'accès ci-dessous.
                    </p>

                    <div style="text-align: center; margin-bottom: 40px;">
                        <a href="{payment_url}" style="background-color: #0052cc; color: white; padding: 18px 36px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block; transition: all 0.3s ease;">
                            Débloquer la Version Production
                        </a>
                        <p style="margin-top: 12px; font-size: 12px; color: #adb5bd;">Paiement sécurisé via Stripe</p>
                    </div>

                    <div style="border-top: 1px solid #eee; padding-top: 30px; font-size: 14px; color: #495057;">
                        <p style="font-style: italic; margin-bottom: 0;">{cta}</p>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 11px; color: #6c757d; border-top: 1px solid #eee;">
                    """ + config.AGENCY_NAME + """ | Département Ingénierie & Automatisation
                </div>
            </div>
        </body>
        </html>
        """
    },
    1: {
        "subject": "Suivi : Solution pour {title}",
        "template": """
        <html>
        <body style="font-family: sans-serif; padding: 30px; color: #333; line-height: 1.5;">
            <p style="font-size: 16px;">Bonjour,</p>
            <p>J'ai remarqué que vous n'avez pas encore activé la version de production pour l'automatisation de <strong>{title}</strong>.</p>
            <p>D'après notre analyse sur le problème de <em>{pain}</em>, retarder cette automatisation entraîne souvent une dette technique ou des heures opérationnelles perdues.</p>
            <p>Seriez-vous ouvert à un échange de 2 minutes pour voir comment nous pouvons finaliser votre projet ?</p>
            <p><a href="{payment_url}" style="color: #0052cc; font-weight: bold;">Accéder à la version Production ici</a></p>
            <br>
            <p>Cordialement,<br>L'équipe Ingénierie @ """ + config.AGENCY_NAME + """</p>
        </body>
        </html>
        """
    }
}

def run_sales_cycle() -> int:
    api_key = os.environ.get("RESEND_API_KEY")
    resend.api_key = api_key
    target_email = os.environ.get("TARGET_EMAIL")
    from_email = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    payment_link = os.environ.get("PAYMENT_LINK_URL", "https://buy.stripe.com/example")

    sent_count = 0

    # 1. New Leads (Stage 0)
    new_leads = db.get_leads(status="built")
    for lead in new_leads:
        try:
            proposal = json.loads(lead.get("proposal") or "{}")
            # Fallback if PAS fields are missing (for old leads)
            hook = proposal.get("hook") or proposal.get("hook_en") or "I've engineered a solution for your technical challenge."
            agitation = proposal.get("pas_agitation") or "Manual processing scales poorly and invites human error."
            solution = proposal.get("pas_solution") or proposal.get("solution") or "A custom automated engine designed to handle your specific workload efficiently."
            cta = proposal.get("call_to_action") or "Ready to discuss implementation?"

            body = STAGES[0]["template"].format(
                title=lead["title"],
                hook=hook,
                agitation=agitation,
                solution=solution,
                payment_url=payment_link,
                cta=cta
            )
            
            attachments = []
            if lead.get("deliverable_path") and os.path.exists(lead["deliverable_path"]):
                attachments.append({
                    "filename": os.path.basename(lead["deliverable_path"]), 
                    "path": lead["deliverable_path"]
                })

            resend.Emails.send({
                "from": from_email,
                "to": [target_email],
                "subject": STAGES[0]["subject"].format(title=lead["title"][:50]),
                "html": body,
                "attachments": attachments
            })
            db.update_status(lead["id"], "sent")
            db.update_sequence_stage(lead["id"], 1)
            sent_count += 1
            log.info(f"Sales: Sent professional Stage 0 for lead {lead['id']}")
        except Exception as e:
            log.error(f"Sales Stage 0 Error: {e}")

    # 2. Follow-ups (Stage 1 -> 2)
    followups = db.get_followup_leads(days_since=1)
    for lead in followups:
        try:
            analysis = json.loads(lead.get("analysis") or "{}")
            pain = "operational efficiency"
            if analysis.get("pain_points") and isinstance(analysis["pain_points"], list):
                pain = analysis["pain_points"][0]

            body = STAGES[1]["template"].format(
                title=lead["title"],
                pain=pain,
                payment_url=payment_link
            )
            resend.Emails.send({
                "from": from_email,
                "to": [target_email],
                "subject": STAGES[1]["subject"].format(title=lead["title"][:50]),
                "html": body
            })
            db.update_sequence_stage(lead["id"], 2)
            sent_count += 1
            log.info(f"Sales: Sent professional Stage 1 follow-up for lead {lead['id']}")
        except Exception as e:
            log.error(f"Sales Stage 1 Error: {e}")

    return sent_count
