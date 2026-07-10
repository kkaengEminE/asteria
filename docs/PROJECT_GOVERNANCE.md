# Project Governance

Asteria is developed through small, reviewable sprints. Governance keeps the project architecture stable while allowing the system to grow from dry-run foundations into production integrations.

## Development Roles

### Founder

The Founder owns product direction, business priorities, final approval, release approval, and production enablement decisions.

Responsibilities:

- Define the next sprint objective.
- Review Codex reports and implementation results.
- Make the final decision on whether a sprint is accepted, held, or revised.
- Approve production credentials, publishing activation, release tags, and roadmap changes.

### GPT

GPT acts as CTO, Product Architect, and planning and review partner for sprint design.

Responsibilities:

- Help shape sprint scope before implementation.
- Translate product intent into small engineering increments.
- Own architecture review and code review recommendations.
- Recommend GO / HOLD based on sequencing, architecture, quality, and delivery risks.
- Help the Founder make the final approval decision.

### Codex

Codex acts as Lead Engineer and implementation owner.

Responsibilities:

- Read relevant documentation before each sprint.
- Verify whether the requested sprint is still the right next step.
- Implement the sprint with minimal, reviewable changes.
- Preserve provider-neutral and clean architecture boundaries.
- Update documentation when architecture, interfaces, workflows, configuration, or roadmap changes.
- Run required validation.
- Return the required REPORT.

## Sprint Lifecycle

1. Founder proposes the sprint.
2. GPT may refine scope and identify risks.
3. Codex reads project documentation, roadmap, and relevant prior sprint output.
4. Codex confirms the sprint is still appropriate or explains why another sprint should come first.
5. Codex implements the smallest complete version of the sprint.
6. Codex updates documentation when needed.
7. Codex runs required validation.
8. Codex returns REPORT.
9. Founder reviews the result.
10. Founder decides GO, HOLD, or revision.

## GO / HOLD Review Policy

GO means the sprint is recommended for acceptance and the project may proceed after Founder approval.

HOLD means GPT recommends pausing before the next sprint because a review, fix, refactor, or decision is required.

Recommend HOLD when:

- Acceptance criteria are not met.
- Tests, type checking, or dry-run validation fail.
- Documentation diverges from implementation.
- Provider-specific logic leaks across boundaries.
- A production safeguard is missing.
- A secret is exposed or hardcoded.
- The sprint created unclear architecture or duplicated abstractions.
- The roadmap sequence no longer matches project reality.

Recommend GO when:

- The sprint objective is complete.
- Required validation passes.
- Documentation is current.
- Risks are documented.
- Next sprint recommendation is clear.

## Sprint Types

### Feature Sprint

Adds a new user-visible or system capability.

Rules:

- Keep scope small.
- Add or update tests.
- Update documentation when behavior, architecture, configuration, or workflow changes.
- Do not enable production behavior unless explicitly requested and guarded.

### Architecture Sprint

Defines or changes system boundaries, interfaces, domain models, or provider contracts.

Rules:

- Prefer provider-neutral interfaces.
- Keep implementation minimal.
- Create an ADR when a lasting architectural decision is introduced, unless ADRs are locked for the sprint.
- Update architecture and module documentation.

### Refactoring Sprint

Improves structure without changing intended behavior.

Rules:

- Preserve external behavior.
- Keep tests passing before and after.
- Avoid unrelated feature work.
- Document renamed or moved modules when public project structure changes.

### Quality Sprint

Improves reliability, validation, review, testing, output quality, or developer workflow.

Rules:

- Define measurable checks.
- Add tests for the improved behavior.
- Avoid changing architecture unless the quality issue requires it.
- Document new validation or review behavior.

## 5-Sprint Architecture Review Cycle

After every five implementation sprints, run an architecture review before continuing major feature work.

Review checkpoints:

- Sprint 5
- Sprint 10
- Sprint 15
- Sprint 20
- Sprint 25
- Sprint 30
- Sprint 35
- Continue every five sprints

Architecture review should evaluate:

- Domain boundaries.
- Provider boundaries.
- Workflow consistency.
- Duplicated interfaces.
- Obsolete files.
- Dead code.
- Test coverage gaps.
- Documentation drift.
- Production safety.
- Roadmap sequencing.

Outputs should include:

- Strengths.
- Weaknesses.
- Technical debt.
- Refactoring suggestions.
- Risk analysis.
- Future scalability notes.

## Release and Tagging Policy

Releases should be cut only after a review sprint or explicit Founder approval.

Release requirements:

- All tests pass.
- Type checking passes.
- Dry-run passes.
- Documentation is current.
- Known limitations are documented.
- Production behavior is disabled by default unless the release explicitly enables it.
- No secrets are committed.
- Release notes are created under `docs/releases`.

Tag format:

- Stable release: `vMAJOR.MINOR.PATCH`
- Beta release: `vMAJOR.MINOR.PATCH-beta`
- Release candidate: `vMAJOR.MINOR.PATCH-rc.N`

Example:

```text
v0.2.0-beta
```

Commit policy:

- Use one logical commit per sprint when requested.
- Prefer Conventional Commits.
- Do not mix unrelated cleanup with feature implementation.

## Definition of Done

A sprint is done only when:

- The requested scope is implemented.
- No prohibited scope was added.
- `npm test` passes.
- `npm run typecheck` passes.
- `npm run dry-run` passes, unless the sprint explicitly changes this requirement.
- Relevant tests are added or updated.
- Documentation is updated when architecture, interfaces, workflow, configuration, or roadmap changes.
- ADRs are created for new lasting architecture decisions when ADRs are not locked.
- No secrets are added.
- No real external API calls are made from tests.
- Production behavior remains disabled by default unless explicitly approved.
- The final REPORT is returned in the required format.

## REPORT FORMAT

Final sprint reports must use this structure:

```text
REPORT

1. Summary

...

2. Files Created

...

3. Files Modified

...

4. Tests Added

...

5. Architecture Decisions

...

6. ADRs Created

...

7. Project Health Check

Architecture:
...

Technical Debt:
...

Roadmap:
...

Future Risks:
...

8. Risks / Open Questions

...

9. Next Recommended Sprint

...
```

When the user requests the report inside a Markdown code block, the entire report must be contained inside one code block and nothing may appear before or after it.

## CHANGELOG FORMAT

Changelog entries should be grouped by release version.

Use this structure:

```text
# Changelog

## vMAJOR.MINOR.PATCH - YYYY-MM-DD

### Added

- ...

### Changed

- ...

### Fixed

- ...

### Deprecated

- ...

### Removed

- ...

### Security

- ...

### Known Limitations

- ...
```

Rules:

- Keep entries user- and reviewer-readable.
- Mention production safeguards when relevant.
- Mention migrations or renamed commands.
- Do not include secrets, private credentials, or raw environment values.
- Link release notes under `docs/releases` when a release document exists.

## Decision Authority

### Founder

- Product vision.
- Business priorities.
- Final approval.

### GPT

- CTO.
- Product Architect.
- Sprint planning.
- Architecture review.
- GO / HOLD recommendations.
- Code review.

### Codex

- Implementation.
- Tests.
- Documentation.
- Refactoring.

## Communication Rule

Sprint review responses should be action-oriented.

Preferred response order:

1. Result
2. User Action
3. Documentation, if any
4. Next Prompt

Avoid repeating governance explanations already documented here.
