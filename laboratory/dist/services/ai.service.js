"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCarouselScript = generateCarouselScript;
exports.generateFreemiumScript = generateFreemiumScript;
exports.getReceptionistResponse = getReceptionistResponse;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const SITE_URL = "https://clawagency.online";
const SITE_NAME = "Claw Agency";
async function callClaude(prompt, jsonMode = true) {
    if (!OPENROUTER_KEY) {
        console.warn("⚠️ OpenRouter: API Key missing. Simulating Claude response...");
        const mockResponse = {
            "slide_1": { "title": "Bigger than your morning coffee", "text": "A new AI shift is hitting Melbourne sparks." },
            "slide_2": { "title": "The Old Way", "text": "Losing 10h a week on admin while on the tools." },
            "slide_3": { "title": "The AI Shift", "text": "24/7 DMs handled while you sleep." },
            "slide_4": { "title": "The Multiplier", "text": "3x more bookings without a single extra call." },
            "slide_5": { "title": "Get Sorted", "text": "DM 'AGENCY' for a free audit on clawagency.online. No drama." },
            "caption": "Aussie lifestyle copy for Instagram. Time to get sorted, mate! Visit clawagency.online or drop us a DM. #AUTradies #MelbourneSparkies #ClawAgency",
            "hashtags": ["#AUTradies", "#MelbourneSparkies", "#ClawAgency"],
            "visual_prompt": "A high-quality, sun-drenched sun-flared shot of a modern clean electrician van or cafe in Melbourne, premium lighting, 8k, realistic."
        };
        return jsonMode ? mockResponse : JSON.stringify(mockResponse);
    }
    try {
        const response = await axios_1.default.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "anthropic/claude-3-5-haiku",
            messages: [{ role: "user", content: prompt }],
            response_format: jsonMode ? { type: "json_object" } : undefined
        }, {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "HTTP-Referer": SITE_URL,
                "X-Title": SITE_NAME,
                "Content-Type": "application/json"
            }
        });
        let text = response.data.choices[0].message.content;
        if (jsonMode) {
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    text = jsonMatch[0];
                }
                return JSON.parse(text);
            }
            catch (e) {
                console.warn("⚠️ AI: Failed to parse JSON from response. Text was:", text);
                throw e;
            }
        }
        return text;
    }
    catch (err) {
        console.warn("⚠️ OpenRouter Error:", err.response?.data || err.message);
        const mockResponse = {
            "slide_1": { "title": "Bigger than your morning coffee", "text": "A new AI shift is hitting Melbourne sparks." },
            "slide_2": { "title": "The Old Way", "text": "Losing 10h a week on admin while on the tools." },
            "slide_3": { "title": "The AI Shift", "text": "24/7 DMs handled while you sleep." },
            "slide_4": { "title": "The Multiplier", "text": "3x more bookings without a single extra call." },
            "slide_5": { "title": "Get Sorted", "text": "DM 'AGENCY' for a free audit on clawagency.online. No drama." },
            "caption": "Aussie lifestyle copy for Instagram. Time to get sorted, mate! Visit clawagency.online or drop us a DM. #AUTradies #MelbourneSparkies #ClawAgency",
            "hashtags": ["#AUTradies", "#MelbourneSparkies", "#ClawAgency"],
            "visual_prompt": "A high-quality, sun-drenched sun-flared shot of a modern clean electrician van or cafe in Melbourne, premium lighting, 8k, realistic."
        };
        return jsonMode ? mockResponse : JSON.stringify(mockResponse);
    }
}
async function generateCarouselScript(newsContext, type) {
    const prompt = `
    You are the "Claw Agency Content Manager". 
    GOAL: Create a 5-slide Instagram carousel script based on real-time news for Australian Tradies.
    
    STRICT REQUIREMENTS:
    1. List 5 REAL technology trends/news snippets happening right now in Australia relevant to tradies (plumbers, sparkies, builders).
    2. Slides 1-5 must each have a HEADLINE (max 6 words), a SUMMARY (max 12 words), AND a unique VISUAL_PROMPT.
    3. VISUAL_PROMPT for each slide must be context-specific (e.g., if news is about solar, prompt for high-end solar panels).
    4. STYLE: Cinematic, professional architectural photography, shallow depth of field, warm amber lighting, golden hour, sun-drenched, extremely realistic, 8k. 
    5. Slide 5 MUST also include the CTA: "DM 'AGENCY' for a free audit on clawagency.online"
    6. TONE: Aussie Pro (High-Trust, Professional, 'Mate').
    7. RETURN JSON ONLY. NO CONVERSATIONAL TEXT.
    
    JSON STRUCTURE:
    {
      "slide_1": { "title": "HEADLINE 1", "text": "SUMMARY 1", "visual_prompt": "Cinematic shot of high-end solar panels on a modern Sydney roof, golden hour glare, 8k" },
      "slide_2": { "title": "HEADLINE 2", "text": "SUMMARY 2", "visual_prompt": "Cinematic shot of modern tradie tools on a clean wooden workbench, warm amber lighting" },
      "slide_3": { "title": "HEADLINE 3", "text": "SUMMARY 3", "visual_prompt": "Cinematic shot of a modern construction site in Melbourne, sun-drenched, professional look" },
      "slide_4": { "title": "HEADLINE 4", "text": "SUMMARY 4", "visual_prompt": "Cinematic shot of an electric dual-cab ute on a rural AU road, dusk lighting, realistic" },
      "slide_5": { "title": "HEADLINE 5", "text": "SUMMARY 5. DM 'AGENCY' for a free audit on clawagency.online", "visual_prompt": "Extreme close up of a professional tradie's hand holding a modern smartphone, worksite in background, blurred" },
      "caption": "Aussie lifestyle copy for Instagram...",
      "hashtags": ["#AUTradies", "#ClawAgency"]
    }
  `;
    return await callClaude(prompt, true);
}
async function generateFreemiumScript(userText) {
    if (!userText || userText.trim().length < 10) {
        throw new Error("❌ Freemium: User description too short to create a professional script.");
    }
    console.log("🧠 Freemium AI: Analyzing user photo context and text...");
    const prompt = `
    You are the "Claw Agency Elite AI Content Manager". 
    GOAL: Turn the user's work description into a professional 3-slide Instagram carousel script.
    
    USER INPUT: "${userText}"
    
    TONE: Aussie Pro (B2B, High-Trust, Casual but Professional). 
    WEBSITE: clawagency.online
    
    SLIDE STRUCTURE:
    1. HOOK: Bold title about the specific work done.
    2. VALUE/OUTCOME: Why this matters to the homeowner/business.
    3. CTA: Direct lead capture to clawagency.online.
    
    RETURN JSON ONLY:
    {
      "slide_1": { "title": "...", "subtitle": "..." },
      "slide_2": { "title": "...", "text": "..." },
      "slide_3": { "title": "Get Sorted", "subtitle": "Want a pipeline of leads like this? Visit clawagency.online" },
      "caption": "Aussie lifestyle copy for Instagram...",
      "hashtags": ["#AUTradies", "#SydneyElectrician", "#ClawAgency"],
      "visual_prompt": "Cinematic shot of a modern electrical board, warm amber lighting, ultra-realistic, 8k"
    }
  `;
    return await callClaude(prompt, true);
}
async function getReceptionistResponse(history, newMessage) {
    const historyContext = history.map(m => `${m.role}: ${m.text}`).join("\n");
    const prompt = `
    You are "Claw Agency AI Receptionist". Talk to a potential AU lead.
    
    TONE: Aussie Pro (B2B, High-Trust, Casual but Professional). 
    HISTORY:
    ${historyContext}
    
    NEW MESSAGE:
    "${newMessage}"
    
    QUALIFICATION CRITERIA (Need all 3 to qualify):
    - NICHE, PAIN, CONTACT (Email OR Phone).
    
    RETURN JSON:
    {
      "response": "Your friendly reply mate",
      "extracted_data": { "niche": "...", "contact": "...", "pain": "..." }
    }
  `;
    return await callClaude(prompt);
}
