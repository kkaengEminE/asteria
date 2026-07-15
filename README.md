# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 57 adds real PostgreSQL operational validation infrastructure for the existing PostgreSQL persistence adapter. In-memory persistence remains the default, SQLite remains available for explicit local/dev mode, PostgreSQL is opt-in through environment configuration, Audit/Metrics/Asset Catalog/Storage Metadata remain in-memory, and publishing remains disabled.

## Commands

```bash
npm run dev
npm run api
npm run dry-run
npm test
npm run typecheck
```

Start the Web MVP and Generate API together:

```bash
npm run dev
```

Open the browser UI at:

```text
http://127.0.0.1:3000
```

The Web MVP uses the existing `POST /generate` API and the default mock provider path, so no external AI API, database, authentication, queue execution, or publishing is required for local demos. Enter a topic, choose `cat` or `dog`, choose `ko-KR` or `en-US`, choose an AI provider, and click Generate to render the workflow status, provider, elapsed generation time, article, summary, SEO, FAQ, selected image metadata, monetization preview, quality score, editorial review, and approval decision. After generation succeeds, use Copy Article or Copy Markdown to reuse the article title/body or a Markdown package containing summary, article, SEO, and FAQ sections.

The browser also keeps a session-only generation history in memory. Each generated result is listed with topic, provider, magazine, language, and relative timestamp. Selecting a history item restores the saved result without making a new API request. Clear History removes only the current browser-session list; no database or authentication is involved.

History entries can also be compared side-by-side. Select two or three history checkboxes, click Compare, and Asteria renders parallel columns for provider, topic, magazine, language, generation timestamp, article, SEO, FAQ, quality score, editorial score, approval decision, and available Instagram or Podcast previews. Differing provider, title, summary, quality score, and approval values are highlighted. Compare mode uses stored browser-session results only and does not call `POST /generate`.

AI provider options in the browser:

- Mock: default, deterministic, no external API required.
- Gemini: requires `GEMINI_PRODUCTION_ENABLED=true` and `GEMINI_API_KEY`; optional `GEMINI_MODEL`.
- OpenAI: requires `OPENAI_PRODUCTION_ENABLED=true` and `OPENAI_API_KEY`; optional `OPENAI_MODEL`.

If Gemini or OpenAI is selected without the required environment variables, the API returns a clean provider configuration error and the Web MVP displays it.

Example Cat topic:

```text
고양이가 밤에 뛰어다니는 이유
```

Example Dog topic:

```text
강아지가 산책 중 냄새를 오래 맡는 이유
```

Start the lightweight HTTP API:

```bash
npm run api
```

Generate a magazine dry-run package through the API:

```bash
curl -X POST http://127.0.0.1:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "고양이가 밤에 뛰어다니는 이유",
    "magazine": "cat",
    "language": "ko-KR",
    "provider": "mock"
  }'
```

`POST /generate` calls the existing provider-neutral `runMagazineDryRun` runtime and returns the generation result as JSON. The optional `provider` field accepts `mock`, `gemini`, or `openai` and maps to the existing AI provider selection path. The API adds no authentication, database, publishing, or queue execution. The CLI dry run remains unchanged.

Run the dry run with a custom topic:

```bash
npm run dry-run -- "indoor enrichment"
```

Run the dry run with opt-in SQLite local/dev persistence:

```bash
ASTERIA_PERSISTENCE_MODE=sqlite \
ASTERIA_SQLITE_DATABASE_PATH=/tmp/asteria-dev.sqlite \
npm run dry-run
```

If `ASTERIA_PERSISTENCE_MODE` is omitted or set to `memory`, Asteria uses the default in-memory persistence composition. SQLite mode requires `ASTERIA_SQLITE_DATABASE_PATH`; missing paths fail before workflow execution.

PostgreSQL operational persistence is available under `src/providers/persistence/postgresql`. It defines SQL, migrations, repositories, lock/idempotency behavior, transaction composition, and a concrete `pg` pool connection behind the existing provider-neutral ports. Dry-run remains memory by default unless PostgreSQL mode is explicitly configured.

Run the dry run with explicit PostgreSQL operational persistence:

