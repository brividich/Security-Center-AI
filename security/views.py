from django.contrib import messages
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import (
    SecurityAlert,
    SecurityEvidenceContainer,
    SecurityEventRecord,
    SecurityKpiSnapshot,
    SecurityRemediationTicket,
    SecurityReport,
    SecuritySource,
    SecurityVulnerabilityFinding,
    Severity,
    Status,
)
from .services.alert_lifecycle import (
    ACTIVE_ALERT_STATUSES,
    acknowledge_alert,
    close_alert,
    mark_false_positive,
    reopen_alert,
    snooze_alert,
)
from .services.kpi_service import build_daily_kpi_snapshots
from .services.parser_engine import run_pending_parsers
from .services.rule_engine import evaluate_security_rules


def dashboard(request):
    today = timezone.localdate()
    context = {
        "open_alerts_count": SecurityAlert.objects.filter(status__in=ACTIVE_ALERT_STATUSES).count(),
        "critical_alerts_count": SecurityAlert.objects.filter(status__in=ACTIVE_ALERT_STATUSES, severity=Severity.CRITICAL).count(),
        "open_tickets_count": SecurityRemediationTicket.objects.filter(status__in=[Status.NEW, Status.OPEN, Status.IN_PROGRESS]).count(),
        "reports_today_count": SecurityReport.objects.filter(created_at__date=today).count(),
        "evidence_today_count": SecurityEvidenceContainer.objects.filter(created_at__date=today).count(),
        "latest_critical_cves": SecurityVulnerabilityFinding.objects.filter(severity=Severity.CRITICAL).order_by("-last_seen_at")[:8],
        "latest_alerts": _decorate_alerts(SecurityAlert.objects.select_related("source", "event").order_by("-updated_at")[:10]),
        "last_pipeline_run": request.session.get("last_pipeline_run"),
    }
    return render(request, "security/dashboard.html", context)


def alerts_list(request):
    alerts = SecurityAlert.objects.select_related("source", "event").annotate(evidence_count=Count("evidence_containers")).order_by("-updated_at")
    if request.GET.get("severity"):
        alerts = alerts.filter(severity=request.GET["severity"])
    if request.GET.get("status"):
        alerts = alerts.filter(status=request.GET["status"])
    if request.GET.get("source"):
        alerts = alerts.filter(source_id=request.GET["source"])
    if request.GET.get("date"):
        alerts = alerts.filter(created_at__date=request.GET["date"])

    context = {
        "alerts": _decorate_alerts(alerts[:100]),
        "sources": SecuritySource.objects.order_by("name"),
        "severity_choices": Severity.choices,
        "status_choices": Status.choices,
        "filters": request.GET,
    }
    return render(request, "security/alerts_list.html", context)


def alert_detail(request, pk):
    alert = get_object_or_404(SecurityAlert.objects.select_related("source", "event"), pk=pk)
    alert.short_dedup_hash = alert.dedup_hash[:12] if alert.dedup_hash else ""
    ticket = alert.tickets.order_by("-updated_at").first()
    evidence = alert.evidence_containers.prefetch_related("items").order_by("-created_at")
    occurrences = SecurityEventRecord.objects.filter(dedup_hash=alert.dedup_hash).select_related("report").order_by("-occurred_at")[:25]
    action_logs = alert.action_logs.select_related("ticket").order_by("-created_at")[:25]
    payload = alert.event.payload if alert.event_id else {}
    context = {
        "alert": alert,
        "ticket": ticket,
        "evidence": evidence,
        "occurrences": occurrences,
        "action_logs": action_logs,
        "source_report": alert.event.report if alert.event_id else None,
        "vulnerability": {
            "cve": payload.get("cve"),
            "cvss": payload.get("cvss"),
            "affected_product": payload.get("affected_product"),
            "exposed_devices": payload.get("exposed_devices"),
        },
    }
    context.update(_alert_lifecycle_context(alert))
    return render(request, "security/alert_detail.html", context)


@require_POST
def alert_action(request, pk, action):
    alert = get_object_or_404(SecurityAlert, pk=pk)
    action = "false_positive" if action == "false-positive" else action
    actor = request.user.username if request.user.is_authenticated else "ui"
    reason = request.POST.get("reason", "").strip()
    handlers = {
        "acknowledge": lambda: acknowledge_alert(alert, actor=actor, reason=reason),
        "close": lambda: close_alert(alert, actor=actor, reason=reason),
        "false_positive": lambda: mark_false_positive(alert, actor=actor, reason=reason),
        "snooze": lambda: snooze_alert(alert, _parse_snooze_until(request.POST.get("snooze_until")), actor=actor, reason=reason),
        "reopen": lambda: reopen_alert(alert, actor=actor, reason=reason),
    }
    if action not in handlers:
        messages.error(request, "Unsupported alert action.")
        return redirect("security:alert_detail", pk=alert.pk)

    alert = handlers[action]()
    if request.headers.get("HX-Request"):
        context = _alert_lifecycle_context(alert)
        context.update(
            {
                "alert": alert,
                "action_result": f"Alert action recorded: {action}.",
            }
        )
        return render(request, "security/partials/alert_lifecycle_panel.html", context)
    messages.success(request, f"Alert action recorded: {action}.")
    return redirect("security:alert_detail", pk=alert.pk)


