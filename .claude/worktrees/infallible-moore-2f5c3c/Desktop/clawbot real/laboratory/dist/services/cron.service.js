"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCronJobs = initCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const content_service_1 = require("./content.service");
function initCronJobs() {
    console.log("⏱️ Cron: Initializing Daily Jobs (AU Timezone)...");
    // 1. Morning Post (6:30 AM AEST)
    node_cron_1.default.schedule("30 6 * * *", async () => {
        console.log("🚀 Cron: Running Morning Update [6:30 AM AEST]");
        await (0, content_service_1.processMorningUpdate)();
    }, {
        timezone: "Australia/Sydney"
    });
    // 2. Afternoon Post (4:30 PM AEST)
    node_cron_1.default.schedule("30 16 * * *", async () => {
        console.log("🚀 Cron: Running Afternoon Update [4:30 PM AEST]");
        await (0, content_service_1.processAfternoonUpdate)();
    }, {
        timezone: "Australia/Sydney"
    });
    console.log("✅ Cron: Scheduled Morning (06:30) and Afternoon (16:30) tasks.");
}