```bash
ASTERIA_PERSISTENCE_MODE=postgresql \
ASTERIA_POSTGRESQL_URL=postgresql://user:password@localhost:5432/asteria \
npm run dry-run
```

Optional PostgreSQL pool variables:

```bash
ASTERIA_POSTGRESQL_POOL_MIN=0
ASTERIA_POSTGRESQL_POOL_MAX=10
ASTERIA_POSTGRESQL_CONNECTION_TIMEOUT_MS=5000
ASTERIA_POSTGRESQL_IDLE_TIMEOUT_MS=30000
ASTERIA_POSTGRESQL_STATEMENT_TIMEOUT_MS=30000
ASTERIA_POSTGRESQL_SSL_MODE=disable
```

Run the opt-in PostgreSQL smoke test against an isolated database:

```bash
ASTERIA_PERSISTENCE_MODE=postgresql \
ASTERIA_POSTGRESQL_URL=postgresql://user:password@localhost:5432/asteria \
npm run postgresql:smoke
```

The smoke test checks pool readiness, health check, migration startup, and graceful close. Normal tests do not require PostgreSQL to be installed or running.

Run the opt-in PostgreSQL real-database operational validation suite:

```bash
npm run test:postgresql
```

The PostgreSQL validation suite starts a disposable `postgres:16.6-alpine` Docker container when Docker or OrbStack is running. It validates migrations, repeated startup, unsupported schema detection, repository persistence across pool recreation, revision conflicts, UnitOfWork rollback, idempotency, locks, runtime dry-run with PostgreSQL mode, and credential redaction. If Docker is unavailable, the suite exits successfully with all PostgreSQL integration cases marked as skipped. Normal `npm test` never requires Docker or a running PostgreSQL server.

Run the dry run with production AI mode only when OpenAI configuration is intentionally enabled:

```bash
npm run dry-run -- --ai openai "indoor enrichment"
```

Run the dry run with Gemini only when Gemini configuration is intentionally enabled:

```bash
npm run dry-run -- --ai gemini "고양이가 밤에 뛰어다니는 이유"
```

Run the dry run with an explicit language:

```bash
npm run dry-run -- --ai gemini --language ko-KR "고양이가 밤에 뛰어다니는 이유"
```

Run the dry run with an explicit magazine profile:

```bash
npm run dry-run -- --magazine cat --ai gemini --language ko-KR "고양이가 밤에 뛰어다니는 이유"
```

Run the dry run with Dog Magazine:

```bash
npm run dry-run -- --magazine dog --language ko-KR "강아지가 산책 중 냄새를 오래 맡는 이유"
```

Run the dry run with the production-capable Coupang adapter only when Coupang configuration is intentionally enabled:

```bash
npm run dry-run -- --affiliate coupang "indoor enrichment"
```

Magazine profiles may extend reusable templates. The current Cat and Dog profiles extend `magazines/templates/blog.example.json`, inheriting shared review, SEO, image, and affiliate defaults while overriding magazine-specific prompt profile, tone, persona, and categories. The CLI runs both through the shared magazine runtime.

Run the Quality Lab batch evaluator with a newline-separated topic file:

```bash
npm run quality-lab -- topics.txt --magazine cat --ai gemini --language ko-KR
```

Quality Lab can target any configured magazine profile, for example `--magazine dog`.

Quality Lab generates one dry-run PublishingPackage per topic and writes a Markdown review report under `reports/quality-lab` by default. The report includes per-topic title, summary, quality score, review score, approval status, generation time, token usage, and an overall score and approval summary. Publishing remains disabled.

Storage is currently an internal foundation only. The LocalStorageProvider can upload, download, list, create folders, and read metadata behind the shared StorageProvider interface for tests and future composition work. The Google Drive StorageProvider implements the same boundary with upload, download, list, folder creation, and metadata lookup, but it is disabled unless `GOOGLE_DRIVE_ENABLED=true`, `GOOGLE_DRIVE_CREDENTIALS`, and `GOOGLE_DRIVE_ROOT_FOLDER` are configured. Tests use mocked transport only. Publishing remains disabled.

