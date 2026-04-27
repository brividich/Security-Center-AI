# Developer Guide

Security Center AI parser and addon work should preserve deterministic, testable behavior.

## Parser Purity

Parsers should be pure functions over provided content and metadata. They must not call the ORM, perform network calls, mutate global state, or depend on current database contents.

## Output Structure

Parser output should include report identity, report type, period or report date, metrics, findings, alert candidates, source metadata, and `parse_warnings`. Use structured dictionaries and stable names.

## Metrics, Findings, and Alert Candidates

Metrics are numeric facts for rules and dashboards. Findings are domain facts such as CVEs, backup job records, or security incidents. Alert candidates are parser-provided hints that the rule engine may evaluate or enrich.

## Parse Warnings

Use `parse_warnings` when input is incomplete, malformed, ambiguous, or parsed with reduced confidence. Warnings should be concise and safe to show in the UI.

## Prohibited Parser Behavior

Do not use ORM calls in parsers. Do not make network calls in parsers. Do not log full raw report or email bodies. Do not expose secrets. Do not silently treat malformed critical fields as healthy.

## Tests

Add fixtures for representative inputs and tests for parser selection, successful parsing, warning behavior, malformed input, metrics, findings, alert candidates, rule triggering, suppression behavior, Evidence Container creation, and ticket deduplication.

## Seed Config

Add seed configuration for new sources, parsers, rules, notification placeholders, ticketing defaults, and backup expectations when the addon needs them. Seed commands must be idempotent.

## Alert Rules

Rules should be named, scoped, thresholded, deduplicated, and tested. Prefer clear metric names and decision traces that explain why an alert was or was not created.

## Dashboard Visibility

Expose important addon metrics through existing dashboards, KPI snapshots, or source-specific panels. Do not add noisy panels without operational action.

