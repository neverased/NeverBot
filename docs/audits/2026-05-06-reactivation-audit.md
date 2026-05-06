# NeverBot Reactivation Audit

Date: 2026-05-06
Repo: `/Users/neverased/Codebase/NeverBot`
Branch at audit start: `main...origin/main`

## Scope

- Package-manager health after latest dependency upgrades.
- Local build, lint, unit test, e2e test, and typecheck gates.
- OpenAI/GPT implementation, model usage, Responses API state, image generation, and prompt safety.
- Discord/NestJS runtime risks that can block reactivation.
- CI and Docker compatibility.

MCP/docs used:
- Context7 for OpenAI Node SDK, Jest, and NestJS docs.
- OpenAI Developer Docs MCP for current Responses API and latest-model guidance.
- Local OpenAI SDK types from `openai@6.36.0`.

Subagents used:
- `.codex/agents/test-automator.toml`
- `.codex/agents/llm-architect.toml`
- `.codex/agents/code-reviewer.toml`

## Current Status

The project is not ready to reactivate yet. The first blockers are install/lockfile integrity, TypeScript 6 compatibility, Jest wiring, and Discord.js type changes. Lint passes locally with the repo script, but the GitHub ESLint workflow is stale and currently points at a missing `.eslintrc.js`.

### Verified Commands

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile --offline` | FAIL | `ERR_PNPM_BROKEN_LOCKFILE`, duplicated `meow@13.2.0` mapping at `pnpm-lock.yaml:3594` and `pnpm-lock.yaml:3598`. |
| `pnpm outdated` | FAIL | Same broken lockfile. |
| `pnpm build` | FAIL | TS5011 common source directory/rootDir, TS5101 deprecated `baseUrl`, then production TS errors. |
| `pnpm exec tsc -p tsconfig.build.json --noEmit --rootDir src --ignoreDeprecations 6.0` | FAIL | 28 remaining errors: `catch` variables typed as `unknown`, plus Discord.js partial event callback types. |
| `pnpm test --runInBand` | FAIL | 6/6 suites fail before assertions; `describe`, `it`, `expect`, and `jest` globals are missing in ts-jest compilation. |
| `pnpm test:e2e --runInBand` | FAIL | Same Jest globals issue plus callable `supertest` namespace import error. |
| `pnpm exec eslint "{src,apps,libs,test}/**/*.ts"` | PASS | No output, exit 0. |
| CI ESLint command from `.github/workflows/eslint.yml` | FAIL locally | ESLint 10 cannot stat `.eslintrc.js`; repo now uses `eslint.config.mjs`. |

## Key Findings

### P0: Lockfile Is Broken

`pnpm-lock.yaml` contains a duplicated `meow@13.2.0` package entry. This blocks `pnpm install --frozen-lockfile`, `pnpm outdated`, Docker builds, and CI installs. The dependency chain points through commitlint/conventional changelog tooling, but the immediate issue is lockfile structure, not the package itself.

### P0: Build Is Blocked By TypeScript 6

`tsconfig.json` still has `baseUrl`, which TypeScript 6 reports as deprecated unless `ignoreDeprecations: "6.0"` is set. `tsconfig.build.json` also needs an explicit `rootDir` for `src`.

After those config issues are bypassed, compilation still fails on:
- `catch (error)` variables now treated as `unknown` in many files.
- Discord.js v14 event callbacks that can receive partial reactions, partial users, and partial guild members while the code types handlers as full objects.

### P0: Jest Harness Is Miswired

Unit tests fail before assertions because ts-jest is using the production tsconfig without `types: ["jest", "node"]`. E2E has the same issue and also uses `import * as request from 'supertest'`, which is no longer callable with the current type setup.

Temporary CLI checks by the test subagent showed the existing trivial unit suites can pass once Jest types and TS6 compatibility are supplied, so the immediate problem is harness configuration. That does not mean coverage is meaningful yet.

### P1: OpenAI Wrapper Has State And Role Boundary Issues

`src/shared/openai/chat.ts` uses the Responses API for text, which is the right direction, but it flattens all non-system messages into one string with `User:` and `Assistant:` prefixes. That discards role boundaries that the Responses API supports directly.

The wrapper exposes `conversation: 'auto' | { id }`, but only sends `conversation` when an id already exists and never uses `previous_response_id`. First turns therefore rely on local Discord history, not Responses state. If server-side state is later fixed without changing context assembly, local history plus stored conversation items can duplicate context and increase cost.

Official OpenAI docs currently identify `gpt-5.5` as the latest model and recommend Responses API for GPT-5-family reasoning workflows. The code hardcodes `gpt-5` across ask, welcome, changelog, and summary flows. This should become a per-flow model policy rather than scattered literals.

### P1: OpenAI Failure Handling Can Persist Bad Output

The wrapper logs non-completed Responses status but only throws for `failed`. `incomplete` responses can still be extracted and returned. With GPT-5-family models, `max_output_tokens` includes visible output and reasoning tokens, so low budgets can produce truncated summaries or empty Discord replies.

Global `WEB_SEARCH_ENABLED=true` adds web search to every text flow, including personality summaries and welcome messages. That is too broad for privacy, latency, and cost.

### P1: Personality Summary Is Prompt-Injection Prone

Generated personality summaries are later interpolated into the system prompt as trusted instruction text. This needs a structured output contract and sanitization boundary, for example `{ style, topics, response_guidance }`, not unconstrained text treated as future system guidance.

### P1: Mongo Update Operators Are Wrapped In `$set`

`DiscordService` passes `$set`, `$inc`, `$push`, and `$addToSet` to `UsersService.updateUserByDiscordUserId`, but the service wraps every payload in another `$set`. That can silently break message counters, sentiment history, and topics because the background updater catches and logs the error.

### P2: Discord Interaction Retry Can Double-Acknowledge

`withSafeInteraction` retries `reply` and `deferReply`, but Discord interactions only allow one initial acknowledgement. If the first attempt reaches Discord and times out locally, retrying can trigger already-acknowledged errors. The error handler then may also send the wrong reply method unless it checks `replied/deferred`.

### P2: Runtime Readiness Can Lie

Discord login errors are logged and swallowed, while `/api/ready` always returns `ready`. The process can look healthy while the bot is offline. The service also starts an interval and enables shutdown hooks, but does not own `client.destroy()`/interval cleanup through lifecycle hooks.

### P2: CI And Runtime Version Drift

README says Node 18+, CI uses Node 22, Docker uses `node:24-alpine`, local audit ran on Node 25. The package has no `engines` field or `.nvmrc`, while dependencies/types are now on latest. Reactivation should choose one supported Node target and align README, CI, Docker, and package metadata.

## Repair Plan

### Phase 0: Restore Toolchain Trust

1. Regenerate or manually repair `pnpm-lock.yaml`, then verify `pnpm install --frozen-lockfile`.
2. Pick a runtime target, preferably Node 22 LTS or Node 24 LTS, and align `package.json#engines`, Dockerfile, CI, README, and local version file.
3. Update TypeScript config:
   - remove `baseUrl` if no path aliases require it, or add temporary `ignoreDeprecations: "6.0"`;
   - set `rootDir: "./src"` in `tsconfig.build.json`.
4. Add a small error normalization helper or targeted casts for `unknown` catch variables.
5. Update Discord.js handler signatures for partial reactions/users/members and fetch/narrow before use.

Acceptance:
- `pnpm install --frozen-lockfile`
- `pnpm build`
- `pnpm exec tsc -p tsconfig.build.json --noEmit`

### Phase 1: Make Tests Useful Again

1. Add `tsconfig.spec.json` with Jest/Node types and TS6 deprecation handling.
2. Wire ts-jest unit and e2e transforms to that test tsconfig.
3. Fix `supertest` import in `test/app.e2e-spec.ts`.
4. Stop the smoke e2e test from booting real Discord/Mongo/Natural dependencies, or explicitly mock those modules/providers.
5. Add a `typecheck` script and keep it separate from unit test runtime.

Acceptance:
- `pnpm test --runInBand`
- `pnpm test:e2e --runInBand`
- `pnpm test:cov`

### Phase 2: Stabilize GPT/OpenAI Integration

1. Centralize LLM model policy in config, for example `LLM_MODEL_CHAT`, `LLM_MODEL_SUMMARY`, `LLM_MODEL_FAST`, `LLM_MODEL_IMAGE`, plus per-flow budgets.
2. Refactor `callChatCompletion` to use typed Responses input arrays, preserve roles, and remove `payload as any`.
3. Choose one state mechanism:
   - `previous_response_id` with persisted `response.id`, or
   - explicit Conversations API usage with only new turn input.
4. Treat `failed`, `incomplete`, timeout, 429, and 5xx as separate outcomes with explicit retry/fallback rules.
5. Make web search opt-in per call; remove global tool injection for summaries/welcome/changelog.
6. Move image generation to unique temp files or direct Discord attachments from `Buffer`; normalize OpenAI SDK v6 `APIError` handling.
7. Convert personality summaries to structured output and inject them into prompts as data, not instructions.
8. Add OpenAI metrics for latency, status, model, retries, incomplete reason, cached tokens, reasoning tokens, and image usage.

Acceptance:
- Unit tests for Responses payload shape, retry classification, incomplete handling, web-search opt-in, image generation response parsing, and summary sanitization.
- One manual Discord smoke test for `/ask`, image roasting, `/imagine`, and summary generation using real env.

### Phase 3: Runtime Hardening

1. Fix `UsersService.updateUserByDiscordUserId` so DTO updates and raw Mongo operator updates are separate methods or safely detected.
2. Make Discord interaction acknowledgements idempotent: do not retry `reply`/`deferReply` blindly.
3. Make Discord login failure fail readiness or fail startup.
4. Add `OnModuleDestroy`/shutdown cleanup for Discord client and intervals.
5. Update readiness to reflect Mongo and Discord client state.

Acceptance:
- Focused unit tests for user stats update contract.
- Fake-timer tests for interaction timeout/retry behavior.
- Local startup smoke with missing Discord token and Mongo env verifies readiness/failure mode.

### Phase 4: CI Cleanup

1. Replace stale `.github/workflows/eslint.yml` command with the repo's flat config and package-managed install.
2. CI gates should run install, lint, typecheck/build, unit tests, and e2e smoke in that order.
3. Docker build must use frozen lockfile and the same Node target as CI.

Acceptance:
- All CI checks green on a PR.
- Docker image builds from a clean checkout with `pnpm install --frozen-lockfile`.

## Suggested Commit Order

1. `fix(build): restore pnpm lockfile and node target`
2. `fix(build): support typescript 6 and discord partials`
3. `fix(test): restore jest and e2e harness`
4. `fix(openai): type responses payloads and state handling`
5. `fix(users): preserve mongo update operators`
6. `fix(discord): harden interaction acknowledgements and readiness`
7. `ci: align lint build and test gates`

## References

- OpenAI latest model guidance: `https://developers.openai.com/api/docs/guides/latest-model.md`
- OpenAI migration to Responses API: `https://developers.openai.com/api/docs/guides/migrate-to-responses`
- OpenAI Node SDK docs checked through Context7: `/openai/openai-node/v6_1_0`
- Jest 30 docs checked through Context7: `/websites/jestjs_io_30_0`
- NestJS testing docs checked through Context7: `/nestjs/docs.nestjs.com`
