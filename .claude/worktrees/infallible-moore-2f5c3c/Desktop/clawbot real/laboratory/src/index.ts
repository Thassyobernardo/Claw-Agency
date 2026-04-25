import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { config } from "dotenv";
import { initCronJobs } from "./services/cron.service";

config();

const app = new Hono();

app.use("*", logger());
app.use("*", prettyJSON());

// --- INITIALIZE AUTOMATIONS ---
initCronJobs();

const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || "CLAW_LAB_SECRET";

// --- META WEBHOOK VERIFICATION (GET) ---
app.get("/webhook", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED");
    return c.text(challenge || "", 200);
  }

  return c.text("Forbidden", 403);
});

import { handleIncomingDM } from "./services/webhook.service";

// ... [logger, prettyJSON, etc.]

// --- META WEBHOOK PROCESSING (POST) ---
app.post("/webhook", async (c) => {
  const body = await c.req.json();
  
  if (body.object === "instagram") {
    for (const entry of body.entry) {
      await handleIncomingDM(entry);
    }
    return c.text("EVENT_RECEIVED", 200);
  }

  return c.text("Not Found", 404);
});

// --- HEALTH CHECK ---
app.get("/health", (c) => {
  return c.json({ status: "ok", lab: "Claw Internal Bot", environment: "Bun" });
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
