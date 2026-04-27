# Configuration Guide

Security Center AI uses DB-backed configuration for operational control.

## Seed Configuration

Run `python manage.py seed_security_center_config` after migrations and whenever a new environment needs defaults. The seed command should be idempotent and should not overwrite deliberate local changes unless designed to do so.

## General Settings

General settings store feature flags and thresholds. Secret settings must be masked in UI, diagnostics, audit log, and tests.

## Source Configuration

Sources should be narrowly matched using trusted senders, subject patterns, input type, vendor, source type, and parser name. Disable unused sources.

## Parser Configuration

Parser config controls enabled state, priority, source type, input type, description, and JSON options. Parser names must match the parser registry.

## Alert Rules

Rules should have clear codes, human-readable names, source scope, metric name, operator, threshold, severity, cooldown, deduplication window, Evidence Container behavior, and ticket behavior.

## Suppressions

Suppressions should include reason, owner, scope, payload conditions, start time, and expiration. Avoid broad critical suppressions.

## Backup Expectations

Backup expected jobs should mirror actual protected workloads. Review missing-after windows and critical asset flags monthly.

## Notifications and Ticketing

Notification configuration should use secret references. Ticketing should reflect the real remediation workflow and recurring Defender CVE handling.

