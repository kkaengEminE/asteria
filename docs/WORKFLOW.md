# Workflow

The publishing flow should be built from small, replaceable workflow steps.

## Workflow Engine Foundation

The Workflow Engine executes registered `WorkflowStep` instances in sequence. Each step receives a `WorkflowContext` and returns a `WorkflowStepResult`.

The engine is responsible for:

- Preserving execution order.
- Passing context from one step to the next.
- Stopping on failure.
- Returning a structured `WorkflowResult`.
- Supporting cancellation between steps.
- Accepting a simple logger interface.

The engine is not responsible for:

- Calling provider APIs directly.
- Choosing AI models.
- Loading or rendering prompt files directly.
- Resolving or instantiating providers.
- Publishing content itself.
- Retrying provider operations.
- Storing workflow state permanently.

## Target Daily Publishing Flow

1. Load magazine configuration.
2. Select topic or editorial plan item.
3. Load and render the relevant prompt.
4. Research the topic.
5. Generate content draft.
6. Select image candidates.
7. Choose the best image.
8. Add affiliate recommendations when configured.
9. Prepare publishing payload.
10. Run editorial checks.
11. Publish or create a dry-run preview.
12. Generate social derivatives when enabled.
13. Generate TTS and podcast output when enabled.
14. Record analytics metadata.

## Cat Magazine Dry Run

The Cat Magazine dry run verifies the current foundation without external APIs.

Current dry-run flow:

1. Load Cat Magazine configuration.
2. Load and render article and SEO prompts.
3. Resolve mock research, AI, and publisher providers through `ProviderRegistry`.
4. Build workflow execution through `DryRunWorkflowFactory`.
5. Execute workflow steps through `SequentialWorkflowEngine`.
6. Return a shared `DryRunResult`.
7. Print a readable CLI report with `npm run dry-run`.

No real AI generation, research, publishing, secrets, or files are produced.

## Shared Dry-Run Workflow Foundation

Shared dry-run services extract only the generic pieces proven by Cat Magazine:

- Workflow step helper creation.
- Required workflow data lookup.
- Workflow engine construction.
- Dry-run workflow execution.
- Dry-run result shaping for status, executed steps, rendered prompt preview, article preview, SEO preview, and publish preview.

Magazine modules remain responsible for config selection, prompt choices, provider tokens, mock providers, and magazine-specific step composition.

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

The current engine stops at the first failed step and returns the accumulated step results. Future workflow-specific policies may add retries, rollback, or human review gates without changing provider interfaces.

## Provider Integration Direction

Future providers plug into workflows through composed steps:

1. Application composition registers provider factories in `ProviderRegistry`.
2. A workflow factory resolves needed provider interfaces from the registry.
3. The factory builds provider-backed `WorkflowStep` instances.
4. The engine executes those steps without knowing provider details.
5. Tests can replace providers or steps with mock implementations.

The registry should stay at the composition boundary. Workflow steps may receive provider interfaces as constructor inputs, but the Workflow Engine should never instantiate or resolve providers directly.

## Prompt Integration Direction

Prompt rendering should happen before AI provider calls. A future content generation step can load the magazine config, ask `PromptManager` for the correct prompt, render it with typed variables, and pass only the final text to an `AIProvider`.

Prompt lookup order:

1. Load shared prompts.
2. Load magazine prompts.
3. Let magazine prompts override shared prompts with the same key.
4. Render the selected prompt with required variables.
