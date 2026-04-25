"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCarouselBackground = generateCarouselBackground;
exports.reimagineImage = reimagineImage;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
async function generateCarouselBackground(visualPrompt) {
    console.log(`🎨 Image: Generating Cinematic 'Aussie Pro' background...`);
    // High-end cinematic style injector
    const styleInjector = "cinematic, professional architectural photography, extremely detailed, shallow depth of field, warm amber color grading, sun-drenched, golden hour, realistic, 8k, massive empty negative space for text overlay";
    const fullPrompt = `${visualPrompt}, ${styleInjector}`;
    try {
        const response = await axios_1.default.post("https://api.together.xyz/v1/images/generations", {
            model: "black-forest-labs/FLUX.1-schnell",
            prompt: fullPrompt,
            width: 1088,
            height: 1088,
            steps: 4,
            n: 1,
            response_format: "url"
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
                "Content-Type": "application/json"
            }
        });
        const imageUrl = response.data.data[0].url;
        console.log(`✅ Image: Generated successfully via Together AI: ${imageUrl}`);
        return imageUrl;
    }
    catch (err) {
        console.error("❌ Image: Together AI Error:", err.response?.data || err.message);
        // Generic high-quality fallback
        return "https://images.unsplash.com/photo-1621905235212-09419f71c4c9?q=80&w=1080&auto=format&fit=crop";
    }
}
async function reimagineImage(userImageUrl, visualPrompt) {
    // NOTE: Together AI FLUX.1-schnell is serverless and fast. 
    // For the Freemium tool, we use the visual prompt to generate a high-quality 'Cinematic Digital Twin' of the user's work.
    console.log(`🎨 Image: Re-imagining user work with Together AI (FLUX.1-schnell Serverless)...`);
    const fullPrompt = `Cinematic professional photo of ${visualPrompt}, high-energy, sun-drenched, Melbourne vibes, premium lighting, realistic, 8k, warm amber lighting`;
    try {
        const response = await axios_1.default.post("https://api.together.xyz/v1/images/generations", {
            model: "black-forest-labs/FLUX.1-schnell",
            prompt: fullPrompt,
            width: 1088,
            height: 1088,
            steps: 4,
            n: 1,
            response_format: "url"
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
                "Content-Type": "application/json"
            }
        });
        const imageUrl = response.data.data[0]?.url;
        if (!imageUrl)
            throw new Error("Together AI returned no URL for reimagineImage.");
        console.log(`✅ Image: Re-imagined successfully via Together AI: ${imageUrl}`);
        return imageUrl;
    }
    catch (err) {
        console.error("❌ Image: Together AI Error:", err.response?.data || err.message);
        // Generic fallback
        return "https://images.unsplash.com/photo-1621905235212-09419f71c4c9?q=80&w=1080&auto=format&fit=crop";
    }
}
