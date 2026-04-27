# Architecture

Security Center AI is a Django application with server-rendered administration pages, parser services, rule evaluation services, ticketing services, Evidence Containers, KPI snapshots, and operational diagnostics.

## Core Engine

The core engine stores sources, raw mailbox/file records, parsed reports, metrics, event records, alerts, Evidence Containers, tickets, KPI snapshots, and configuration audit logs. Core code owns shared persistence, pipeline orchestration, alert lifecycle, suppression checks, diagnostics, and administration.

## Parser Engine

The parser engine selects enabled parser configurations, runs parser modules against pending reports or messages, and stores structured parser output. Parser output should include report metadata, metrics, findings, alert candidates, and `parse_warnings` when input is incomplete or unexpected. Parsers must be deterministic and should not call the ORM, network, or external systems.

## Rule Engine

The rule engine evaluates metrics and event records against DB-backed alert rules. It applies thresholds, severity, cooldowns, deduplication windows, suppression rules, Evidence Container creation, and optional ticket creation.

## Ticketing

Ticketing aggregates remediation work, especially Defender CVE findings. Current tickets are internal remediation records. Future addons may synchronize them with external tools, but this patch documents the operating model only.

## Evidence

Evidence Containers group the structured facts that justify an alert or ticket. They should contain relevant metrics, findings, event payload fields, parser warnings, report references, and decision traces without logging full raw report or email bodies.

## KPI Snapshots

KPI snapshots capture daily values for dashboard and trend views. They summarize parsed metrics and support weekly and monthly operational review.

## Admin Config

`/security/admin/config/` provides DB-backed control over settings, sources, parsers, alert rules, suppressions, backup expectations, notifications, ticketing, and audit log review.

## Diagnostics

`/security/admin/diagnostics/` validates enabled sources, enabled parsers, parser registry coverage, required notification configuration, risky suppressions, source matching, and other operational readiness checks.

## Addon Model

Core is the shared engine. An addon is a source-specific package containing parsers, default source configs, default rules, metrics, dashboards, tests, and docs. Current source-specific code exists in the existing parser and service layout; folders are not refactored in Patch 7A.