Asset Library sits above StorageProvider. It registers assets, stores or retrieves file content through the configured storage backend, exposes asset metadata through `AssetCatalogRepository`, can record storage metadata through `StorageMetadataRepository`, and can project image assets into the image domain used by dry-run image selection. Google Drive is treated as a storage backend, not as the asset model itself.

Publishing Queue sits between editorial approval and future publisher execution. It stores provider-neutral queue items through `PublishingQueueRepository`, uses the in-memory repository in current runtime composition, records approval decisions and destinations, rejects `NEEDS_REVIEW`, `REJECTED`, or missing approval packages, audits queue rejections, enforces explicit status transition rules, and does not invoke publisher adapters during dry-run queue preview.

Scheduler Operations sit after Publishing Queue. SchedulerService composes through `SchedulerRepository` with runtime-selected persistence and can create, list, get, reschedule, retry scheduling, cancel, and mark jobs completed for operational preview. It prevents duplicate active jobs, rejects invalid schedules, keeps completed jobs immutable, emits scheduler audit events, records scheduler metrics, and displays operational state in dry-run output. Scheduling uses UnitOfWork so the queue `SCHEDULED` transition and scheduled job creation share one transaction boundary when durable persistence is selected. It does not run cron, call external schedulers, or publish content.

Scheduled Job Executor sits after Scheduler. It checks due status, skips future/cancelled/invalid jobs, records executions through `JobExecutionRepository`, uses `IdempotencyStore` and `LockManager` for duplicate execution prevention, moves valid queue items to `PROCESSING`, and can execute scheduled publishing previews through PublisherService without transitioning to `PUBLISHED`. It uses RetryService for recoverable execution failures and does not call WordPress or any network publisher adapter.

Publisher Foundation sits between scheduled execution and concrete publisher adapters. It defines provider-neutral publish request/result/failure/status models, validates requests, dispatches through PublisherService, audits publish started/succeeded/failed/skipped events, and supports DryRunPublisher preview mode while real publishing remains disabled.

WordPress Publisher Adapter sits behind the Publisher boundary. It maps provider-neutral publish requests into WordPress post payloads, uses an injectable transport, retries recoverable transport failures, emits publish audit events, and requires `WORDPRESS_ENABLED=true`, `WORDPRESS_SITE_URL`, `WORDPRESS_USERNAME`, and `WORDPRESS_APPLICATION_PASSWORD` before adapter execution. Tests use mocked transport only.

Legacy provider contracts are being retired gradually. Current AI providers live under `src/providers/ai`, publisher execution models live under `src/domain/publisher`, and provider adapters must not import obsolete `src/core` contracts. Remaining `src/core` contracts are kept only where they are still active or compatibility-safe.

Legacy publishing contracts have been retired from active paths. PublishingWorkflow now creates provider-neutral `PublishRequest` values and returns `PublishResult` values through PublisherService. The dry-run CLI keeps the existing Publish Preview section while using the current publisher domain internally.

Metrics Foundation records operational counters, durations, and failures through `MetricsStore` for dry-run observability. The current runtime uses an in-memory store. Metrics are provider-neutral and observational only; they do not change approval, queue, scheduler, executor, publisher, or provider decisions.

Instagram Content Generation is dry-run only. It converts the provider-neutral PublishingPackage into social preview content using magazine profile values and SEO keywords. It does not post, call Instagram APIs, perform OAuth, or publish content.

Podcast / TTS Foundation is dry-run only. It converts the provider-neutral PublishingPackage into an audio-ready preview package using magazine profile values and, when available, Instagram Preview hook and CTA text. It does not synthesize audio, call TTS APIs, publish podcasts, or upload media.

Audit Log records important workflow events through `AuditStore`; the current runtime uses an in-memory store while preserving dry-run timeline ordering. The dry run displays a timeline for content generation, quality evaluation, editorial review completion, approval decisions, queue events, scheduler events, and job execution events. External logging remains deferred.

Persistence Architecture is documented under `docs/PERSISTENCE_ARCHITECTURE.md`. Persistence ports live under `src/services/persistence` and expose provider-neutral domain models only. Current runtime services use in-memory adapters behind those ports; durable database/filesystem adapters remain deferred.

