# Actors Apify: Remote OK e LinkedIn

O CLAW usa dois IDs de Actor além do Upwork:
- **REMOTEOK_ACTOR_ID** — vagas do Remote OK (volume)
- **LINKEDIN_ACTOR_ID** — vagas do LinkedIn (volume)

---

## 1. Remote OK (criar o seu próprio Actor — API gratuita)

O Remote OK tem API pública: `https://remoteok.com/api`. Não precisa de Actor pago no Store.

### Passos no Apify

1. **Develop a new Actor** → template **Quick start: Crawlee + Cheerio (JavaScript)**.
2. Nome: **remoteok-jobs** (o ID será `seu_usuario~remoteok-jobs`).
3. No arquivo principal (ex.: `src/main.js` ou `main.mjs`), **substitua** todo o conteúdo pelo código em `apify_actors/remoteok-actor-main.js` neste repo.
4. **Save** e **Run**. Na aba Dataset, confira se saem itens com `title`, `description`, `budget`, `url`.
5. Copie o **Actor ID** (ex.: `homey_angel~remoteok-jobs`) e no Railway defina:
   - **REMOTEOK_ACTOR_ID** = `seu_usuario~remoteok-jobs`

---

## 2. LinkedIn (usar Actor do Store)

O LinkedIn não tem API pública; use um Actor do Apify Store.

### Opções no Store

| Actor | ID (exemplo) | Notas |
|-------|----------------|--------|
| **LinkedIn Jobs Scraper** (Scraper Engine) | `scraper-engine/linkedin-jobs-scraper` | Pago, estável |
| **LinkedIn Jobs Scraper** (Artificially) | `artifically/linkedin-jobs-scraper` | Pago por resultado |
| **LinkedIn Job Postings Scraper** (Eunit) | `eunit/linkedin-job-postings-scraper` | Pago |

### Passos

1. Abra [Apify Store](https://apify.com/store) e procure **"LinkedIn Jobs"**.
2. Escolha um Actor (ex.: **scraper-engine/linkedin-jobs-scraper**).
3. Clique em **Try for free** / **Use** e anote o **Actor ID** (ex.: `scraper-engine/linkedin-jobs-scraper`).
4. No Railway defina:
   - **LINKEDIN_ACTOR_ID** = `scraper-engine/linkedin-jobs-scraper` (ou o ID que escolheu)
5. O backend CLAW já normaliza saídas comuns (jobTitle → title, jobUrl → url, etc.). Se o seu Actor usar outros campos, podemos mapear no código.

**Input do Actor:** normalmente você passa uma ou mais URLs de busca do LinkedIn Jobs (ex.: `https://www.linkedin.com/jobs/search/?keywords=data%20analyst`). Configure no input do Actor no Apify (ou via API quando o CLAW chamar o Actor).

---

## Formato esperado pelo CLAW

Cada item no dataset deve ter (ou ser mapeado para):

- **title** — título da vaga  
- **description** — texto da vaga (pode ser resumo)  
- **budget** — ex.: "$500" ou "N/A"  
- **url** — link direto para a vaga  

O backend adiciona **platform** (`remoteok` ou `linkedin`) automaticamente.
