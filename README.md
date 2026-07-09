# Asteria

Asteria is the foundation for an extensible AI Publishing OS: a reusable content automation engine that can run multiple magazines from shared interfaces, configuration, prompts, and workflows.

## Current Sprint

Sprint 28 patch improves the Gemini dry-run demo path. The CLI now loads `.env` automatically, supports `--language`, improves provider-specific output labels, and avoids false article-structure warnings for well-formed Markdown.

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

The CLI loads `.env` automatically for local development. Existing exported shell environment variables take precedence over `.env` values. OpenAI production mode requires `OPENAI_PRODUCTION_ENABLED=true` and `OPENAI_API_KEY`. Gemini production mode requires `GEMINI_PRODUCTION_ENABLED=true` and `GEMINI_API_KEY`. Without the matching flag and key, the dry run fails clearly before any external request is made and names the required variables.

Gemini dry runs request strict JSON output and include a limited repair fallback for common malformed JSON in long generated article bodies. If parsing still fails, the CLI reports the provider, model, parse error, and a truncated response preview without exposing secrets.

When a PublishingPackage exists, dry-run Article and SEO Preview sections use the PublishingPackage as the source of truth. Legacy article and SEO preview steps no longer override or conflict with the package output.

The dry run prints the assembled PublishingPackage, prompt profile, prompt stack, prompt id, prompt version, rendered variables, composed prompt preview, retry count, validation result, validation report, quality score, quality report, review score, review result, review summary, review issues, threshold result, article title, article word and character count, SEO title and description, FAQ count, approval decision, approval reasons, blocking issues, recommendations, generation duration, publishing preview status, recommended product names, recommendation reasons, mock affiliate links, disclosure text, selected image filename, tags, category, score, and mock preview URI.

OpenAI and Gemini are not required for local dry runs or tests. MockAIProvider remains the default. Real publishing remains disabled unless a future composition explicitly sets `ASTERIA_PUBLISHING_ENABLED=true`; the current WordPress path is preview-only.

Install dependencies before running type checking in a fresh environment:

```bash
npm install
```
