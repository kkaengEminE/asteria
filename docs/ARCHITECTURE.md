# Architecture

AI Publishing OS follows clean architecture principles. Domain concepts and application workflows should not depend on concrete providers such as OpenAI, Google Drive, WordPress, Coupang, Instagram, or podcast platforms.

## Layers

### Core

`src/core` contains remaining early-stage contracts that are still active or compatibility-safe, such as research, content generation, image selection, magazine configuration, and workflow re-exports. New provider foundations should live in their current provider or domain boundaries instead of adding duplicate contracts to `src/core`. The legacy core AI provider contract has been retired in favor of `src/providers/ai`.

### Domain

`src/domain` contains magazine, article, media, campaign, and publishing concepts. Domain objects should stay independent from API clients and external SDKs.

`src/domain/content` contains the provider-agnostic Content Domain. It defines canonical article, SEO, FAQ, category, tag, status, metadata, and content generation result models that future AI providers should produce.

The Content Domain now also defines the dry-run publishing package boundary: content request, publishing package, summary, SEO metadata alias, FAQ item alias, image prompt, and product prompt. This package is the provider-neutral output of the content generation pipeline and is not a publishing action.

`src/domain/image` contains the storage-agnostic Image Asset Domain. It defines image assets, metadata, tags, categories, search queries, selection criteria, and scoring helpers that future image storage providers must support.

`src/domain/monetization` contains the provider-agnostic Monetization Domain. It defines products, affiliate links, recommendations, recommendation reasons, product search queries, monetization results, and a mock monetization provider contract for future affiliate adapters.

`src/domain/editorialReview` contains the provider-agnostic Editorial Review Domain. It defines review results, issues, severity, categories, summaries, and review scores used to evaluate publishing readiness without making publishing decisions.

`src/domain/approval` contains the provider-neutral Approval Domain. It defines approval decisions, status, reasons, and structured approval results used to determine readiness without publishing.

`src/domain/magazineProfile` contains the provider-neutral Magazine Profile Domain. It defines the editorial identity and policy inputs for a magazine, including id, name, language, audience, persona, tone, style, SEO policy, image style, affiliate policy, and categories. Profiles are loaded from configuration files and should be used by workflows instead of hardcoded magazine values.

`src/domain/magazineTemplate` contains reusable Magazine Templates. Templates define shared persona, tone, prompt profile, SEO policy, review policy, image policy, and affiliate policy. A Magazine Profile may extend a template, then override specific values without duplicating the full editorial configuration.

`src/domain/storage` contains the provider-neutral Storage Domain. It defines `StorageProvider`, file metadata, file content, folder models, upload requests, download requests, list queries, and folder creation requests. Storage domain types must not know about Google Drive, S3, local file systems, Cloudinary, publishing workflows, or image selection rules.

`src/domain/asset` contains the provider-neutral Asset Domain. It defines assets, filenames, MIME types, size, category, tags, metadata, and storage references. Asset models may reference where bytes live, but they do not know how a concrete storage provider retrieves those bytes.

`src/domain/publishingQueue` contains the provider-neutral Publishing Queue Domain. It defines queue items, queue status, queue results, failures, and generic publishing destinations. Queue models do not know about WordPress, publisher adapters, scheduling providers, or network execution.

`src/domain/publisher` contains the provider-neutral Publisher Domain. It defines publish requests, results, statuses, failures, and the publisher interface used between scheduled execution and concrete publisher adapters. Publisher domain models do not know about WordPress, Instagram, Ghost, Medium, network clients, or persistence.

`src/domain/scheduler` contains the provider-neutral Scheduler and Scheduled Job Execution Domain. It defines scheduled jobs, schedule policies, schedule results, schedule status, scheduled job executions, execution status, execution results, and execution failures. Scheduler and execution models do not know about GitHub Actions, cron services, WordPress, publisher adapters, persistence, or network execution.

`src/domain/audit` contains the provider-neutral Audit Domain. It defines audit events, event types, actors, and context metadata for recording workflow and queue activity. Audit models do not know about persistence providers, external logging systems, schedulers, publishers, or vendor adapters.

`src/domain/retry` contains the provider-neutral Retry Domain. It defines retry policies, attempts, results, and reasons for recoverable operations. Retry models do not know about AI providers, storage providers, publisher adapters, schedulers, or network clients.

`src/domain/metrics` contains the provider-neutral Metrics Domain. It defines metric events, metric types, counters, and snapshots for observing pipeline activity. Metrics models do not know about persistence, external analytics vendors, provider SDKs, workflows, or publishing destinations.

`src/domain/instagram` contains the provider-neutral Instagram Content Domain. It defines Instagram posts, captions, hashtag sets, and content packages for dry-run social previews. These models do not know about Instagram APIs, OAuth, posting, publisher adapters, network clients, or persistence.

`src/domain/podcast` contains the provider-neutral Podcast / TTS Domain. It defines podcast episodes, scripts, TTS requests, TTS segments, and podcast content packages for dry-run audio previews. These models do not know about TTS vendors, podcast hosts, RSS publishing, media upload, network clients, or persistence.

