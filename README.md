# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 52 plans the first durable persistence adapter path without implementing persistence. The selected path is SQLite for local/dev adapter proof and PostgreSQL as the production target. The first future implementation scope is operational persistence for Queue, Scheduler, Job Execution, Idempotency, and Locks. No database, ORM, filesystem persistence, runtime behavior change, external API call, or publishing enablement is introduced.

## Commands

```bash
npm run dry-run
npm test
npm run typecheck
```

Run the dry run with a custom topic:

```bash
npm run dry-run -- "indoor enrichment"
```

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

Scheduler Operations sit after Publishing Queue. SchedulerService composes through `SchedulerRepository` with an in-memory runtime adapter and can create, list, get, reschedule, retry scheduling, cancel, and mark jobs completed for operational preview. It prevents duplicate active jobs, rejects invalid schedules, keeps completed jobs immutable, emits scheduler audit events, records scheduler metrics, and displays operational state in dry-run output. It does not run cron, call external schedulers, publish content, or introduce durable persistence.

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

Durable Persistence planning is documented under `docs/DURABLE_PERSISTENCE_PLAN.md`. The plan recommends SQLite as the first local/dev durable adapter and PostgreSQL as the production adapter target, with operational persistence migrating before Audit, Metrics, and Asset Catalog durability.

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
