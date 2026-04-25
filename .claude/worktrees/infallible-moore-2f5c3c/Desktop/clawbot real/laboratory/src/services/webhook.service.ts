import { getOrCreateLead, getConversationHistory, saveMessage, qualifyLead } from "./memory.service";
import { getReceptionistResponse } from "./ai.service";
import { sendIGMessage } from "./meta.service";

export async function handleIncomingDM(entry: any) {
  const messaging = entry.messaging?.[0];
  if (!messaging || !messaging.message || messaging.message.is_echo) return;

  const senderId = messaging.sender.id;
  const messageText = messaging.message.text;

  console.log(`📩 Webhook: Processing DM from ${senderId}: "${messageText}"`);

  try {
    // 1. Memory: Get or Create Lead
    const lead = await getOrCreateLead(senderId);

    // 2. Memory: Get last 10 messages
    const history = await getConversationHistory(lead.id);

    // 3. AI: Generate Response & Extract Data
    const { response, extracted_data } = await getReceptionistResponse(history, messageText);

    // 4. Meta: Send response back to IG
    await sendIGMessage(senderId, response);

    // 5. Memory: Save Interaction
    await saveMessage(lead.id, "user", messageText);
    await saveMessage(lead.id, "assistant", response);

    // 6. Logic: Check Qualification (Niche + Pain + Contact)
    const hasNiche = !!extracted_data.niche;
    const hasPain = !!extracted_data.pain;
    const hasContact = !!extracted_data.contact;

    if (hasNiche && hasPain && hasContact && lead.status !== "qualified") {
      console.log("🎯 Webhook: Qualification Threshold Met!");
      await qualifyLead(lead.id, extracted_data);
    }

  } catch (err) {
    console.error("❌ Webhook: Error handling DM:", err);
  }
}
