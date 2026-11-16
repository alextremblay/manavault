---
id: TASK-104
title: Support local OpenAI-compatible AI servers
status: Done
assignee: []
created_date: '2026-11-16T02:16:00Z'
updated_date: '2026-11-16T02:37:00Z'
labels: []
dependencies: []
type: feature
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AI settings currently require OpenRouter and its Decisions API, which prevents self-hosted deployments from using a local OpenAI-compatible inference server. Add a configurable compatible API base URL while preserving OpenRouter behavior, and ensure the existing deck analysis, questions, and AI-tag assignment features work against the selected local server.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The AI settings UI lets the owner select OpenRouter or an OpenAI-compatible server and configure its base URL, model, and optional API key.
- [x] #2 Local OpenAI-compatible server settings validate and persist without requiring OpenRouter endpoints or an API key.
- [x] #3 Deck analysis, deck questions, and AI-tag assignments use the selected compatible server.
- [x] #4 Existing OpenRouter settings and behavior remain supported.
- [x] #5 AI settings and feature documentation describe local server configuration and network requirements.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a persisted compatible API base URL and provider-aware settings validation, preserving OpenRouter's existing validation path. 2. Route completion and AI-tag requests through the configured OpenAI-compatible endpoint, omit OpenRouter-only request fields and headers for local servers, and use chat completions for local AI-tag decisions. 3. Add provider/base-URL controls to settings, regenerate GraphQL types, and update AI documentation. 4. Run focused Rust and frontend checks and exercise the local-compatible request path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the api_base_url migration and provider-aware validation; compatible servers use /models and optional bearer auth. Deck analysis, questions, and AI-tag decisions use /chat/completions without OpenRouter-only fields. API keys are not reused across provider changes. Updated GraphQL types, settings UI, README, and feature docs. Verification: rust:sqlx-prepare passed; manavault-ai suite passed 71 tests and the added local-question test passed separately; core local-provider and migration-upgrade tests passed; frontend tests passed 8/8; frontend typecheck and formatting passed; browser smoke showed the OpenAI-compatible selector, base URL, model, and optional key. A full core test run reported db::tests::the_bundled_sqlite_has_no_process_wide_cache_locks failing its SQLite compile-option assertion; two migration-count expectations from this change were updated and their focused tests passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added configurable OpenAI-compatible servers with a persisted base URL and optional API key; routed deck analysis, questions, and AI-tag decisions through chat completions while preserving OpenRouter behavior. Updated settings UI, generated GraphQL types, and setup documentation, including backend network requirements. Verified local analysis, question, and AI-tag paths; 71 AI tests plus the added local-question test; local settings and migration tests; frontend tests/typecheck; and the settings UI in-browser. The full core suite still has a SQLite compile-option assertion failure; migration-count tests pass after updating their expectations.
<!-- SECTION:FINAL_SUMMARY:END -->
