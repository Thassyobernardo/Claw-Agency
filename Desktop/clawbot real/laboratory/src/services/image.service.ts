import axios from "axios";
import { config } from "dotenv";

config();

export async function generateCarouselBackground(visualPrompt: string) {
  console.log(`🎨 Image: Generating Cinematic 'Aussie Pro' background...`);
  
  // High-end cinematic style injector
  const styleInjector = "cinematic, professional architectural photography, extremely detailed, shallow depth of field, warm amber color grading, sun-drenched, golden hour, realistic, 8k, massive empty negative space for text overlay";
  const fullPrompt = `${visualPrompt}, ${styleInjector}`;
  
  try {
    const response = await axios.post("https://api.together.xyz/v1/images/generations", {
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
  } catch (err: any) {
    console.error("❌ Image: Together AI Error:", err.response?.data || err.message);
    // Generic high-quality fallback
    return "https://images.unsplash.com/photo-1621905235212-09419f71c4c9?q=80&w=1080&auto=format&fit=crop"; 
  }
}

export async function reimagineImage(userImageUrl: string, visualPrompt: string) {
  // NOTE: Together AI FLUX.1-schnell is serverless and fast. 
  // For the Freemium tool, we use the visual prompt to generate a high-quality 'Cinematic Digital Twin' of the user's work.
  console.log(`🎨 Image: Re-imagining user work with Together AI (FLUX.1-schnell Serverless)...`);
  
  const fullPrompt = `Cinematic professional photo of ${visualPrompt}, high-energy, sun-drenched, Melbourne vibes, premium lighting, realistic, 8k, warm amber lighting`;
  
  try {
    const response = await axios.post("https://api.together.xyz/v1/images/generations", {
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
    if (!imageUrl) throw new Error("Together AI returned no URL for reimagineImage.");
    
    console.log(`✅ Image: Re-imagined successfully via Together AI: ${imageUrl}`);
    return imageUrl;
  } catch (err: any) {
    console.error("❌ Image: Together AI Error:", err.response?.data || err.message);
    // Generic fallback
    return "https://images.unsplash.com/photo-1621905235212-09419f71c4c9?q=80&w=1080&auto=format&fit=crop"; 
  }
}
