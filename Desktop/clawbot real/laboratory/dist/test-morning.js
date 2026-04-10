"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const content_service_1 = require("./services/content.service");
async function runTest() {
    console.log("🧪 LAB TEST: Initiating Manual Morning Update Pipeline...");
    try {
        const result = await (0, content_service_1.processMorningUpdate)();
        console.log("🎉 LAB TEST: Pipeline completed successfully.");
        console.log("SCRIPT GENERATED:", JSON.stringify(result, null, 2));
        process.exit(0);
    }
    catch (err) {
        console.error("❌ LAB TEST: Pipeline failed:", err);
        process.exit(1);
    }
}
runTest();
