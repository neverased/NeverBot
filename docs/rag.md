# Retrieval-Augmented Generation (RAG) in NeverBot

This document explains how RAG is implemented in NeverBot so you can reuse the approach elsewhere. It covers architecture, data flow, modules, config, indexing, runtime, logging, and extensibility.

## Goals

- Ground SoS answers in the community wiki
- Integrate retrieval into normal chat (mentions, follow-ups, `/ask`)
- Preserve witty/sarcastic persona
- Toggle visible citations on/off

## Architecture

1. Crawler/Parser: fetch wiki pages and extract clean text + links
2. Chunking + Embeddings: split text and embed chunks
3. Storage: MongoDB collections for pages and chunks
4. Retrieval: embed query, find top-N similar chunks
5. Generation: inject snippets into LLM prompt, optionally cite

## Main Files

- Scraping/Indexing
  - `src/wikis/wikiscraper.service.ts` (cheerio parse, p-limit BFS, chunk+embed)
  - `src/scripts/index-sos-wiki.ts` (CLI to run crawler)
- Schemas/Module
  - `src/wikis/schemas/wiki-page.schema.ts`
  - `src/wikis/schemas/wiki-chunk.schema.ts`
  - `src/wikis/wikis.module.ts`
- OpenAI helpers
  - `src/shared/openai/embeddings.ts` (text-embedding-3-large)
  - `src/shared/openai/chat.ts`
- Retrieval
  - `src/wikis/wikisearch.service.ts` (embed query, cosine similarity in app)
- Chat integration
  - `src/discord/gpt/gpt-logic.ts` (detect SoS → fetch sources → inject prompt)
  - `src/discord/discord.service.ts` (passes search service into GPT flow)

## Data Flow

- Indexing
  - Start URL: `https://state-of-survival.fandom.com/wiki/State_of_Survival_Wiki`
  - Crawl → parse → clean → chunk → embed → store (Mongo)
- Query-time
  - Detect SoS intent (keywords)
  - Embed question → retrieve top-N chunks → inject into prompt
  - Answer in persona; optional citations

## Configuration

Required: `BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `GPT_KEY`, `MONGO_USER`, `MONGO_PW`
Optional: `API_URL`, `GOOGLE_CLOUD_CREDENTIALS_PATH`, `RAG_CITE_SOURCES`

- `RAG_CITE_SOURCES=true` adds inline `[Source X]` + clickable list
- `RAG_CITE_SOURCES=false` (default) uses sources silently (no citations)

Validated in `src/core/config/config.module.ts`.

## Packages (RAG-specific)

- `openai`: embeddings (text-embedding-3-large) and chat completions
- `axios`: HTTP fetching for crawler
- `cheerio`: HTML parsing/cleaning
- `p-limit`: crawl concurrency control
- `mongoose` and `@nestjs/mongoose`: store pages/chunks and wire schemas
- `dotenv`: load environment variables

Optional (scale/alternatives): vector DB client (e.g., pgvector, Qdrant, Milvus, Pinecone) to replace in-process cosine search.

## Indexing

```bash
pnpm index:sos
```

Runs `src/scripts/index-sos-wiki.ts` to crawl and index. Tune in that script:

- `maxPages`, `concurrency`.

## Runtime Behavior

- On-demand: retrieval triggers only for SoS-like prompts (`isStateOfSurvivalQuery`)
- Persona: an extra system line enforces witty/sarcastic tone even with sources
- Citations: controlled by `RAG_CITE_SOURCES`

## Logging

- Retrieval: `wikisearch.service.ts` (query + top results)
- RAG injection: `gpt-logic.ts` (when sources are injected/fail)
- Crawling: `wikiscraper.service.ts` (start, fetches, progress, chunks)
- Replies: `discord.service.ts` (question, splitting, reply ID)

## Performance Notes

- Chunk size ~1200 chars, overlap 150 (tune per content)
- Concurrency default 4
- Retrieval uses in-process cosine on a 500-candidate sample (replace with vector DB for scale)

## Reuse Tips

- Storage: for larger KBs, swap to a vector DB (pgvector, Qdrant, Milvus, Pinecone)
- Ingestion: adjust selectors or use MediaWiki API
- Trigger: replace keyword heuristic with classifier or always-on
- Prompting: keep persona separate; add “don’t fabricate” instruction if needed
- Citations: keep `RAG_CITE_SOURCES` env toggle; add per-command overrides if needed
- Observability: move to structured logs (pino/winston) with correlation IDs

## Troubleshooting

- No sources: verify Mongo has `wiki_pages`/`wiki_chunks`, embeddings work, selectors match site
- Bland answers: verify persona lines; tune temperature
- Over/under trigger: update keyword list in `isStateOfSurvivalQuery`

## References

- State of Survival Wiki: <https://state-of-survival.fandom.com/wiki/State_of_Survival_Wiki>
- Embeddings model: OpenAI `text-embedding-3-large`
