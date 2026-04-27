from django.utils import timezone

from security.models import (
    BackupJobRecord,
    ParseStatus,
    SecurityEventRecord,
    SecurityReport,
    SecurityReportMetric,
    SecuritySourceFile,
    SecurityVulnerabilityFinding,
    Severity,
)
from security.parsers.load import *  # noqa: F403,F401
from security.parsers import parser_registry
from security.services.dedup import make_hash


def run_pending_parsers():
    parsed_count = 0
    for item in _pending_items():
        parser = parser_registry.match(item)
        if not parser:
            item.parse_status = ParseStatus.SKIPPED
            item.save(update_fields=["parse_status"])
            continue
        try:
            parsed = parser.parse(item)
            report = SecurityReport.objects.create(
                source=item.source,
                mailbox_message=item if hasattr(item, "subject") else None,
                source_file=item if isinstance(item, SecuritySourceFile) else None,
                report_type=parsed.report_type,
                title=parsed.title,
                parser_name=parsed.parser_name,
                parsed_payload=parsed.payload,
            )
            for name, value in parsed.metrics.items():
                SecurityReportMetric.objects.create(report=report, name=name, value=value)
            for record in parsed.records:
                _persist_record(item.source, report, record)
            item.parse_status = ParseStatus.PARSED
            item.save(update_fields=["parse_status"])
            parsed_count += 1
        except Exception as exc:  # pragma: no cover - management command visibility
            item.parse_status = ParseStatus.FAILED
            item.raw_payload = {**item.raw_payload, "parser_error": str(exc)}
            item.save(update_fields=["parse_status", "raw_payload"])
    return parsed_count


def _pending_items():
    from security.models import SecurityMailboxMessage

    yield from SecurityMailboxMessage.objects.filter(parse_status=ParseStatus.PENDING).order_by("received_at")
    yield from SecuritySourceFile.objects.filter(parse_status=ParseStatus.PENDING).order_by("uploaded_at")


def _persist_record(source, report, record):
    if record.record_type == "vulnerability_finding":
        payload = record.payload
        dedup_hash = make_hash(source.pk, payload["cve"], payload["affected_product"])
        finding = SecurityVulnerabilityFinding.objects.create(
            source=source,
            report=report,
            cve=payload["cve"],
            affected_product=payload["affected_product"],
            cvss=payload["cvss"],
            exposed_devices=payload["exposed_devices"],
            severity=payload.get("severity", Severity.HIGH),
            dedup_hash=dedup_hash,
            payload=payload,
        )
        _create_event(source, report, "vulnerability_finding", finding.severity, dedup_hash, payload)
    elif record.record_type == "backup_job":
        payload = record.payload
        dedup_hash = make_hash(
            source.pk,
            payload.get("dedup_hash") or make_hash(
                payload.get("vendor"),
                payload.get("job_name"),
                payload.get("device_name"),
                payload.get("start_time"),
                payload.get("end_time"),
                payload.get("status"),
            ),
        )
        if BackupJobRecord.objects.filter(source=source, dedup_hash=dedup_hash).exists():
            return
        BackupJobRecord.objects.create(
            source=source,
            report=report,
            job_name=payload["job_name"],
            status=payload["status"],
            started_at=_parse_iso_datetime(payload.get("start_time")),
            completed_at=_parse_iso_datetime(payload.get("end_time")),
            protected_items=payload.get("protected_items", 0),
            payload=payload,
            dedup_hash=dedup_hash,
        )
        severity = Severity.WARNING if payload["status"] in {"failed", "warning"} else Severity.INFO
        occurred_at = _parse_iso_datetime(payload.get("end_time")) or _parse_iso_datetime(payload.get("start_time"))
        _create_event(source, report, "backup_job", severity, dedup_hash, payload, occurred_at=occurred_at)
    else:
        payload = record.payload
        dedup_hash = make_hash(source.pk, record.record_type, payload)
        _create_event(source, report, record.record_type, Severity.INFO, dedup_hash, payload)


def _create_event(source, report, event_type, severity, dedup_hash, payload, occurred_at=None):
    fingerprint = make_hash(source.pk, event_type, dedup_hash, payload)
    SecurityEventRecord.objects.create(
        source=source,
        report=report,
        event_type=event_type,
        severity=severity,
        occurred_at=occurred_at or timezone.now(),
        fingerprint=fingerprint,
        dedup_hash=dedup_hash,
        payload=payload,
    )


def _parse_iso_datetime(value):
    if not value:
        return None
    try:
        parsed = timezone.datetime.fromisoformat(value)
    except ValueError:
        return None
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed
