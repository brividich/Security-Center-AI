# WatchGuard Addon

The WatchGuard addon turns Firebox, Dimension, EPDR, and ThreatSync reports into metrics, findings, alert candidates, dashboards, and Evidence Containers.

## Supported Inputs

Supported inputs include Firebox Authentication Allowed CSV, Firebox Authentication Denied CSV, Dimension Executive Summary, Interface Summary, SD-WAN Status, Zero-Day APT Summary, EPDR Executive Report, ThreatSync Summary, and ThreatSync Incident List.

## Extracted Metrics

Typical metrics include allowed authentications, denied authentications, top users, top source IPs, denied reasons, blocked threats, malware detections, botnet indicators, IPS activity, DNSWatch findings, WebBlocker activity, interface health, SD-WAN status, Zero-Day APT counts, EPDR detections, ThreatSync incidents, and report period metadata.

## Alert Rules

Common rules include excessive denied authentications, critical threat detections, elevated blocked threat volume, unhealthy SD-WAN status, Zero-Day APT detections, EPDR critical detections, and high-severity ThreatSync incidents.

## Noise Reduction

Use scoped suppressions for known benign IPs, maintenance windows, known scanner accounts, and expected authentication bursts. Prefer short expirations and payload conditions over broad source-wide suppressions.

## Known Limitations

PDF layout changes can reduce extraction quality. CSV exports must retain expected headers. Some Dimension summaries are aggregate reports and may not include per-asset evidence. Parser warnings should be reviewed before treating missing fields as zero-risk.

