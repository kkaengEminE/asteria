# Roadmap

## Phase 1: Core Interfaces

Define stable contracts for providers, generators, publishers, workflow steps, and magazine configuration.

## Phase 2: Config Loader

Load magazine configs from disk, validate required fields, and expose typed configuration to workflows.

## Phase 3: Prompt Manager

Create prompt set loading, prompt variable interpolation, and prompt version tracking.

## Phase 4: Cat Magazine MVP

Build the first end-to-end dry-run magazine flow using Cat Magazine configuration.

## Phase 5: WordPress Publisher

Implement a WordPress publisher adapter behind the `Publisher` interface.

## Phase 6: Google Drive Image Library

Implement an image library adapter for curated assets stored in Google Drive.

## Phase 7: Coupang Affiliate

Implement an affiliate provider adapter for Coupang while keeping affiliate enrichment optional per magazine.

## Phase 8: Instagram Content Generator

Generate Instagram-ready captions, hashtags, and image selection metadata from article content.

## Phase 9: TTS + Podcast

Add text-to-speech generation and podcast publishing workflows behind replaceable interfaces.

## Phase 10: Analytics

Collect publication and performance analytics through provider adapters and feed results into future editorial planning.