def tickets_list(request):
    tickets = SecurityRemediationTicket.objects.select_related("source", "alert").order_by("-updated_at")
    return render(request, "security/tickets_list.html", {"tickets": tickets})


def kpis_page(request):
    selected_date = _parse_date(request.GET.get("date")) or timezone.localdate()
    snapshots = SecurityKpiSnapshot.objects.select_related("source").filter(snapshot_date=selected_date).order_by("source__name", "name")
    grouped = {}
    for snapshot in snapshots:
        source_name = snapshot.source.name if snapshot.source else "Global"
        grouped.setdefault(source_name, []).append(snapshot)
    context = {
        "selected_date": selected_date,
        "previous_date": selected_date - timezone.timedelta(days=1),
        "next_date": selected_date + timezone.timedelta(days=1),
        "grouped_kpis": grouped,
    }
    return render(request, "security/kpis.html", context)


def pipeline_page(request):
    return render(request, "security/pipeline.html", {"last_pipeline_run": request.session.get("last_pipeline_run")})


@require_POST
def pipeline_run(request, action):
    started_at = timezone.now()
    result = {
        "action": action,
        "started_at": started_at.isoformat(timespec="seconds"),
        "finished_at": None,
        "reports_parsed": 0,
        "rules_evaluated": 0,
        "alerts_created": 0,
        "alerts_deduplicated": 0,
        "kpis_built": 0,
        "errors": [],
    }
    alerts_before = SecurityAlert.objects.count()
    try:
        if action in {"run-parsers", "full"}:
            result["reports_parsed"] = run_pending_parsers()
        if action in {"evaluate-rules", "full"}:
            evaluated_event_ids = list(SecurityEventRecord.objects.filter(decision_trace={}).values_list("id", flat=True))
            result["rules_evaluated"] = evaluate_security_rules()
            evaluated = SecurityEventRecord.objects.filter(id__in=evaluated_event_ids)
            result["alerts_deduplicated"] = sum(1 for event in evaluated if event.decision_trace.get("alert_created") is False)
        if action in {"build-kpis", "full"}:
            result["kpis_built"] = build_daily_kpi_snapshots()
    except Exception as exc:  # pragma: no cover - defensive UI reporting
        result["errors"].append(str(exc))
    result["alerts_created"] = max(SecurityAlert.objects.count() - alerts_before, 0)
    result["finished_at"] = timezone.now().isoformat(timespec="seconds")
    request.session["last_pipeline_run"] = result
    request.session.modified = True

    if request.headers.get("HX-Request"):
        return render(request, "security/partials/pipeline_result.html", {"last_pipeline_run": result})
    return redirect(reverse("security:pipeline"))


def _decorate_alerts(alerts):
    decorated = []
    for alert in alerts:
        alert.short_dedup_hash = alert.dedup_hash[:12] if alert.dedup_hash else ""
        alert.linked_ticket = alert.tickets.order_by("-updated_at").first()
        alert.last_seen_at = alert.event.occurred_at if alert.event_id else alert.updated_at
        decorated.append(alert)
    return decorated


def _alert_lifecycle_context(alert):
    terminal_statuses = [Status.CLOSED, Status.FALSE_POSITIVE, Status.RESOLVED, Status.SUPPRESSED]
    active_statuses = [Status.NEW, Status.OPEN, Status.ACKNOWLEDGED, Status.IN_PROGRESS, Status.SNOOZED, Status.MUTED]
    is_terminal = alert.status in terminal_statuses
    is_active = alert.status in active_statuses
    return {
        "can_acknowledge": alert.status in [Status.NEW, Status.OPEN],
        "can_snooze": is_active and alert.status != Status.SNOOZED,
        "can_close": is_active,
        "can_mark_false_positive": is_active,
        "can_reopen": is_terminal,
        "can_act": is_active,
    }


def _parse_date(value):
    if not value:
        return None
    try:
        return timezone.datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _parse_snooze_until(value):
    if not value:
        return timezone.now() + timezone.timedelta(hours=24)
    try:
        parsed = timezone.datetime.fromisoformat(value)
    except ValueError:
        return timezone.now() + timezone.timedelta(hours=24)
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed
