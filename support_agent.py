import os
import logging
import resend

import database as db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

def run_support_cycle() -> int:
    """
    The Delivery Agent: sweeps 'paid' leads, attaches the original ZIP build file 
    along with the installation manual, and marks them as 'delivered'.
    """
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        log.error("Support Agent: RESEND_API_KEY is not set.")
        return 0
    resend.api_key = api_key

    target_email = os.environ.get("TARGET_EMAIL")
    if not target_email:
        log.error("Support Agent: TARGET_EMAIL is not set.")
        return 0

    from_email = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")

    # Assuming 'paid' is the status that triggers delivery
    leads = db.get_leads(status="paid")
    if not leads:
        log.info("Support Agent: No 'paid' leads found for delivery.")
        return 0

    delivered_count = 0
    log.info(f"Support Agent: Delivering projects to {len(leads)} paid leads.")

    for lead in leads:
        lead_id = lead["id"]
        title = lead.get("title", "Unknown Project")
        deliverable_path = lead.get("deliverable_path")

        if not deliverable_path or not os.path.exists(deliverable_path):
            log.warning(f"Support Agent: Lead {lead_id} missing deliverable: {deliverable_path}")
            continue

        try:
            with open(deliverable_path, "rb") as f:
                file_bytes = f.read()
                file_content = list(file_bytes)
        except Exception as e:
            log.error(f"Support Agent: Failed to read deliverable {deliverable_path}: {e}")
            continue

        html_body = f"""
        <html>
        <body style="font-family: sans-serif; color: #333; line-height: 1.6;">
            <h2>Your Automated System is Ready!</h2>
            <p>Hi there,</p>
            <p>Thank you for your purchase. We are thrilled to deliver your fully functional project: <b>{title}</b>.</p>
            
            <h3>Installation Manual</h3>
            <div style="background: #f4f4f4; padding: 15px; border-radius: 5px;">
                <ol>
                    <li><b>Download and Extract:</b> Download the attached ZIP file and extract it to a folder on your computer.</li>
                    <li><b>Prerequisites:</b> Ensure you have Python or Node.js installed on your machine depending on the stack generated inside.</li>
                    <li><b>Install Dependencies:</b> Open your terminal in the extracted folder and run <code>pip install -r requirements.txt</code> (for Python) or <code>npm install</code> (for Node.js).</li>
                    <li><b>Configuration:</b> Copy the <code>.env.example</code> file to a new file named <code>.env</code> and fill in your API keys (e.g. OpenAI, GoHighLevel, etc.).</li>
                    <li><b>Run the App:</b> Execute standard start commands like <code>python main.py</code> or <code>npm start</code> to fire up your new system.</li>
                </ol>
            </div>
            
            <p>If you encounter any issues during setup, our engineering team monitors this inbox and will jump right in to help you.</p>
            
            <p>Enjoy your new automation!</p>
            <p>Best regards,<br/>The Support Team</p>
        </body>
        </html>
        """

        try:
            params = {
                "from": from_email,
                "to": [target_email],
                "subject": f"Here is your source code: {title}",
                "html": html_body,
                "attachments": [
                    {
                        "filename": os.path.basename(deliverable_path),
                        "content": file_content
                    }
                ]
            }
            
            response = resend.Emails.send(params)
            log.info(f"Support Agent: Delivery email sent successfully for lead {lead_id}: {response}")
            
            db.update_status(lead_id, "delivered")
            delivered_count += 1

        except Exception as e:
            log.error(f"Support Agent: Failed to deliver email for lead {lead_id}. Error: {e}")

    return delivered_count

if __name__ == "__main__":
    count = run_support_cycle()
    print(f"Support cycle completed: delivered {count} projects.")
