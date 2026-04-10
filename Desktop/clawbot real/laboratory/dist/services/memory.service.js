"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateLead = getOrCreateLead;
exports.getConversationHistory = getConversationHistory;
exports.saveMessage = saveMessage;
exports.qualifyLead = qualifyLead;
const db_1 = __importDefault(require("../db"));
async function getOrCreateLead(igId, handle) {
    try {
        const [lead] = await (0, db_1.default) `
      INSERT INTO leads (ig_id, ig_handle)
      VALUES (${igId}, ${handle || null})
      ON CONFLICT (ig_id) DO UPDATE SET ig_handle = EXCLUDED.ig_handle
      RETURNING *;
    `;
        return lead;
    }
    catch (err) {
        console.error("❌ Memory: getOrCreateLead Error:", err);
        throw err;
    }
}
async function getConversationHistory(leadId, limit = 10) {
    try {
        const [conversation] = await (0, db_1.default) `
      SELECT message_log FROM conversations WHERE lead_id = ${leadId};
    `;
        if (!conversation) {
            // Create empty conversation if not exists
            await (0, db_1.default) `INSERT INTO conversations (lead_id) VALUES (${leadId});`;
            return [];
        }
        // Return only the last N messages
        const log = conversation.message_log || [];
        return log.slice(-limit);
    }
    catch (err) {
        console.error("❌ Memory: getConversationHistory Error:", err);
        return [];
    }
}
async function saveMessage(leadId, role, text) {
    try {
        const newMessage = { role, text, timestamp: new Date().toISOString() };
        await (0, db_1.default) `
      UPDATE conversations 
      SET message_log = message_log || ${JSON.stringify(newMessage)}::jsonb,
          last_sync = CURRENT_TIMESTAMP
      WHERE lead_id = ${leadId};
    `;
        console.log(`💾 Memory: Message saved for Lead ${leadId} [${role}]`);
    }
    catch (err) {
        console.error("❌ Memory: saveMessage Error:", err);
    }
}
async function qualifyLead(leadId, data) {
    try {
        await (0, db_1.default) `
      UPDATE leads 
      SET status = 'qualified',
          niche = ${data.niche || null},
          contact_info = contact_info || ${JSON.stringify(data.contact ? { contact: data.contact } : {})}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${leadId};
    `;
        console.log(`🏆 Memory: Lead ${leadId} marked as QUALIFIED!`);
    }
    catch (err) {
        console.error("❌ Memory: qualifyLead Error:", err);
    }
}
