"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ai_service_1 = require("./services/ai.service");
const image_service_1 = require("./services/image.service");
const render_service_1 = require("./services/render.service");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
async function runFreemiumTest() {
    console.log("🧪 FREEMIUM TEST: Initiating Lead Magnet Pipeline...");
    const userText = "Fiz uma instalação elétrica de disjuntores novos numa casa em Surry Hills hoje. Sou um eletricista autorizado em Sydney.";
    const userImage = "https://images.unsplash.com/photo-1621905235212-09419f71c4c9?q=80&w=1080&auto=format&fit=crop";
    try {
        // 1. Generate 3-Slide Script
        const script = await (0, ai_service_1.generateFreemiumScript)(userText);
        console.log("📜 Script Generated:", JSON.stringify(script, null, 2));
        // 2. Reimagine Image (img2img)
        const cinematicImage = await (0, image_service_1.reimagineImage)(userImage, script.visual_prompt);
        // 3. Render 3 Slides
        const slides = ["slide_1", "slide_2", "slide_3"];
        for (const [idx, key] of slides.entries()) {
            await (0, render_service_1.renderSlide)(script[key], idx, cinematicImage, `freemium_${idx + 1}.jpg`);
        }
        console.log("🎉 FREEMIUM TEST: Pipeline completed successfully. Check output/ directory.");
    }
    catch (err) {
        console.error("❌ FREEMIUM TEST: Failed:", err);
    }
}
runFreemiumTest();
