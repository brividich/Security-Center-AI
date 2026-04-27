# Addons

Security Center AI separates shared platform behavior from source-specific behavior.

## Definition

Core is the shared engine: ingestion records, parser execution, metrics, findings, rule evaluation, suppression, Evidence Containers, ticketing, KPI snapshots, admin config, diagnostics, and audit logging.

An Addon is a source-specific package containing parsers, default source configs, default parser configs, default alert rules, source metrics, dashboard visibility, tests, fixtures, and documentation.

## Current Addons

WatchGuard covers Firebox, Dimension, EPDR, and ThreatSync report intelligence. Microsoft Defender covers vulnerability notification emails and remediation ticket aggregation. Backup/NAS covers Synology Active Backup email intelligence and expected job monitoring.

## Target Architecture

Future addons should live in a predictable package layout with:

1. parsers
2. seed configuration
3. rule definitions
4. metric definitions
5. dashboards or dashboard adapters
6. fixtures
7. tests
8. documentation

Patch 7A does not move existing folders unless trivial and safe. The current code remains in the established parser and service layout while this document defines the target operating model.

## Addon Quality Bar

Each addon must parse without ORM calls, avoid network calls, emit structured metrics/findings/alert candidates, include parse warnings for partial input, avoid full raw report logging, seed disabled-safe defaults where appropriate, and include tests for representative inputs.