`src/domain/preview` contains provider-neutral preview aggregation primitives. It defines preview section types and typed channel preview entries used by dry-run reporting. Preview domain models must not import runtime composition, workflows, providers, or CLI scripts.

### Providers

`src/providers` is reserved for replaceable infrastructure adapters. Future examples include WordPress publishers, Google Drive image libraries, Coupang affiliate providers, and AI model providers.

The Provider Registry lives in `src/providers` and owns provider registration, lookup, removal, and lifecycle factory boundaries. Workflows and the Workflow Engine must not instantiate concrete providers directly.

`src/providers/ai` contains the provider-agnostic AI Provider Foundation. It defines AI request, response, message, model, usage, and error contracts, plus a deterministic mock provider for dry runs and tests. It does not call real AI APIs.

`src/providers/ai/openai` contains the optional OpenAI adapter. It implements the shared AI provider contract, reads configuration only from environment variables or explicit constructor inputs, and uses a transport abstraction so tests can mock all API behavior. It is not the default dry-run provider.

In explicit OpenAI mode, the adapter consumes rendered Prompt Asset System output and requests a complete publishing package. It maps OpenAI-shaped responses, fenced JSON, surrounding text, and common field aliases into provider-neutral Content Domain models before workflow quality and editorial review metadata are attached.

`src/providers/ai/gemini` contains the optional Gemini adapter. It implements the shared AI provider contract, reads Gemini configuration from environment variables or explicit constructor inputs, and uses a transport abstraction so tests can mock all API behavior. It is not the default dry-run provider.

In explicit Gemini mode, the adapter consumes rendered Prompt Asset System output and requests a complete publishing package. Gemini-specific request bodies, response candidates, usage metadata, finish reasons, errors, and API paths remain inside the adapter before output is mapped into provider-neutral Content Domain models.

Gemini publishing-package requests use strict JSON instructions and Gemini JSON response MIME hints. The adapter attempts safe repair for common malformed JSON issues such as raw newlines inside strings, unescaped quotes inside strings, and unterminated trailing strings before surfacing a parse error with a truncated response preview.

`src/providers/publisher/wordpress` contains the WordPress publisher adapter. It implements the provider-neutral Publisher interface, maps publish requests into WordPress post payloads, reads guarded configuration from environment-compatible inputs, uses an injectable transport, integrates RetryService and AuditLog, and returns preview results while publishing remains disabled. Tests use mocked transport only.

Provider adapters must not depend on legacy `src/core` contracts. WordPress maps from `PublishRequest` to WordPress-specific payloads inside the adapter, and AI providers use the `src/providers/ai` contract.

`src/providers/image/googleDrive` contains the Google Drive image library adapter draft. It uses local mock metadata only, maps Google Drive-shaped records into the storage-agnostic Image Asset Domain, and does not call Google APIs.

`src/providers/monetization/coupang` contains the production-capable Coupang affiliate adapter. Mock records remain available and are the default dry-run path. Explicit Coupang mode requires `COUPANG_ENABLED=true` plus credentials, uses an injectable transport, maps Coupang-shaped records into the provider-agnostic Monetization Domain, integrates RetryService and AuditLog, and keeps Coupang request and response details inside the adapter.

`src/providers/storage/local` contains the LocalStorageProvider. It implements the shared StorageProvider boundary for tests and local development-only file behavior. It supports upload, download, list, create folder, and metadata lookup against an explicit root directory while preventing paths from escaping that root. It is not a production storage adapter.

`src/providers/storage/googleDrive` contains the Google Drive StorageProvider adapter. It implements the shared storage boundary with upload, download, list, folder creation, and metadata lookup. Google Drive-specific request shapes, response records, file IDs, folder IDs, app properties, and transport behavior stay inside the adapter. The provider is disabled by default and requires `GOOGLE_DRIVE_ENABLED=true`, `GOOGLE_DRIVE_CREDENTIALS`, and `GOOGLE_DRIVE_ROOT_FOLDER` before transport calls are allowed.

`src/providers/persistence/sqlite` contains the SQLite operational persistence adapter. SQLite-specific connection handling, migrations, SQL statements, schema records, row mapping, error mapping, idempotency records, and lock records stay inside this adapter. It implements Queue, Scheduler, Job Execution, Idempotency, and Lock ports only. It does not persist Audit, Metrics, Asset Catalog, or Storage Metadata.

### Services

`src/services` is reserved for application services that combine core interfaces into useful operations, such as content planning, editorial validation, prompt rendering, and asset preparation.

`src/services/dryRun` contains the shared dry-run workflow foundation. It owns reusable dry-run result shaping, workflow construction, workflow execution helpers, and dry-run step helpers used by the magazine runtime.

Dry-run reporting now uses a `DryRunPreviewReport` aggregation model. Existing article, SEO, image, monetization, Instagram, Podcast, publishing, metrics, audit, and retry outputs remain available, but future channel previews should be added to typed preview sections instead of expanding `DryRunResult` with one top-level field per channel.

`src/services/structuredOutput` contains the provider-neutral structured output layer. It validates, normalizes, and parses `PublishingPackage` output after provider generation and before workflow results are exposed.

