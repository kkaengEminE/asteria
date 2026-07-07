# Workflow

The publishing flow should be built from small, replaceable workflow steps.

## Target Daily Publishing Flow

1. Load magazine configuration.
2. Select topic or editorial plan item.
3. Research the topic.
4. Generate content draft.
5. Select image candidates.
6. Choose the best image.
7. Add affiliate recommendations when configured.
8. Prepare publishing payload.
9. Run editorial checks.
10. Publish or create a dry-run preview.
11. Generate social derivatives when enabled.
12. Generate TTS and podcast output when enabled.
13. Record analytics metadata.

## Dry-Run First

All workflows should support dry-run mode before any production publishing exists. Dry-run output should make it clear what would be generated, what provider would be used, and which destination would receive content.

## Human Review

The architecture should allow human approval gates before:

- Publishing articles.
- Posting to social platforms.
- Generating affiliate links at scale.
- Publishing podcast episodes.

## Error Handling Direction

Workflow steps should report structured results. A failed step should identify:

- Step name.
- Failure reason.
- Whether retry is safe.
- Partial output, if any.
- Suggested recovery action.

