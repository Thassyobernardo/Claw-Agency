# Skill: spend_to_carbon_analyzer

## Purpose
Classifies financial transactions against Australian National Greenhouse Accounts (NGA)
emission factors and calculates kg CO2e per transaction and in aggregate by scope.

## Trigger commands (Telegram)
- `/analyse` — classify a batch of transactions
- `/factors` — list available NGA emission factors

## API Endpoints
| Method | Path            | Description                                       |
|--------|-----------------|---------------------------------------------------|
| POST   | `/analyse`      | Main analysis endpoint — returns CO2e by scope    |
| GET    | `/factors`      | List all NGA emission factors (filterable)        |
| GET    | `/factors/{id}` | Get a single factor by UUID                       |
| GET    | `/health`       | Service health check                              |

## Classification Pipeline
1. **Keyword pre-match** — checks `match_keywords[]` array in emission_factors table (fast, O(1))
2. **Groq LLM** — `llama-3.3-70b-versatile` with JSON mode (low temperature = 0.1)
3. **Gemini fallback** — `gemini-2.0-flash` if Groq fails
4. **Confidence gate** — results below 70% confidence are flagged `NEEDS_REVIEW`
5. **FACTOR_NOT_FOUND** — returned when no factor can be matched

## Calculation Methods
- `activity_based`: quantity × co2e_factor (e.g. litres × kg CO2e/L)
- `spend_based`: amount_aud × co2e_factor (e.g. AUD × kg CO2e/AUD)
- Falls back to spend-based when quantity is unavailable for activity-based factors

## Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string
- `GROQ_API_KEY` — Groq API key (primary LLM)
- `GEMINI_API_KEY` — Google Gemini API key (fallback LLM)
