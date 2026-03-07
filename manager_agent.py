import os
import json
import time
import logging
import resend

import database as db
import proposal_generator
import builder

log = logging.getLogger(__name__)

# Premium Email Template for Internal Operations
EMAIL_TEMPLATE = """
<html>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; padding: 20px; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid #e0e0e0;">
        <div style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">Claw Agency</h1>
            <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Daily Operations Summary - Manager Agent</p>
        </div>
        <div style="padding: 30px;">
            <p style="font-size: 16px; line-height: 1.6;">Hello Team,</p>
            <p style="font-size: 16px; line-height: 1.6;">The <strong>Manager Agent</strong> has completed its latest cycle with the following results:</p>
            
            <div style="display: flex; justify-content: space-between; margin: 30px 0; background: #f9f9f9; padding: 20px; border-radius: 8px;">
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 24px; font-weight: bold; color: #1a237e;">{processed}</div>
                    <div style="font-size: 12px; color: #666; text-transform: uppercase;">Processed</div>
                </div>
                <div style="text-align: center; flex: 1; border-left: 1px solid #ddd; border-right: 1px solid #ddd;">
                    <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">{qualified}</div>
                    <div style="font-size: 12px; color: #666; text-transform: uppercase;">Qualified</div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 24px; font-weight: bold; color: #ef6c00;">{built}</div>
                    <div style="font-size: 12px; color: #666; text-transform: uppercase;">Built</div>
                </div>
            </div>

            <p style="font-size: 14px; color: #666;">Transitioning active projects to Sales Agent for dispatch...</p>
        </div>
        <div style="background: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888;">
            &copy; 2026 Claw Agency | Autonomous Multi-Agent System
        </div>
    </div>
</body>
</html>
"""

def run_manager_cycle() -> dict:
    api_key = os.environ.get("RESEND_API_KEY")
    target_email = os.environ.get("TARGET_EMAIL")
    from_email = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")

    if api_key:
        resend.api_key = api_key

    leads = db.get_leads(status="new", limit=5)
    if not leads:
        log.info("Manager Agent: No 'new' leads found.")
        return {"processed": 0, "qualified": 0, "built": 0}

    stats = {"processed": 0, "qualified": 0, "built": 0}
    log.info(f"Manager Agent: Evaluating {len(leads)} leads.")

    for lead in leads:
        lead_id = lead["id"]
        stats["processed"] += 1
        
        try:
            # Step 1: Deep Analysis & PAS Proposal
            analysis_str, proposal_str = proposal_generator.process_lead(
                lead_id, lead["source"], lead["title"], lead["description"]
            )
            db.save_proposal(lead_id, analysis_str, proposal_str)

            # Step 2: Quality Gate
            analysis = json.loads(analysis_str)
            urgency = str(analysis.get("urgency", "low")).lower()
            
            if urgency in ("high", "medium"):
                log.info(f"Manager: Lead {lead_id} qualified ({urgency}).")
                db.update_status(lead_id, "qualified")
                stats["qualified"] += 1
                
                # Step 3: Premium Build
                builder.build_lead(lead_id)
                stats["built"] += 1
            else:
                db.update_status(lead_id, "skipped")
                
        except Exception as e:
            log.error(f"Manager: Error on lead {lead_id}: {e}")

        time.sleep(2) # Prevent rate limits

    # Dispatch Summary
    if api_key and target_email:
        try:
            resend.Emails.send({
                "from": from_email,
                "to": [target_email],
                "subject": "Manager: Operations Summary",
                "html": EMAIL_TEMPLATE.format(**stats)
            })
            log.info("Manager: Summary email dispatched.")
        except Exception as e:
            log.error(f"Manager: Summary email failed: {e}")

    return stats
