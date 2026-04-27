from django.db.models import Count
from django.utils import timezone

from security.models import SecurityAlert, SecurityAlertActionLog, SecurityAlertSuppressionRule, SecurityEventRecord, Severity, Status
from security.services.alert_lifecycle import ACTIVE_ALERT_STATUSES
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
        alert, alert_created = _get_or_create_active_alert(
            source=event.source,
            event=event,
            title=f"Critical exposed vulnerability {payload.get('cve')}",
            severity=Severity.CRITICAL,
            dedup_hash=event.dedup_hash,
            decision_trace=trace,
        )
        trace["alert_created"] = alert_created
        _store_alert_decision_trace(alert, trace, alert_created)
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
        SecurityAlertActionLog.objects.create(
            alert=alert,
            action="alert_created" if alert_created else "alert_reused",
            details=trace,
        )
    else:
        event.decision_trace = {"decision": "kpi_only", "reason": "Vulnerability not both critical and exposed"}
        event.save(update_fields=["decision_trace"])


def _evaluate_backup(event):
    status = event.payload.get("status", "").lower()
    if status == "completed":
        event.decision_trace = {"decision": "kpi_only", "rule": "Backup completed => KPI only"}
        event.save(update_fields=["decision_trace"])
        return
    if status == "unknown":
        event.decision_trace = {"decision": "diagnostic_event", "rule": "Backup status unknown => diagnostic only"}
        event.save(update_fields=["decision_trace"])
        return
    trace = {"decision": "alert", "rule": "Backup missing/failed => alert + evidence", "backup_status": status}
    alert, alert_created = _get_or_create_active_alert(
        source=event.source,
        event=event,
        title=f"Backup job requires attention: {event.payload.get('job_name')}",
        severity=Severity.WARNING,
        dedup_hash=event.dedup_hash,
        decision_trace=trace,
    )
    trace["alert_created"] = alert_created
    _store_alert_decision_trace(alert, trace, alert_created)
    event.decision_trace = trace
    event.save(update_fields=["decision_trace"])
    evidence = build_evidence_container(event.source, alert.title, alert=alert, event=event, decision_trace=trace)
    create_backup_ticket(event.source, alert, evidence, event.payload.get("job_name"), event.dedup_hash)
    SecurityAlertActionLog.objects.create(
        alert=alert,
        action="alert_created" if alert_created else "alert_reused",
        details=trace,
    )


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
        alert, alert_created = _get_or_create_active_alert(
            source=event.source,
            event=event,
            title="VPN authentication spike detected",
            severity=Severity.WARNING,
            dedup_hash=event.dedup_hash,
            decision_trace=trace,
        )
        trace["alert_created"] = alert_created
        _store_alert_decision_trace(alert, trace, alert_created)
        SecurityAlertActionLog.objects.create(
            alert=alert,
            action="alert_created" if alert_created else "alert_reused",
            details=trace,
        )
        event.decision_trace = trace
    else:
        event.decision_trace = {"decision": "kpi_only", "reason": "VPN volume below threshold", "count": count, "threshold": threshold}
    event.save(update_fields=["decision_trace"])


def _get_or_create_active_alert(source, event, title, severity, dedup_hash, decision_trace):
    alert = (
        SecurityAlert.objects.filter(source=source, dedup_hash=dedup_hash, status__in=ACTIVE_ALERT_STATUSES)
        .order_by("-updated_at")
        .first()
    )
    if alert:
        alert.event = event
        alert.save(update_fields=["event", "updated_at"])
        return alert, False
    return (
        SecurityAlert.objects.create(
            source=source,
            event=event,
            title=title,
            severity=severity,
            dedup_hash=dedup_hash,
            decision_trace=decision_trace,
        ),
        True,
    )


def _store_alert_decision_trace(alert, trace, alert_created):
    if alert_created:
        alert.decision_trace = trace
    else:
        alert.decision_trace = {**alert.decision_trace, "latest_decision": trace}
    alert.save(update_fields=["decision_trace", "updated_at"])
