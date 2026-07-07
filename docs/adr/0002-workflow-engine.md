# ADR 0002: Workflow Engine

## Context

Asteria needs one orchestration model for many automations: publishing, podcast generation, Instagram content, AI generation, affiliate enrichment, and analytics.

These automations share common needs: ordered execution, context passing, failure handling, dry-run support, and future cancellation or review gates.

## Decision

Asteria will use a small sequential Workflow Engine as the initial orchestration foundation.

The engine will:

- Register `WorkflowStep` instances.
- Execute steps in order.
- Pass a shared `WorkflowContext`.
- Stop on failure.
- Return a structured `WorkflowResult`.
- Support cancellation between steps.
- Accept a simple logger interface.

The engine will not call external providers directly. Provider-backed behavior must be wrapped in workflow steps.

## Consequences

This creates a stable orchestration layer before real providers are added. It keeps the implementation easy to test and avoids provider coupling. More advanced concerns such as persistence, retries, parallel execution, rollback policy, and human approval gates are deferred until concrete workflow needs justify them.

