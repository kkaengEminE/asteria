# Changelog

## Unreleased

### Added

- Founder Review panel with detailed 1–5 content-quality scores, review flags, and feedback attached to browser History items.
- Five Korean test-topic presets with custom topic input preserved.
- Secret-free JSON Founder Review export and review-score display in Compare.
- Browser action for saving the current edited working copy as a WordPress draft.
- Draft-only `POST /wordpress/drafts` endpoint with strict request validation.
- Explicit `ASTERIA_WORDPRESS_DRAFT_ENABLED` production safeguard.
- Real WordPress REST transport behind the existing PublisherService and WordPressPublisher boundaries.
- Draft result UI with draft ID, edit URL, destination label, timestamp, and failure state.

### Security

- WordPress payload status is forced to `draft` in mapping and transport layers.
- Browser requests cannot provide credentials or override post status.
- Unsafe base URLs and credential-bearing URLs are rejected.
- WordPress errors redact URLs, authorization values, and credential-like values.
- No public WordPress publishing endpoint was added.
