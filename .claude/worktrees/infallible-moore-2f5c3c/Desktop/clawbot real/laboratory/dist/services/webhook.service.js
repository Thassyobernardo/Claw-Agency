"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIncomingDM = handleIncomingDM;
const memory_service_1 = require("./memory.service");
const ai_service_1 = require("./ai.service");
const meta_service_1 = require("./meta.service");
async function handleIncomingDM(entry) {
    const messaging = entry.messaging?.[0];
    if (!messaging || !messaging.message || messaging.message.is_echo)
        return;
    const senderId = messaging.sender.id;
    const messageText = messaging.message.text;
    console.log(`📩 Webhook: Processing DM from ${senderId}: "${messageText}"`);
    try {
        // 1. Memory: Get or Create Lead
        const lead = await (0, memory_service_1.getOrCreateLead)(senderId);
        // 2. Memory: Get last 10 messages
        const history = await (0, memory_service_1.getConversationHistory)(lead.id);
        // 3. AI: Generate Response & Extract Data
        const { response, extracted_data } = await (0, ai_service_1.getReceptionistResponse)(history, messageText);
        // 4. Meta: Send response back to IG
        await (0, meta_service_1.sendIGMessage)(senderId, response);
        // 5. Memory: Save Interaction
        await (0, memory_service_1.saveMessage)(lead.id, "user", messageText);
        await (0, memory_service_1.saveMessage)(lead.id, "assistant", response);
        // 6. Logic: Check Qualification (Niche + Pain + Contact)
        const hasNiche = !!extracted_data.niche;
        const hasPain = !!extracted_data.pain;
        const hasContact = !!extracted_data.contact;
        if (hasNiche && hasPain && hasContact && lead.status !== "qualified") {
            console.log("🎯 Webhook: Qualification Threshold Met!");
            await (0, memory_service_1.qualifyLead)(lead.id, extracted_data);
        }
    }
    catch (err) {
        console.error("❌ Webhook: Error handling DM:", err);
    }
}
