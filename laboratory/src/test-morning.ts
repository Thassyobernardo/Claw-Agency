import { processMorningUpdate } from "./services/content.service";

async function runTest() {
  console.log("🧪 LAB TEST: Initiating Manual Morning Update Pipeline...");
  try {
    const result = await processMorningUpdate();
    console.log("🎉 LAB TEST: Pipeline completed successfully.");
    console.log("SCRIPT GENERATED:", JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("❌ LAB TEST: Pipeline failed:", err);
    process.exit(1);
  }
}

runTest();
