# NeverBot

General-purpose Discord chatbot built with NestJS and Discord.js. Features conversational AI with a unique personality, image generation, translations, and server management utilities.

## Features

- Conversational chat using OpenAI Chat Completions with a witty, dynamic personality
- User personality tracking and adaptive responses
- Image generation via `gpt-image-1` (`/imagine`)
- OCR + translation of image text (Google Vision + Translate)
- Server utilities: welcome messages, channel enablement, trap scheduling helpers
- Conversation context management for natural multi-turn interactions
- Comprehensive metrics and observability (Prometheus/Grafana)

## Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- MongoDB Atlas (or MongoDB URI) for persistence
- OpenAI API key
- Discord Bot token and Application ID
- Optional: Google Cloud credentials for OCR/Translate

## Environment Variables

Set these in your shell or a `.env` file:

```bash
BOT_TOKEN=your_discord_bot_token
DISCORD_APPLICATION_ID=your_discord_app_id
GPT_KEY=your_openai_api_key

# Legacy (optional fallback):
# MONGO_USER=your_mongodb_user
# MONGO_PW=your_mongodb_password

# Optional
PORT=3500
API_URL=http://localhost:3500/
GOOGLE_CLOUD_CREDENTIALS_PATH=./sos-aio-bot-40e1568bd219.json
NODE_ENV=development
# Metrics
# If you want to allow higher-cardinality labels in metrics (use with care)
METRICS_HIGH_CARD=false
```

Mongo is configured in `src/app.module.ts` to prefer `MONGO_URI`. If not set, it will fall back to `MONGO_USER`/`MONGO_PW`.

## Install

```bash
pnpm install
# or
npm install
```

## Commands Registration (Discord)

Registers all slash commands under `src/discord/commands/**`.

```bash
pnpm register-commands
# or
npx ts-node src/register-commands.ts
```

Ensure `BOT_TOKEN` and `DISCORD_APPLICATION_ID` are set.

## Run the Bot

```bash
# development with watch
pnpm start:dev

# normal start
pnpm start

# production build and run
pnpm build && pnpm start:prod
```

The Nest API starts on `http://localhost:3500` (see `src/main.ts`).

### API Docs

- Swagger is available only in non‑production environments at `http://localhost:3500/api/docs`.
- Global API prefix is `/api` (e.g., `GET /api`).

### Health Endpoints

- Liveness: `GET /api/health` → `ok`
- Readiness: `GET /api/ready` → `ready`
- Prometheus metrics: `GET /api/metrics`

## Metrics & Observability

- Prometheus endpoint at `/api/metrics` with:
  - `discord_command_latency_ms` (histogram with `command` label)
  - `discord_command_success_total`, `discord_command_errors_total`
  - `openai_request_errors_total`, `discord_rate_limit_hits_total`
- Optional `METRICS_HIGH_CARD` to allow higher-card labels (off by default).
- Starter Grafana dashboard: `docs/metrics-grafana-dashboard.json` (set your Prometheus datasource UID in `DS_PROM`).
- Example Prometheus alerting rules: `docs/prometheus-rules.yml`

## Available Slash Commands (examples)

- `/ask` — Ask NeverBot anything and get witty, contextual responses
- `/imagine` — Generate an image from a prompt
- `/help` — List available commands
- `/server` — Show server info
- `/user` — Show user info and personality summary
- `/personality` — View or update your personality profile
- `/botstat` — Show bot stats
- `/setbotchannels` — Configure which channels the bot can reply in
- `/setwelcomechannel` — Configure a welcome channel
- `/resetconversation` — Reset conversation context for your channel
- `/trap` — Configure trap time/channel (utility)
- `/changelog` — View bot changelog
- `/help` — List available commands
- `/ping` — Check bot responsiveness

## Project Structure

- `src/discord` — Discord gateway and commands
  - `discord.service.ts` — client lifecycle, message/interaction handling
  - `commands/**` — slash commands (grouped by category: gpt, utility, fun)
  - `gpt/gpt-logic.ts` — prompt building and OpenAI invocation with personality integration
- `src/shared/openai` — OpenAI chat helpers
- `src/users` — user profiles, messages, and personality summaries
- `src/servers` — per‑server settings (enabled channels, welcome channel, trap, conversation state)
- `src/tasks` — task management system
- `src/scripts` — maintenance scripts (message backfill, summary updates)
- `src/core` — configuration, filters, interceptors, and metrics

## Testing

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

## Deployment

Use the provided `Dockerfile` and scripts to containerize. Ensure all env vars are provided in the runtime environment. For production, register commands once per deploy when commands change.

## Operations

- Prometheus scrape
  - Ensure Prometheus can reach the service (default `PORT=3500`). Example scrape config:

    ```yaml
    scrape_configs:
      - job_name: 'neverbot'
        metrics_path: /api/metrics
        static_configs:
          - targets: ['neverbot:3500']
    ```

  - If running behind a reverse proxy, expose `/api/metrics` accordingly.

- Grafana dashboard
  - Import `docs/metrics-grafana-dashboard.json`.
  - Set your Prometheus datasource UID in the dashboard variable `DS_PROM`.

- Alerts
  - Load `docs/prometheus-rules.yml` in Prometheus:

    ```yaml
    rule_files:
      - /etc/prometheus/rules/prometheus-rules.yml
    ```

  - Adjust thresholds to your latency/error budgets.

- Metrics cardinality
  - `METRICS_HIGH_CARD=false` by default to avoid label explosion.
  - If you enable it, keep labels limited (e.g., per-command), do not include user or channel IDs.

## Troubleshooting

- No replies: verify the bot has permissions and the channel is enabled (see `/setbotchannels`).
- Command not found: re‑run command registration and check `DISCORD_APPLICATION_ID`.
- OpenAI errors: confirm `GPT_KEY` is set and OpenAI access is active.
- Mongo connection: confirm `MONGO_URI` or `MONGO_USER`/`MONGO_PW` and network access.
- Conversation issues: use `/resetconversation` to clear conversation context.

## Contributing

Feel free to submit issues or pull requests to improve NeverBot!
