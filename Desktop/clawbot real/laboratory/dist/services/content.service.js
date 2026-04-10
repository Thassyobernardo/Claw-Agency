"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMorningUpdate = processMorningUpdate;
exports.processAfternoonUpdate = processAfternoonUpdate;
const news_service_1 = require("./news.service");
const ai_service_1 = require("./ai.service");
const image_service_1 = require("./image.service");
const render_service_1 = require("./render.service");
async function processMorningUpdate() {
    console.log("🌅 Morning Update: Fetching Real Aussie Tradie News [Haiku + Flux]...");
    try {
        const script = await (0, ai_service_1.generateCarouselScript)("", "local");
        const slides = ["slide_1", "slide_2", "slide_3", "slide_4", "slide_5"];
        for (const [idx, key] of slides.entries()) {
            const slideData = script[key];
            // Generating unique cinematic background for THIS specific slide
            console.log(`📸 Creating unique visual for Slide ${idx + 1}...`);
            const backgroundUrl = await (0, image_service_1.generateCarouselBackground)(slideData.visual_prompt);
            const renderData = {
                title: slideData.title,
                text: slideData.text || slideData.subtitle
            };
            await (0, render_service_1.renderSlide)(renderData, idx, backgroundUrl, `morning_${idx + 1}.jpg`);
        }
        console.log("✅ Morning Update: 5 Unique Cinematic Slides Rendered Successfully");
        return script;
    }
    catch (err) {
        console.error("❌ Morning Update: Failed:", err);
    }
}
async function processAfternoonUpdate() {
    console.log("🌇 Afternoon Update: Starting Cinematic Pipeline [Claude 3.5 + Together AI]...");
    try {
        const query = "AI and automation impact on Australian small businesses tradies and cafes 2026";
        const context = await (0, news_service_1.fetchNews)(query);
        const script = await (0, ai_service_1.generateCarouselScript)(context, "local");
        const backgroundUrl = await (0, image_service_1.generateCarouselBackground)(script.visual_prompt);
        const slides = ["slide_1", "slide_2", "slide_3", "slide_4", "slide_5"];
        for (const [idx, key] of slides.entries()) {
            await (0, render_service_1.renderSlide)(script[key], idx, backgroundUrl, `afternoon_${idx + 1}.jpg`);
        }
        console.log("✅ Afternoon Update: 5 Cinematic Slides Rendered Successfully");
        return script;
    }
    catch (err) {
        console.error("❌ Afternoon Update: Failed:", err);
    }
}
