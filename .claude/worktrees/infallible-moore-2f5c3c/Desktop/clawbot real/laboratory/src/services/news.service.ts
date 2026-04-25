import axios from "axios";
import { config } from "dotenv";

config();

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

export async function fetchNews(query: string) {
  console.log(`🔍 News: Searching for "${query}"...`);
  
  if (!TAVILY_API_KEY) {
    console.warn("⚠️ News: TAVILY_API_KEY missing. Using simulated real-world news...");
    return "Title: AI Automation Takes Over Australian Trades in 2026\nSnippet: Recent reports show that plumbers and electricians in AU are saving up to 10 hours a week by deploying AI receptionists to handle Instagram DMs 24/7. This tech is proving crucial for small businesses to scale.";
  }

  try {
    const response = await axios.post("https://api.tavily.com/search", {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 3
    });

    const results = response.data.results;
    if (!results || results.length === 0) {
      throw new Error("No news found for the given query.");
    }

    // Combine titles and snippets for the context
    return results.map((r: any) => `Title: ${r.title}\nSnippet: ${r.content}`).join("\n\n---\n\n");
  } catch (err) {
    console.error("❌ News Fetch Error:", err);
    throw err;
  }
}
