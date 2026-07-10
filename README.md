# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 41 introduces Scheduled Job Execution Foundation. A provider-neutral executor can inspect due scheduled jobs, run a supplied dry-run operation with RetryService, record preview execution results, and emit execution audit events. It does not publish content or call publisher adapters.

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

Magazine profiles may extend reusable templates. The current Cat and Dog profiles extend `magazines/templates/blog.example.json`, inheriting shared review, SEO, image, and affiliate defaults while overriding magazine-specific prompt profile, tone, persona, and categories. The CLI runs both through the shared magazine runtime.

Run the Quality Lab batch evaluator with a newline-separated topic file:

```bash
npm run quality-lab -- topics.txt --magazine cat --ai gemini --language ko-KR
```

Quality Lab can target any configured magazine profile, for example `--magazine dog`.

Quality Lab generates one dry-run PublishingPackage per topic and writes a Markdown review report under `reports/quality-lab` by default. The report includes per-topic title, summary, quality score, review score, approval status, generation time, token usage, and an overall score and approval summary. Publishing remains disabled.

Storage is currently an internal foundation only. The LocalStorageProvider can upload, download, list, create folders, and read metadata behind the shared StorageProvider interface for tests and future composition work. The Google Drive StorageProvider implements the same boundary with upload, download, list, folder creation, and metadata lookup, but it is disabled unless `GOOGLE_DRIVE_ENABLED=true`, `GOOGLE_DRIVE_CREDENTIALS`, and `GOOGLE_DRIVE_ROOT_FOLDER` are configured. Tests use mocked transport only. Publishing remains disabled.

Asset Library sits above StorageProvider. It registers assets, stores or retrieves file content through the configured storage backend, exposes asset metadata, and can project image assets into the image domain used by dry-run image selection. Google Drive is treated as a storage backend, not as the asset model itself.

Publishing Queue sits between editorial approval and future publisher execution. It stores provider-neutral queue items in memory for this foundation sprint, records approval decisions and destinations, rejects `NEEDS_REVIEW`, `REJECTED`, or missing approval packages, audits queue rejections, enforces explicit status transition rules, and does not invoke publisher adapters during dry-run queue preview.

Scheduler Foundation sits after Publishing Queue. It can create, list, get, and cancel in-memory scheduled jobs for approved queue items, updates queue status to `SCHEDULED`, emits `JOB_SCHEDULED` and `JOB_CANCELLED` audit events, and displays scheduler preview metadata in dry-run output. It does not run jobs, call publisher adapters, or introduce persistence.

Scheduled Job Executor sits after Scheduler. It checks due status, skips future/cancelled/invalid jobs, prevents duplicate execution, moves valid queue items to `PROCESSING`, runs only a supplied provider-neutral preview operation, and records success or failure without transitioning to `PUBLISHED`. It uses RetryService for recoverable simulated execution failures and does not call WordPress or any publisher adapter.

Audit Log records important workflow events in memory for this foundation sprint. The dry run displays a timeline for content generation, quality evaluation, editorial review completion, approval decisions, queue events, scheduler events, and job execution events. Future persistence should sit behind an AuditStore-style port; external logging remains deferred.

Retry Foundation provides a reusable retry service for future AI providers, storage providers, publisher adapters, and scheduler work. It records retry attempts, retry count, final reason, and policy metadata without performing real waits in tests. ContentGenerationWorkflow now uses RetryService for recoverable structured output failures while preserving existing metadata. The current dry run also includes mock retry metadata for report visibility.

The CLI loads `.env` automatically for local development. Existing exported shell environment variables take precedence over `.env` values. OpenAI production mode requires `OPENAI_PRODUCTION_ENABLED=true` and `OPENAI_API_KEY`. Gemini production mode requires `GEMINI_PRODUCTION_ENABLED=true` and `GEMINI_API_KEY`. Without the matching flag and key, the dry run fails clearly before any external request is made and names the required variables.

Gemini dry runs request strict JSON output and include a limited repair fallback for common malformed JSON in long generated article bodies. If parsing still fails, the CLI reports the provider, model, parse error, and a truncated response preview without exposing secrets.

When a PublishingPackage exists, dry-run Article and SEO Preview sections use the PublishingPackage as the source of truth. Legacy article and SEO preview steps no longer override or conflict with the package output.

The dry run prints the assembled PublishingPackage, prompt profile, prompt stack, prompt id, prompt version, rendered variables, composed prompt preview, retry count, validation result, validation report, quality score, quality report, review score, review result, review summary, review issues, threshold result, article title, article word and character count, SEO title and description, FAQ count, approval decision, approval reasons, blocking issues, recommendations, generation duration, queue result, queue item ID, queue status, queue destination, scheduler result, scheduled job ID, scheduled job status, execution preview status, due status, execution attempts, execution queue status, audit timeline, retry metadata, publishing preview status, recommended product names, recommendation reasons, mock affiliate links, disclosure text, selected image filename, tags, category, score, and mock preview URI.

OpenAI and Gemini are not required for local dry runs or tests. MockAIProvider remains the default. Real publishing remains disabled unless a future composition explicitly sets `ASTERIA_PUBLISHING_ENABLED=true`; the current WordPress path is preview-only.

Install dependencies before running type checking in a fresh environment:

```bash
npm install
```
