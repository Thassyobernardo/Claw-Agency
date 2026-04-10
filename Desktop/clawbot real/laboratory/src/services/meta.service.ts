import axios from "axios";
import { config } from "dotenv";

config();

const ACCESS_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN;
const API_VERSION = "v21.0";
const MESSAGING_URL = `https://graph.facebook.com/${API_VERSION}/me/messages`;

export async function sendIGMessage(recipientId: string, text: string) {
  console.log(`📤 Meta: Sending response to ${recipientId}...`);
  console.log(`[SIMULATED] TEXT: "${text}"`);

  if (!ACCESS_TOKEN) {
    console.warn("⚠️ Meta: IG_PAGE_ACCESS_TOKEN not set. Message simulation only.");
    return;
  }

  try {
    const response = await axios.post(MESSAGING_URL, {
      recipient: { id: recipientId },
      message: { text: text },
      message_type: "RESPONSE"
    }, {
      params: { access_token: ACCESS_TOKEN }
    });

    console.log("✅ Meta: Message sent successfully.");
    return response.data;
  } catch (err: any) {
    console.error("❌ Meta: Send Message Error:", err.response?.data || err.message);
    throw err;
  }
}
