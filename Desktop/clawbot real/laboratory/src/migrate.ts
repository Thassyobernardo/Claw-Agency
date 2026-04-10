import sql from "./db";

async function migrate() {
  console.log("🚀 Starting Migration...");

  try {
    // 1. Create Leads Table
    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ig_id TEXT UNIQUE NOT NULL,
        ig_handle TEXT,
        niche TEXT,
        status TEXT DEFAULT 'cold', -- cold, qualified, booked
        contact_info JSONB DEFAULT '{}', -- { "email": "...", "phone": "..." }
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("✅ Leads table created.");

    // 2. Create Conversations Table
    await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        message_log JSONB DEFAULT '[]', -- [{ "role": "user", "text": "...", "timestamp": "..." }]
        last_sync TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("✅ Conversations table created.");

    console.log("🏆 Migration Finished Successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration Failed:", err);
    process.exit(1);
  }
}

migrate();