`src/services/contentQuality` contains provider-neutral content quality validation. It checks generated publishing packages for completeness, empty sections, duplicate FAQ entries, summary length, article length, and SEO readiness, then records a simple 0-100 quality score for review.

`src/services/editorialReview` contains provider-neutral editorial readiness review. It evaluates generated publishing packages for completeness, readability, SEO coverage, duplicate FAQ entries, metadata, title quality, and summary quality, then records a separate 0-100 review score with structured issues.

`src/services/realGenerationReview` contains review-only calibration for real AI-generated publishing packages. It compares quality score, editorial review score, article length, SEO completeness, article structure, FAQ usefulness, and summary usefulness against configurable thresholds. It records threshold results for review, but it does not block or trigger publishing.

`src/services/editorialApproval` contains the Editorial Approval Gate. It evaluates validation, quality, editorial review, and threshold metadata to return `APPROVED`, `NEEDS_REVIEW`, or `REJECTED`. It records decisions and reasons only; it does not publish or call publishers.

`src/services/publishing` contains the provider-neutral publishing workflow. It converts approved `PublishingPackage` values into `PublishRequest`, enforces approval before publisher access, keeps real publishing disabled by default, and delegates execution to `PublisherService` for dry-run previews without network calls.

The older core `PublishingPayload`, `PublishingResult`, and `Publisher` contracts are retired from active publishing paths. Queue, scheduler, executor, WordPress, and dry-run publisher paths use the current `src/domain/publisher` contracts.

`src/services/publisher` contains PublisherService and DryRunPublisher. PublisherService validates provider-neutral publish requests, dispatches to a configured publisher, normalizes publish results, uses RetryService for retryable publisher failures, and records provider-neutral publish audit events. DryRunPublisher generates deterministic preview IDs and preview URLs without network calls.

`src/services/assetLibrary` contains the Asset Library service. It uses `StorageProvider` internally for file upload, download, and metadata lookup while exposing asset-level operations to callers through `AssetCatalogRepository` and optional `StorageMetadataRepository` composition. This keeps storage providers invisible to image selection and future editorial workflows.

`src/services/publishingQueue` contains the Publishing Queue service. It depends on `PublishingQueueRepository`, uses an in-memory repository adapter in current runtime composition, and exposes enqueue, lookup, list, guarded status update, cancellation, and failure recording. Durable persistence is replaceable behind the repository boundary.

`src/services/scheduler` contains the Scheduler service and Scheduled Job Executor. Scheduler depends on `SchedulerRepository`, uses runtime-composed persistence ports, and exposes schedule, reschedule, retry scheduling, cancel, list, get, and completed-job preview operations for approved queue items. It rejects invalid schedule policies, prevents duplicate active schedules, keeps completed jobs immutable, records audit events and metrics, and does not call external schedulers. SchedulerService uses injected `UnitOfWork` so the queue `SCHEDULED` transition and scheduled job creation share one transaction boundary. The executor depends on `JobExecutionRepository`, uses `IdempotencyStore` and `LockManager` for duplicate execution prevention, checks due scheduled jobs, skips invalid jobs, moves valid queue items to `PROCESSING`, and can execute scheduled publishing previews through PublisherService. ScheduledJobExecutor uses injected `UnitOfWork` for execution start, completion, idempotency finalization, and lock release. It records preview results and never calls concrete publisher adapters directly.

`src/services/auditLog` contains the Audit Log service. It composes with `AuditStore`, uses an in-memory store in current runtime composition, and exposes event append, event listing, entity filtering, and event type filtering. External log sinks are future adapters behind the audit storage boundary.

`src/services/retry` contains the Retry Service. It executes provider-neutral operations with configurable max attempts, simulated fixed delay metadata, retryable versus non-retryable classification, and retry history. It does not sleep in tests, call external services, or know which provider category is using it.

`src/services/metrics` contains the Metrics Service. It records counters, durations, and failures through `MetricsStore`, uses an in-memory store in current runtime composition, and produces snapshots for dry-run reporting. Metrics are observational only: they do not alter workflow decisions, queue transitions, scheduler behavior, publisher dispatch, retries, or provider calls.

`src/services/instagram` contains the Instagram Content Service. It derives dry-run social preview content from a provider-neutral `PublishingPackage`, `MagazineProfile`, SEO keywords, and selected image metadata. It does not post content, call Instagram APIs, perform OAuth, or publish.

`src/services/podcast` contains the Podcast Content Service. It derives dry-run audio preview content from a provider-neutral `PublishingPackage`, `MagazineProfile`, and optional Instagram preview. It produces script, chapters, estimated duration, and TTS text segments without synthesizing audio or publishing podcasts.

### Workflows

`src/workflows` is reserved for workflow definitions and orchestration code. Workflows should coordinate steps and persist state, but not embed provider-specific details.

The Workflow Engine is the central orchestration layer for Asteria. It executes small `WorkflowStep` units sequentially, passes a shared `WorkflowContext`, stops on failure, and returns a structured `WorkflowResult`.

`ContentGenerationWorkflow` is an application workflow that receives a topic-level content request, calls an `AIProvider`, validates the returned publishing package, and returns a provider-neutral Content Domain model. It does not publish, select destinations, or call WordPress.

The workflow applies configurable retry policy through `RetryService` for recoverable AI output failures such as empty responses, malformed JSON, and missing required sections. Retry and validation metadata are attached to the returned package for dry-run inspection.

The workflow resolves generation prompts through `PromptAssetRegistry`, composes profile-based prompt stacks, renders variables such as topic, language, audience, tone, and magazine name, and passes rendered prompt metadata through the provider-neutral request.

Magazine profile values are the source for prompt composition. The composition boundary loads a `MagazineProfile`, passes its audience, tone, language, style, and name into the content request, and stores profile policy metadata for downstream review without exposing provider-specific details.

Template inheritance is resolved before workflows receive a profile. Workflows consume only the merged Magazine Profile, so they do not need to understand template files or override rules.

The workflow applies content quality validation after structured output parsing. Quality rules remain provider-neutral and attach review metadata to the returned publishing package; they do not publish content or alter provider boundaries.

The workflow applies editorial review after quality validation. Review metadata is attached to the returned publishing package for dry-run inspection only; the workflow does not approve, reject, or publish content.

The workflow also attaches real generation review metadata. This is a calibration layer for OpenAI-generated content and mock dry runs alike; it describes threshold readiness without becoming a publication gate.

The workflow attaches editorial approval metadata after review metadata is available. Approval decisions describe readiness for future publishing but do not trigger any publishing action.

Provider-neutral publishing is a separate workflow boundary after approval. In dry-run queue mode, approved packages become queue items and non-approved packages return queue rejection results. Publisher adapters are not invoked by the queue preview path.

Scheduling is another boundary after queue approval. The current dry-run scheduler preview can schedule an approved queue item by updating its status to `SCHEDULED`, then expose operational state such as scheduled job count, active job count, duplicate detection, lookup status, and retry attempts. It does not execute jobs, trigger publishers, call external services, or persist schedules.

Scheduled job execution is a separate boundary after scheduling. The executor owns execution orchestration only: it verifies that a scheduled job exists, the job is due, the job is not cancelled, and the queue item remains `SCHEDULED`. It may transition the queue item to `PROCESSING` for a preview execution, but successful previews do not transition to `PUBLISHED`.

Content generation and approval events may be recorded into the Audit Log when an audit service is injected. Audit logging is observational only: it does not change workflow decisions, provider behavior, approval decisions, or publishing safeguards.

Retry behavior can be composed into workflows or provider adapters through `RetryService` without changing domain models. ContentGenerationWorkflow uses RetryService for structured output recovery, and dry-run composition also uses a mock retry probe to expose retry metadata in reports.

Metrics behavior can be composed into workflows and services through `MetricsService` without changing domain models. ContentGenerationWorkflow, PublishingQueue, SchedulerService, ScheduledJobExecutor, and PublisherService record provider-neutral counters, durations, and failures when a metrics service is injected.

Instagram preview generation is composed into the magazine dry-run runtime after content generation and image selection. It produces caption, hashtag, alt-text, and image reference metadata for review only; it is not a publishing or social-posting workflow.

Podcast preview generation is composed into the magazine dry-run runtime after Instagram preview generation. It produces spoken intro, spoken outro, narration, chapters, duration estimates, and TTS segments for review only; it is not a TTS provider integration or podcast publishing workflow.

Future provider-backed features such as AI generation, research, WordPress publishing, Instagram generation, TTS, podcast publishing, and analytics should plug into workflows through steps that depend on provider interfaces. The engine should never know which concrete provider is being used.

### Magazines

`src/magazines` is reserved for magazine-specific modules when configuration alone is not enough.

`src/magazines/runtime` contains the shared magazine dry-run runtime. It loads magazine config and profile data, resolves mock providers through Provider Registry, assembles workflow steps, and delegates generic result shaping to `src/services/dryRun`.

Dry-run runtime steps are grouped by concern under `src/magazines/runtime/steps`: content, media, channel previews, monetization, and publishing. The public runtime entry point remains stable.

`src/magazines/cat` and `src/magazines/dog` are thin magazine modules. Cat keeps backward-compatible `runCatMagazineDryRun` exports, while Dog exposes `runDogMagazineDryRun`; both delegate to `runMagazineDryRun`.

The shared magazine dry run includes image selection and monetization preview. It registers mock Google Drive image providers by default and resolves monetization through Provider Registry. Mock affiliate mode remains the default, while explicit Coupang mode can resolve the production-capable adapter only after environment safeguards pass. Workflow steps receive provider-agnostic image and monetization interfaces.

Cat Magazine and Dog Magazine are the first `MagazineProfile` examples under `magazines/cat/profile.example.json` and `magazines/dog/profile.example.json`. Both extend the shared `blog` template under `magazines/templates/blog.example.json`, and editorial prompt inputs come from the merged profile/template system.

### Prompts

`src/prompts` is reserved for reusable prompt sets, templates, and prompt metadata.

Prompts are first-class assets. Prompt text should live under the root-level `prompts` directory, while prompt loading, registration, lookup, validation, and rendering logic should live under `src/prompts`.

Prompt inheritance is supported through registration order. Shared prompts load first from `prompts/shared`, then magazine-specific prompts load from `prompts/magazines/{slug}` and override matching prompt keys.

Versioned prompt assets live under `prompts/assets`. The `PromptAssetRegistry` registers prompt assets, resolves explicit versions, resolves the latest version, renders template variables, and exposes prompt metadata. Workflows request prompt assets by id and version instead of embedding prompt text.

Prompt composition is profile-based. A profile such as `default`, `blog`, or `magazine` resolves a stack of prompt assets including system, persona, style, task, and output schema prompts. The composed prompt is sent to AI providers as rendered text, while prompt ids, versions, variables, and previews remain visible in dry-run metadata.

### Config

`src/config` is reserved for configuration loading, validation, and environment-safe defaults.

The CLI loads `.env` through the config layer before dry-run execution. Exported shell environment variables take precedence over file values so local defaults cannot override intentional runtime configuration.

### Utils

`src/utils` is reserved for small shared utilities that are not domain-specific.

## Dependency Rule

Outer layers may depend on inner layers. Inner layers should not depend on outer layers.

Recommended direction:

`providers -> services -> workflows -> core/domain`

Concrete providers should implement core interfaces. Workflows should depend on interfaces, not concrete classes.

## Provider Replacement

Every external integration should be hidden behind an interface. This allows:

- Local test doubles.
- Vendor replacement.
- Magazine-specific provider choices.
- Safe dry-run workflows.
- Human review before publication.

Provider adapters should be composed into workflow steps by services or workflow factories. This keeps provider setup outside the engine and lets tests use mock steps or in-memory providers.

Provider resolution should happen through the Provider Registry. Application composition code may resolve provider interfaces and pass them into workflow steps. The registry should not be used as a hidden global dependency inside domain objects or low-level utilities.

Provider categories include:

- AI
- Research
- Publisher
- Image
- Affiliate
- Storage
- TTS
- Podcast
- Analytics

## Publisher Boundary

Publishers implement the provider-neutral `Publisher` interface and receive `PublishRequest` values. Provider-specific payload mapping, validation, credentials, transport behavior, and response mapping belong inside provider adapters. Workflow steps should depend on PublisherService or the provider-neutral Publisher interface, not WordPress-specific classes.

Legacy WordPress preview payload/result contracts are retired from the adapter path. WordPress receives provider-neutral `PublishRequest` input and returns provider-neutral `PublishResult` output.

The current WordPress adapter is production-capable in shape but does not enable production publishing. It requires `WORDPRESS_ENABLED=true`, a target site, username, and application password before adapter execution. Transport is injectable; tests use mocked transport and no default network transport is configured.

Publishing workflow safeguards live outside provider adapters. Real publishing is disabled by default, requires explicit configuration such as `ASTERIA_PUBLISHING_ENABLED=true`, and still requires approval metadata before a payload can be sent to a publisher. Dry-run publishing previews may use preview-only adapters, but they must not bypass approval checks.

PublisherService is the execution boundary between ScheduledJobExecutor and concrete publisher adapters. When publishing is disabled, only DryRunPublisher may execute preview mode. Non-dry-run publishers are skipped before dispatch. PublisherService owns request validation, result normalization, retry integration, and provider-neutral publish audit events.

## Publishing Queue Boundary

The Publishing Queue manages approved `PublishingPackage` values before future publishing execution. It records queue status, destination, approval decision, and failure information without calling publisher adapters.

Only packages with `APPROVED` approval may enter the ready-to-publish queue path. Packages with `NEEDS_REVIEW`, `REJECTED`, or missing approval metadata return a queue rejection result.

Queue status transitions are explicitly guarded:

- `PENDING` may move to `APPROVED`, `CANCELLED`, or `FAILED`.
- `APPROVED` may move to `SCHEDULED`, `PROCESSING`, `CANCELLED`, or `FAILED`.
- `SCHEDULED` may move to `PROCESSING`, `CANCELLED`, or `FAILED`.
- `PROCESSING` may move to `PUBLISHED` or `FAILED`.
- `FAILED` may move to `CANCELLED`, or to `PENDING` only with an explicit retry transition.
- `PUBLISHED` and `CANCELLED` are terminal.

The current queue storage is in-memory. Future persistence should implement the queue storage boundary without changing workflow or queue domain models.

## Scheduler Boundary

The Scheduler manages provider-neutral scheduled jobs for queue items that have already passed editorial approval and entered the Publishing Queue.

Scheduler may interact with Publishing Queue status, but it must not publish content, invoke publisher adapters, call WordPress, run background workers, or depend on a concrete scheduling platform.

Scheduler operations are provider-neutral. The service supports listing, lookup by id, reschedule, cancel, retry scheduling through RetryService, invalid schedule rejection, duplicate active job detection, and immutable completed jobs. Completed scheduler jobs are operationally terminal and cannot be rescheduled or cancelled.

