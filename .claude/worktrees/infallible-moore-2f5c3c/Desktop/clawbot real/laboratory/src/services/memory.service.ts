import sql from "../db";

export async function getOrCreateLead(igId: string, handle?: string) {
  try {
    const [lead] = await sql`
      INSERT INTO leads (ig_id, ig_handle)
      VALUES (${igId}, ${handle || null})
      ON CONFLICT (ig_id) DO UPDATE SET ig_handle = EXCLUDED.ig_handle
      RETURNING *;
    `;
    return lead;
  } catch (err) {
    console.error("❌ Memory: getOrCreateLead Error:", err);
    throw err;
  }
}

export async function getConversationHistory(leadId: string, limit: number = 10) {
  try {
    const [conversation] = await sql`
      SELECT message_log FROM conversations WHERE lead_id = ${leadId};
    `;

    if (!conversation) {
      // Create empty conversation if not exists
      await sql`INSERT INTO conversations (lead_id) VALUES (${leadId});`;
      return [];
    }

    // Return only the last N messages
    const log = conversation.message_log || [];
    return log.slice(-limit);
  } catch (err) {
    console.error("❌ Memory: getConversationHistory Error:", err);
    return [];
  }
}

export async function saveMessage(leadId: string, role: "user" | "assistant", text: string) {
  try {
    const newMessage = { role, text, timestamp: new Date().toISOString() };
    
    await sql`
      UPDATE conversations 
      SET message_log = message_log || ${JSON.stringify(newMessage)}::jsonb,
          last_sync = CURRENT_TIMESTAMP
      WHERE lead_id = ${leadId};
    `;
    
    console.log(`💾 Memory: Message saved for Lead ${leadId} [${role}]`);
  } catch (err) {
    console.error("❌ Memory: saveMessage Error:", err);
  }
}

export async function qualifyLead(leadId: string, data: { niche?: string, contact?: string, pain?: string }) {
  try {
    await sql`
      UPDATE leads 
      SET status = 'qualified',
          niche = ${data.niche || null},
          contact_info = contact_info || ${JSON.stringify(data.contact ? { contact: data.contact } : {})}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${leadId};
    `;
    console.log(`🏆 Memory: Lead ${leadId} marked as QUALIFIED!`);
  } catch (err) {
    console.error("❌ Memory: qualifyLead Error:", err);
  }
}
