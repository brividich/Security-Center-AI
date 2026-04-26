from django.db.models import Count
from django.utils import timezone

from security.models import SecurityAlert, SecurityAlertActionLog, SecurityAlertSuppressionRule, SecurityEventRecord, Severity
from security.services.evidence_builder import build_evidence_container
from security.services.ticketing import create_backup_ticket, create_or_update_cve_ticket


def evaluate_security_rules():
    evaluated = 0
    for event in SecurityEventRecord.objects.filter(decision_trace={}).order_by("occurred_at"):
        evaluated += 1
        suppression = _matching_suppression(event)
        if suppression:
            _mark_suppressed(event, suppression)
            continue
        if event.event_type == "vulnerability_finding":
            _evaluate_vulnerability(event)
        elif event.event_type == "backup_job":
            _evaluate_backup(event)
        elif event.event_type in {"vpn_auth_denied", "vpn_auth_allowed"}:
            _evaluate_vpn(event)
        else:
            event.decision_trace = {"decision": "kpi_only", "reason": "No alert rule matched"}
            event.save(update_fields=["decision_trace"])
    return evaluated


def _matching_suppression(event):
    for rule in SecurityAlertSuppressionRule.objects.filter(is_active=True):
        if rule.matches(event):
            return rule
    return None


def _mark_suppressed(event, rule):
    event.suppressed = True
    event.decision_trace = {"decision": "suppressed_kpi_only", "rule": rule.name, "reason": rule.reason}
    event.save(update_fields=["suppressed", "decision_trace"])


def _evaluate_vulnerability(event):
    payload = event.payload
    is_critical = payload.get("severity") == Severity.CRITICAL or float(payload.get("cvss", 0)) >= 9
    exposed = int(payload.get("exposed_devices", 0)) > 0
    if is_critical and exposed:
        trace = {
            "decision": "alert",
            "rule": "CVE Critical/CVSS >= 9/exposed_devices > 0",
            "cvss": payload.get("cvss"),
            "exposed_devices": payload.get("exposed_devices"),
        }
        alert = SecurityAlert.objects.create(
            source=event.source,
            event=event,
            title=f"Critical exposed vulnerability {payload.get('cve')}",
            severity=Severity.CRITICAL,
            dedup_hash=event.dedup_hash,
            decision_trace=trace,
        )
        event.decision_trace = trace
        event.save(update_fields=["decision_trace"])
        evidence = build_evidence_container(event.source, alert.title, alert=alert, event=event, decision_trace=trace)
        create_or_update_cve_ticket(
            event.source,
            alert,
            evidence,
            payload.get("cve"),
            payload.get("affected_product"),
            event.dedup_hash,
        )
        SecurityAlertActionLog.objects.create(alert=alert, action="alert_created", details=trace)
    else:
        event.decision_trace = {"decision": "kpi_only", "reason": "Vulnerability not both critical and exposed"}
        event.save(update_fields=["decision_trace"])


def _evaluate_backup(event):
    status = event.payload.get("status", "").lower()
    if status == "completed":
        event.decision_trace = {"decision": "kpi_only", "rule": "Backup completed => KPI only"}
        event.save(update_fields=["decision_trace"])
        return
    trace = {"decision": "alert", "rule": "Backup missing/failed => alert + evidence", "backup_status": status}
    alert = SecurityAlert.objects.create(
        source=event.source,
        event=event,
        title=f"Backup job requires attention: {event.payload.get('job_name')}",
        severity=Severity.WARNING,
        dedup_hash=event.dedup_hash,
        decision_trace=trace,
    )
    event.decision_trace = trace
    event.save(update_fields=["decision_trace"])
    evidence = build_evidence_container(event.source, alert.title, alert=alert, event=event, decision_trace=trace)
    create_backup_ticket(event.source, alert, evidence, event.payload.get("job_name"), event.dedup_hash)
    SecurityAlertActionLog.objects.create(alert=alert, action="alert_created", details=trace)


def _evaluate_vpn(event):
    window_start = timezone.now() - timezone.timedelta(hours=1)
    count = SecurityEventRecord.objects.filter(
        source=event.source,
        event_type=event.event_type,
        occurred_at__gte=window_start,
    ).aggregate(total=Count("id"))["total"]
    threshold = int(event.payload.get("threshold", 10))
    if count > threshold:
        trace = {"decision": "alert", "rule": "VPN reconnect spike above threshold", "count": count, "threshold": threshold}
        SecurityAlert.objects.create(
            source=event.source,
            event=event,
            title="VPN authentication spike detected",
            severity=Severity.WARNING,
            dedup_hash=event.dedup_hash,
            decision_trace=trace,
        )
        event.decision_trace = trace
    else:
        event.decision_trace = {"decision": "kpi_only", "reason": "VPN volume below threshold", "count": count, "threshold": threshold}
    event.save(update_fields=["decision_trace"])