Runtime persistence composition is explicit. `PersistenceCompositionFactory` creates the dry-run in-memory repository/store/lock/idempotency/UnitOfWork bundle, and runtime code injects those ports into Queue, Scheduler, Executor, Audit, Metrics, and Asset services. Services no longer choose default persistence adapters internally.

Durable Persistence planning is documented under `docs/DURABLE_PERSISTENCE_PLAN.md`. SQLite is implemented as the first local/dev durable adapter for operational persistence only. PostgreSQL readiness is documented under `docs/POSTGRESQL_READINESS_PLAN.md`, Sprint 55 implements the initial PostgreSQL adapter boundary, Sprint 56 adds the concrete `pg` connection/pool layer, and Sprint 57 adds an opt-in real-database operational validation suite. Durable Audit, Metrics, Asset Catalog, and Storage Metadata adapters remain deferred.

SQLite migrations run on adapter startup, record applied versions in `schema_migrations`, and fail clearly if the database contains a newer unsupported schema version. No destructive rollback is performed automatically. Local backups are the operator's responsibility; copy the SQLite file only when no Asteria process is writing to it. SQLite is appropriate for local/dev and single-node proof, but concurrent production workers should wait for the PostgreSQL adapter path.

Retry Foundation provides a reusable retry service for future AI providers, storage providers, publisher adapters, and scheduler work. It records retry attempts, retry count, final reason, and policy metadata without performing real waits in tests. ContentGenerationWorkflow now uses RetryService for recoverable structured output failures while preserving existing metadata. The current dry run also includes mock retry metadata for report visibility.

The CLI loads `.env` automatically for local development. Existing exported shell environment variables take precedence over `.env` values. OpenAI production mode requires `OPENAI_PRODUCTION_ENABLED=true` and `OPENAI_API_KEY`. Gemini production mode requires `GEMINI_PRODUCTION_ENABLED=true` and `GEMINI_API_KEY`. Without the matching flag and key, the dry run fails clearly before any external request is made and names the required variables.

WordPress adapter execution requires `WORDPRESS_ENABLED=true`, `WORDPRESS_SITE_URL`, `WORDPRESS_USERNAME`, and `WORDPRESS_APPLICATION_PASSWORD`. The default dry run does not use the WordPress adapter for scheduled execution; it uses DryRunPublisher. Real WordPress publishing remains disabled.

Coupang affiliate mode requires `COUPANG_ENABLED=true`, `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`, and `COUPANG_PARTNER_ID`. Mock affiliate mode remains the default. Coupang request and response shapes stay inside the adapter, tests use mocked transport, and dry-run output reports provider name, request count, retry count, returned products, and failure reason.

Gemini dry runs request strict JSON output and include a limited repair fallback for common malformed JSON in long generated article bodies. If parsing still fails, the CLI reports the provider, model, parse error, and a truncated response preview without exposing secrets.

When a PublishingPackage exists, dry-run Article and SEO Preview sections use the PublishingPackage as the source of truth. Legacy article and SEO preview steps no longer override or conflict with the package output.

The dry run prints the assembled PublishingPackage, prompt profile, prompt stack, prompt id, prompt version, rendered variables, composed prompt preview, retry count, validation result, validation report, quality score, quality report, review score, review result, review summary, review issues, threshold result, article title, article word and character count, SEO title and description, FAQ count, approval decision, approval reasons, blocking issues, recommendations, generation duration, queue result, queue item ID, queue status, queue destination, scheduler result, scheduled job ID, scheduled job status, scheduler job counts, duplicate and lookup state, schedule retry attempts, execution preview status, due status, execution attempts, execution queue status, publisher adapter, publisher mode, preview URL, target site, publishing enabled flag, publish result, publish ID, metrics summary, Instagram preview, Podcast preview, audit timeline, retry metadata, publishing preview status, monetization provider diagnostics, recommended product names, recommendation reasons, affiliate links, disclosure text, selected image filename, tags, category, score, and mock preview URI.

OpenAI and Gemini are not required for local dry runs or tests. MockAIProvider remains the default. Real publishing remains disabled unless a future composition explicitly sets `ASTERIA_PUBLISHING_ENABLED=true`; the current WordPress path is preview-only.

Install dependencies before running type checking in a fresh environment:

```bash
npm install
```