The Scheduled Job Executor processes due scheduled jobs through either a supplied provider-neutral operation or a provider-neutral publish request executed by PublisherService. It must not import concrete publisher adapters, must not know about WordPress network execution, and must not publish content. Retry behavior is composed through RetryService and remains simulated/no-wait for the current foundation.

Scheduler and executor persistence is selected by runtime composition. In-memory remains the default, while explicit SQLite mode uses the same provider-neutral repository, idempotency, lock, and UnitOfWork ports. Future platform execution should sit behind scheduler/executor boundaries without changing scheduler domain models.

## Audit Log Boundary

The Audit Log records important workflow events such as content generation, quality evaluation, editorial review completion, approval decisions, queue creation, queue rejection, queue cancellation, queue failure, job scheduling, job cancellation, job execution start, job execution success, job execution failure, and job execution skip.

Audit events use provider-neutral actors, context, entity identifiers, event types, messages, timestamps, and metadata. They must not contain secrets or provider SDK response objects.

The current audit storage is in-memory and intended for dry-run visibility and tests. Future persistence or external logging should implement an AuditStore-style storage port without changing workflow, queue, or audit domain models. AuditLog remains the application-facing service; persistence should sit behind the storage port rather than inside workflows.

## Retry Boundary

The Retry Service is a provider-neutral execution helper for recoverable operations. It supports max-attempt policy, fixed delay metadata, retryable and non-retryable reasons, and attempt history.

Retry delays are simulated as metadata for the current foundation. Tests do not wait, and no scheduler or background worker is introduced.

AI providers, storage providers, publisher adapters, and future scheduler operations may opt into the Retry Service through composition. ContentGenerationWorkflow already uses it for provider-neutral structured output recovery. Domain models and workflow engines should not embed provider-specific retry rules.

## Metrics Boundary

The Metrics Service observes pipeline activity using provider-neutral names such as content generation started/succeeded/failed, queue enqueued/rejected, scheduler scheduled/cancelled, job execution started/succeeded/failed/skipped, and publisher started/succeeded/failed/skipped.

Metrics are in-memory for the current foundation. Future persistence, dashboards, or analytics sinks should sit behind a metrics storage/export boundary without changing domain models, workflow decisions, or provider adapters.

Metrics must not contain secrets or provider SDK response objects. They are summary signals for operation health, while Audit Log remains the detailed event timeline.

## Persistence Boundary

Persistence is implemented through provider-neutral ports plus in-memory adapters for default runtime services. SQLite operational persistence is available only as an explicit local/dev adapter. The authoritative architecture document is `docs/PERSISTENCE_ARCHITECTURE.md`; the durable adapter plan is `docs/DURABLE_PERSISTENCE_PLAN.md`.

Persistence enters Asteria through repository ports and future adapters, not through domain models, provider SDK records, workflow internals, or direct database access from runtime steps.

Implemented port boundaries include:

- Publishing Queue repository
- Scheduler repository
- Job Execution repository
- Audit Store
- Metrics Store
- Asset Catalog repository
- Storage Metadata repository
- Idempotency Store
- Lock Manager
- UnitOfWork transaction boundary

These ports live under `src/services/persistence`. Application services own transaction boundaries. Durable adapters should implement repository ports. Current runtime composition chooses in-memory adapters for dry runs and future durable adapters remain deferred.

Sprint 51 migrates PublishingQueue, SchedulerService, ScheduledJobExecutor records, AuditLog, MetricsService, AssetLibrary metadata, and storage metadata onto these ports. Legacy storage options remain as compatibility wrappers where safe, but runtime code should pass repository/store ports explicitly.

Architecture Cleanup Patch 006 adds `PersistenceCompositionFactory` so runtime composition owns repositories, stores, idempotency, locking, and UnitOfWork selection. Operational service constructors no longer create default persistence adapters internally. Durable adapters remain deferred, but future runtime composition can swap the persistence bundle without changing queue, scheduler, executor, audit, metrics, or asset services.

Sprint 52 selected SQLite as the first local/dev durable adapter path and PostgreSQL as the production adapter target. Sprint 53 implements the SQLite operational adapter only. In-memory remains the default; SQLite is selected only when `ASTERIA_PERSISTENCE_MODE=sqlite` and `ASTERIA_SQLITE_DATABASE_PATH` are provided.

SQLite migrations run on adapter startup, store applied versions in `schema_migrations`, and fail on unsupported future schema versions. Rollback is not automatic or destructive. SQLite is local/dev and single-node oriented; PostgreSQL remains the production target for concurrent workers and stronger operational locking.

Architecture Cleanup Patch 007 defines concrete transaction ownership for scheduler/executor paths: schedule creation wraps queue `SCHEDULED` transition plus scheduled job creation, and scheduled execution wraps start, queue `PROCESSING` transition, completion, idempotency finalization, and lock release where those operations materially span multiple ports.

Locking should combine optimistic concurrency for entity transitions with short-lived execution locks. SQLite repository updates use atomic `UPDATE ... WHERE id = ? AND revision = ?` statements and map stale writes to provider-neutral revision conflicts. Idempotency should be scoped by operation type and entity, especially for queue enqueue, schedule creation, job execution, publisher dispatch, asset registration, and audit append.

Migration implementation is deferred to a later sprint. Future migrations should be explicit, versioned, additive where possible, and owned by persistence adapters and release operations. No migration may enable publishing automatically.

## AI Provider Boundary

AI providers receive rendered prompts or provider-neutral content requests only. They must not know about workflow orchestration, prompt files, publishers, image libraries, monetization providers, magazine config loading, or publishing destinations.

The AI Provider Foundation defines shared request and response models for future OpenAI, Claude, Gemini, OpenRouter, and local LLM adapters. Provider adapters should report usage and structured errors through the shared AI contracts before workflow steps consume generation results.

The current Mock AI provider is deterministic and dry-run only. It returns predictable content, usage metadata, token counts, stream-compatible output, and health check results without network calls.

The OpenAI adapter is the first real AI provider boundary. OpenAI-specific request mapping, response mapping, error mapping, transport behavior, environment configuration, production enablement checks, and response normalization stay inside the adapter. Production calls are disabled unless the adapter is explicitly configured with an API key and `OPENAI_PRODUCTION_ENABLED=true`. Dry-run composition continues to resolve the deterministic Mock AI provider by default.

The Gemini adapter follows the same boundary. Gemini-specific request mapping, response mapping, error mapping, transport behavior, environment configuration, production enablement checks, and response normalization stay inside the adapter. Production calls are disabled unless the adapter is explicitly configured with an API key and `GEMINI_PRODUCTION_ENABLED=true`.

Gemini JSON repair is intentionally limited to common syntax damage in provider output. It does not change provider-neutral domain models and does not hide validation failures after parsing.

For the content generation pipeline, AI providers may also receive a provider-neutral `ContentRequest` and return a provider-neutral `PublishingPackage`. Provider-specific serialization, JSON prompting, parsing, response cleanup, alias mapping, and error mapping remain inside the provider adapter.

Production AI mode is opt-in at the composition boundary. Magazine dry-run defaults to `MockAIProvider`; OpenAI is used only when dry-run composition is explicitly configured with `aiMode: openai` or the CLI receives `--ai openai`, and Gemini is used only with `aiMode: gemini` or `--ai gemini`. OpenAI still requires `OPENAI_PRODUCTION_ENABLED=true` and `OPENAI_API_KEY`; Gemini requires `GEMINI_PRODUCTION_ENABLED=true` and `GEMINI_API_KEY` before transport calls are allowed.

The CLI may pass a language option such as `--language ko-KR`. That value flows into the Content Request, Prompt Asset System variables, prompt composition metadata, AI provider request, article language, and PublishingPackage metadata.

## Content Domain Boundary

The Content Domain does not know about OpenAI, Claude, Gemini, WordPress, workflows, prompt files, or provider adapters. It defines the canonical shape of generated content after provider output is parsed or normalized.

Future AI-backed generation should produce or be transformed into `ContentGenerationResult`, which can include an article, SEO metadata, FAQ entries, and provider-agnostic metadata. Publishing adapters should receive content after it has passed domain validation rather than relying on provider-specific output strings.

The current pipeline validates `PublishingPackage` before exposing it to dry-run output. Required sections are article, summary, SEO metadata, at least one FAQ item, image prompt, and product prompt.

Structured output validation returns descriptive errors for missing or empty required fields. Normalization trims whitespace, collapses repeated whitespace, removes duplicate FAQ items, extracts fenced JSON when possible, and fills safe optional defaults through existing Content Domain creation helpers.

## Image Domain Boundary

The Image Asset Domain does not know about Google Drive, S3, local files, Cloudinary, or any other storage provider. Storage providers must adapt their own metadata into the domain image model before workflows or services search, score, or select images.

Image selection should be based on domain-level metadata such as topic, mood, tags, category, orientation, aspect ratio, rating, favorite status, source reference, and checksum. Provider-specific IDs may be stored only as source metadata, not as workflow assumptions.

The current Google Drive image library adapter is a mock-first draft. Drive file IDs and mock URIs stay inside adapter records or domain source metadata. OAuth, Google SDK usage, real Drive access, and network calls are deferred.

Image selection now receives image-domain assets projected from Asset Library. The Google Drive image library keeps Drive-shaped mock records inside its adapter, registers them through Asset Library, and exposes only `ImageAsset` values to workflow steps.

## Storage Provider Boundary

Storage providers expose file operations through `StorageProvider`. Application composition may resolve a storage provider from Provider Registry and pass it into services that need file storage. Domain models and workflows should not instantiate concrete storage providers directly.

The current LocalStorageProvider is for tests and development foundation work only. The Google Drive StorageProvider is the first cloud storage adapter behind the boundary, but its tests use mocked transport and no SDK models leave the adapter. Future S3 or other cloud storage adapters should follow the same rule: map provider-specific identifiers and metadata inside their adapter before returning provider-neutral storage models.

## Asset Library Boundary

Asset Library is the layer above storage. Callers register and retrieve `Asset` values without seeing `StorageProvider`. Storage-specific paths, provider names, and external IDs remain in `storageReference` metadata.

