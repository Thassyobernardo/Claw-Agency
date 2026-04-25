import { generateFreemiumScript } from "./services/ai.service";
import { reimagineImage } from "./services/image.service";
import { renderSlide } from "./services/render.service";
import { config } from "dotenv";

config();

async function runFreemiumTest() {
  console.log("🧪 FREEMIUM TEST: Initiating Lead Magnet Pipeline...");
  
  const userText = "Fiz uma instalação elétrica de disjuntores novos numa casa em Surry Hills hoje. Sou um eletricista autorizado em Sydney.";
  const userImage = "https://images.unsplash.com/photo-1621905235212-09419f71c4c9?q=80&w=1080&auto=format&fit=crop";

  try {
    // 1. Generate 3-Slide Script
    const script = await generateFreemiumScript(userText);
    console.log("📜 Script Generated:", JSON.stringify(script, null, 2));

    // 2. Reimagine Image (img2img)
    const cinematicImage = await reimagineImage(userImage, script.visual_prompt);

    // 3. Render 3 Slides
    const slides = ["slide_1", "slide_2", "slide_3"];
    for (const [idx, key] of slides.entries()) {
      await renderSlide(script[key], idx, cinematicImage, `freemium_${idx + 1}.jpg`);
    }

    console.log("🎉 FREEMIUM TEST: Pipeline completed successfully. Check output/ directory.");
  } catch (err) {
    console.error("❌ FREEMIUM TEST: Failed:", err);
  }
}

runFreemiumTest();
