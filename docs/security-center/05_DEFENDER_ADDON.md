# Microsoft Defender Addon

The Microsoft Defender addon parses vulnerability notification emails and creates actionable vulnerability findings, alerts, Evidence Containers, and remediation tickets.

## Supported Input

The supported input is a Microsoft Defender vulnerability notification email. Source matching should use trusted sender and subject patterns in `/security/admin/config/`.

## Extraction

The parser extracts CVE identifiers, severity, CVSS score, exposed devices, affected product, source metadata, and recurrence details when present. Findings are stored as structured vulnerability records and may also produce metrics and alert candidates.

## Critical Logic

Critical vulnerability logic typically combines severity, CVSS score, exposed device count, and configured alert rules. A CVSS score of 9.0 or greater or a vendor-provided Critical severity should be treated as urgent when exposed devices are present.

## Evidence Container

Evidence should include the CVE, affected product, CVSS score, exposed device count, report reference, parser name, first seen time, last seen time, recurrence count, and decision trace. Do not store the full raw email body in Evidence Containers.

## Ticket Deduplication and Aggregation

Remediation ticketing deduplicates recurring Defender findings and can aggregate related CVEs by affected product. Existing open tickets should be updated with max CVSS, max exposed devices, recurrence count, last seen time, linked alerts, and evidence instead of creating duplicate work.

## Recurrence Handling

When a CVE appears again, the finding and ticket should record recurrence. Closed tickets may be reopened depending on ticket configuration. Repeated occurrences should raise urgency through counts and timestamps, not by creating duplicate tickets for the same remediation owner.

