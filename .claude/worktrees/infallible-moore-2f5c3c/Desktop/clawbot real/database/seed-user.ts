import { config } from "dotenv";
import path from "path";
import fs from "fs";
import postgres from "postgres";

config({ path: path.join(__dirname, "../.env") });

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

async function main() {
  console.log("🌱 Seeding demo user…");
  const seedPath = path.join(__dirname, "seeds/demo_user.sql");
  const sqlText  = fs.readFileSync(seedPath, "utf8");
  const result   = await sql.unsafe(sqlText);
  console.log(result);
  console.log("✅ Demo user seeded: demo@acmebuilding.com.au / demo1234");
  await sql.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
