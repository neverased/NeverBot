# NeverBot

Discord chatbot built with NestJS and Discord.js. It supports normal conversation, image generation, translations, and grounded answers for the State of Survival wiki using a built‑in crawler + embeddings (RAG).


## Features
- Conversational chat using OpenAI Chat Completions
- Image generation via `gpt-image-1` (`/imagine`)
- OCR + translation of image text (Google Vision + Translate)
- State of Survival wiki ingestion and retrieval to ground answers in normal chat
- Server utilities: welcome messages, channel enablement, trap scheduling helpers

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
MONGO_USER=your_mongodb_user
MONGO_PW=your_mongodb_password
# Optional
API_URL=http://localhost:3500/
GOOGLE_CLOUD_CREDENTIALS_PATH=./sos-aio-bot-40e1568bd219.json
NODE_ENV=development
```

Mongo is configured in `src/app.module.ts` to use the Atlas connection with `MONGO_USER`/`MONGO_PW`.

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

## State of Survival Wiki Ingestion (RAG)
The bot can answer State of Survival questions grounded in the wiki content during normal interactions and `/ask`. To ingest the wiki:

```bash
pnpm index:sos
```

This runs `src/scripts/index-sos-wiki.ts`, crawling from:
`https://state-of-survival.fandom.com/wiki/State_of_Survival_Wiki`

Notes:
- Adjust `maxPages`/`concurrency` in `src/scripts/index-sos-wiki.ts`.
- Requires `GPT_KEY` for embeddings and MongoDB for storage.
- Be mindful of target site policies; tune rate and scope responsibly.

Retrieval is triggered automatically when prompts look game‑related (heuristics in `src/discord/gpt/gpt-logic.ts`), and responses will cite sources inline like `[Source 1]`.

## Available Slash Commands (examples)
- `/ask` — Ask anything; SoS questions are grounded using indexed sources
- `/imagine` — Generate an image from a prompt
- `/help` — List available commands
- `/server` — Show server info
- `/user` — Show user info
- `/botstat` — Show bot stats
- `/setbotchannels` — Configure which channels the bot can reply in
- `/setwelcomechannel` — Configure a welcome channel
- `/trap` — Configure trap time/channel (utility)

## Project Structure
- `src/discord` — Discord gateway and commands
  - `discord.service.ts` — client lifecycle, message/interaction handling
  - `commands/**` — slash commands (grouped by category)
  - `gpt/gpt-logic.ts` — prompt building and OpenAI invocation with SoS retrieval
- `src/wikis` — wiki ingestion and retrieval
  - `wikiscraper.service.ts` — crawler + parser + chunking + embeddings
  - `wikisearch.service.ts` — naive cosine search over embeddings
  - `schemas/` — `wiki-pages` and `wiki-chunks` models
- `src/shared/openai` — OpenAI chat and embeddings helpers
- `src/users` — user profiles, messages, and personality summaries
- `src/servers` — per‑server settings (enabled channels, welcome channel, trap)
- `src/scripts` — maintenance/indexing scripts

## Testing

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

## Deployment
Use the provided `Dockerfile` and scripts to containerize. Ensure all env vars are provided in the runtime environment. For production, register commands once per deploy when commands change.

## Troubleshooting
- No replies: verify the bot has permissions and the channel is enabled (see `/setbotchannels`).
- Command not found: re‑run command registration and check `DISCORD_APPLICATION_ID`.
- Embeddings errors: confirm `GPT_KEY` is set and OpenAI access is active.
- Mongo connection: confirm `MONGO_USER`/`MONGO_PW` and network access.

## Credits
- State of Survival reference: [State of Survival Wiki](https://state-of-survival.fandom.com/wiki/State_of_Survival_Wiki)
