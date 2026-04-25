import postgres from "postgres";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 3 });

async function run() {
  console.log("🌱 Seeding demo data…");
  const demoSql = fs.readFileSync(path.join(__dirname, "seeds/demo_data.sql"), "utf-8");
  await sql.unsafe(demoSql);
  console.log("✅ Demo data seeded successfully!");
  await sql.end();
}

run().catch((e) => { console.error("❌", e.message); process.exit(1); });
