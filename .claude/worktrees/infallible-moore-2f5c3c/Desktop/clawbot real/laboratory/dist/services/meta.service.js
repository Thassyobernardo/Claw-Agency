"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendIGMessage = sendIGMessage;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const ACCESS_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN;
const API_VERSION = "v21.0";
const MESSAGING_URL = `https://graph.facebook.com/${API_VERSION}/me/messages`;
async function sendIGMessage(recipientId, text) {
    console.log(`📤 Meta: Sending response to ${recipientId}...`);
    console.log(`[SIMULATED] TEXT: "${text}"`);
    if (!ACCESS_TOKEN) {
        console.warn("⚠️ Meta: IG_PAGE_ACCESS_TOKEN not set. Message simulation only.");
        return;
    }
    try {
        const response = await axios_1.default.post(MESSAGING_URL, {
            recipient: { id: recipientId },
            message: { text: text },
            message_type: "RESPONSE"
        }, {
            params: { access_token: ACCESS_TOKEN }
        });
        console.log("✅ Meta: Message sent successfully.");
        return response.data;
    }
    catch (err) {
        console.error("❌ Meta: Send Message Error:", err.response?.data || err.message);
        throw err;
    }
}
