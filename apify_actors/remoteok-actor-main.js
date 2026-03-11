/**
 * Actor Apify: Remote OK Jobs
 * Usa a API pública https://remoteok.com/api e devolve itens no formato CLAW:
 * { title, description, budget, url, category, client_country }
 *
 * No Apify: Develop new Actor → Crawlee + Cheerio (JavaScript) → colar este código no main.
 * Nome sugerido: remoteok-jobs → ID será seu_usuario~remoteok-jobs
 */

import { Actor } from "apify";

await Actor.init();

const LIMIT = 50; // máx. vagas por run
const input = await Actor.getInput() || {};
const keyword = (input.keyword || "").toLowerCase(); // opcional: filtrar por "data analyst"

const dataset = await Actor.openDataset();
let pushed = 0;

try {
  const resp = await fetch("https://remoteok.com/api");
  const raw = await resp.json();
  // API devolve array: primeiro elemento pode ser cabeçalho, resto são objetos de vagas
  const list = Array.isArray(raw) ? raw : [];
  const jobs = list.filter((item) => item && typeof item === "object" && item.position);

  for (const job of jobs.slice(0, LIMIT)) {
    const position = String(job.position || "").trim();
    const descriptionRaw = job.description;
    const description = typeof descriptionRaw === "string"
      ? descriptionRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000)
      : (Array.isArray(descriptionRaw) ? descriptionRaw.join(" ") : String(descriptionRaw || "")).slice(0, 2000);

    if (keyword && !(position + " " + description).toLowerCase().includes(keyword)) continue;

    const salaryMin = job.salary_min;
    const salaryMax = job.salary_max;
    let budget = "N/A";
    if (salaryMin != null || salaryMax != null) {
      const a = salaryMin != null ? salaryMin : salaryMax;
      const b = salaryMax != null ? salaryMax : salaryMin;
      budget = a === b ? `$${a}` : `$${a}–$${b}`;
    }

    const slug = job.slug || job.id || "";
    const jobUrl = job.url || (slug ? `https://remoteok.com/lazy/${slug}` : "");

    const item = {
      title: position,
      description: description || position,
      budget,
      url: jobUrl,
      category: (job.tags && job.tags[0]) ? String(job.tags[0]) : "Remote",
      client_country: String(job.position_location_country || job.location || ""),
    };

    await dataset.pushData(item);
    pushed++;
  }

  Actor.log.info(`Remote OK: ${pushed} vagas enviadas ao dataset.`);
} catch (e) {
  Actor.log.error("Remote OK API error: " + e.message);
} finally {
  try {
    await Actor.exit();
  } catch (exitErr) {
    Actor.log.error("Exit: " + (exitErr && exitErr.message));
  }
}