Future asset-backed features should depend on Asset Library, not directly on Google Drive, S3, or LocalStorageProvider. Image workflows may convert assets into image-domain projections, but the Image Domain should remain independent from storage providers.

## Monetization Domain Boundary

The Monetization Domain does not know about Coupang, Amazon, Temu, or any affiliate implementation. Affiliate providers must adapt their own product catalogs and link generation into the domain product, recommendation, affiliate link, and monetization result models.

Monetization workflows should operate on provider-agnostic product metadata such as name, category, tags, brand, price, currency, rating, thumbnail, URL, and provider name. Provider-specific APIs, credentials, tracking parameters, transport behavior, and commission rules belong inside adapters.

The current Coupang affiliate adapter is production-capable but disabled by default. It can use local mock records or an injected transport for real Coupang mode, guarded by `COUPANG_ENABLED=true` and required credentials. Coupang-shaped product IDs and records stay inside the adapter or product metadata. Production monetized publishing remains deferred because publishing is still disabled.

## Workflow Failure Boundary

Workflow steps are the failure boundary. A step may fail without crashing the process. The engine records the failed step, returns a failed result, and leaves rollback or recovery policy to future workflow-specific layers.

## Prompt Boundary

AI providers should receive rendered prompt text from the Prompt Management System. Providers should not embed magazine-specific prompt strings, prompt inheritance rules, or template variable replacement logic.

Prompt version metadata starts at `v1` and is passed through content generation metadata. Future prompt revisions should change prompt assets or composition metadata without forcing workflow rewrites.

Prompt asset metadata includes prompt id, version, source, description, and required variables. Dry-run output displays prompt id, version, rendered variables, and a truncated rendered prompt preview for review.

When OpenAI is used, rendered prompt asset text is passed through provider-neutral request metadata into the OpenAI adapter. The adapter uses that rendered prompt text while keeping OpenAI-specific JSON shape instructions inside the adapter.

Prompt profiles let future magazines choose a composition style without changing workflow logic. The current profiles are `default`, `blog`, and `magazine`.

## Content Quality Boundary

Content quality validation runs after structured output parsing and before dry-run reporting. It is intentionally separate from AI providers, prompt assets, publishers, image providers, and monetization providers.

Quality scoring is simple and review-oriented. The score starts at 100 and is reduced by provider-neutral validation errors and warnings. It should guide editorial review, not act as an automatic publishing gate.

## Editorial Review Boundary

Editorial review runs after content quality validation and before dry-run reporting. It is provider-neutral and evaluates whether a generated `PublishingPackage` looks ready for human editorial review.

Review score is separate from quality score. Quality score describes structural completeness; review score describes editorial readiness. The current review result can be `PASS`, `WARNING`, or `FAIL`, and each issue includes category, severity, message, and recommendation.

Editorial review metadata must not trigger publishing decisions yet. Future approval gates can consume the review output, but this sprint only records and displays it.

## Real Generation Review Boundary

Real generation review runs after quality and editorial review metadata exist. It compares generated content against configurable review thresholds such as minimum quality score, minimum review score, minimum article length, and required SEO fields.

The threshold result can be `PASS`, `WARNING`, or `FAIL`, but it is informational only. Since publishing does not exist yet, this layer must not block, approve, publish, or mutate provider behavior.

Article structure detection recognizes blank-line paragraphs, Markdown headings, bullet lists, and numbered lists so real AI Markdown output is reviewed by structure rather than raw blank-line count alone.

## Editorial Approval Boundary

Editorial approval runs after validation, quality scoring, editorial review, and real generation review. It returns one of `APPROVED`, `NEEDS_REVIEW`, or `REJECTED`.

Approval results include reasons, recommendations, blocking issues, and non-blocking issues. They are metadata only. The approval gate must not instantiate publishers, call WordPress, or publish content.

The publishing workflow consumes approval metadata after it has been attached. This keeps approval evaluation separate from publishing execution while ensuring non-approved packages are skipped before provider adapters are called.

## Dry-Run Composition Boundary

Dry-run workflows should be composed at the application or magazine boundary. Composition code may load config, load prompts, register mock providers, resolve provider interfaces, construct workflow steps, and execute the Workflow Engine through shared dry-run workflow services.

This keeps the Workflow Engine provider-agnostic while still allowing end-to-end architecture verification.

Shared dry-run code should only contain concepts already proven by a magazine dry run. Magazine-specific provider tokens, mock provider behavior, config choices, prompt keys, and content assumptions should remain in the magazine module.

Image preview fields in dry-run results should expose domain-level image information such as filename, tags, category, score, and preview URI. Provider-specific identifiers such as Google Drive file IDs must remain inside adapter records or source metadata.

Monetization preview fields in dry-run results should expose domain-level product recommendations, generic affiliate links, preview text, and disclosure text. Provider-specific identifiers such as Coupang product IDs must remain inside adapter records or product metadata.

When a `PublishingPackage` is present, dry-run report rendering treats it as the source of truth for generated article and SEO preview sections. Legacy preview fields may still exist for workflow compatibility, but they should not override package content in user-facing output.
