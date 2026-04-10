import cron from "node-cron";
import { processMorningUpdate, processAfternoonUpdate } from "./content.service";

export function initCronJobs() {
  console.log("⏱️ Cron: Initializing Daily Jobs (AU Timezone)...");

  // 1. Morning Post (6:30 AM AEST)
  cron.schedule("30 6 * * *", async () => {
    console.log("🚀 Cron: Running Morning Update [6:30 AM AEST]");
    await processMorningUpdate();
  }, {
    timezone: "Australia/Sydney"
  });

  // 2. Afternoon Post (4:30 PM AEST)
  cron.schedule("30 16 * * *", async () => {
    console.log("🚀 Cron: Running Afternoon Update [4:30 PM AEST]");
    await processAfternoonUpdate();
  }, {
    timezone: "Australia/Sydney"
  });

  console.log("✅ Cron: Scheduled Morning (06:30) and Afternoon (16:30) tasks.");
}
