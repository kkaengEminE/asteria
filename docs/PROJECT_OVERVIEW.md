# AI Publishing OS - Project Overview

AI Publishing OS is an extensible content automation engine for operating multiple digital magazines from a shared architecture.

The system is intentionally magazine-agnostic. A Cat Magazine, Dog Magazine, AI Magazine, Finance Magazine, Travel Magazine, or Game Magazine should all be represented as configurations and prompt sets that run through the same reusable workflow engine.

## Goals

- Support multiple magazine brands from one codebase.
- Keep provider logic replaceable through interfaces.
- Separate domain intent from infrastructure details.
- Allow human review points before production publishing.
- Enable future channels such as blogs, newsletters, social posts, podcasts, and analytics.

## Non-Goals For This Sprint

- No production publishing.
- No real API integrations.
- No secret management.
- No external dependencies.
- No full content generation implementation.
- No magazine-specific MVP behavior beyond an example configuration.

## Core Concept

Each magazine is driven by a `MagazineConfig` that defines its audience, tone, topics, image source, affiliate provider, publishing destinations, schedule, and prompt set.

Workflows consume this configuration and orchestrate replaceable services:

- AI generation
- Research
- Image selection
- Publishing
- Affiliate enrichment
- TTS and podcast publishing
- Analytics

