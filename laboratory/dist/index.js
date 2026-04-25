"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const logger_1 = require("hono/logger");
const pretty_json_1 = require("hono/pretty-json");
const dotenv_1 = require("dotenv");
const cron_service_1 = require("./services/cron.service");
(0, dotenv_1.config)();
const app = new hono_1.Hono();
app.use("*", (0, logger_1.logger)());
app.use("*", (0, pretty_json_1.prettyJSON)());
// --- INITIALIZE AUTOMATIONS ---
(0, cron_service_1.initCronJobs)();
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
const webhook_service_1 = require("./services/webhook.service");
// ... [logger, prettyJSON, etc.]
// --- META WEBHOOK PROCESSING (POST) ---
app.post("/webhook", async (c) => {
    const body = await c.req.json();
    if (body.object === "instagram") {
        for (const entry of body.entry) {
            await (0, webhook_service_1.handleIncomingDM)(entry);
        }
        return c.text("EVENT_RECEIVED", 200);
    }
    return c.text("Not Found", 404);
});
// --- HEALTH CHECK ---
app.get("/health", (c) => {
    return c.json({ status: "ok", lab: "Claw Internal Bot", environment: "Bun" });
});
exports.default = {
    port: process.env.PORT || 3000,
    fetch: app.fetch,
};
