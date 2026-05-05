"""Context builder for AI chat - constructs secure messages with application context"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.contrib.auth.models import User
from django.utils import timezone

from ..services.redaction import redact_ai_context
from ...models import (
    SecurityAlert,
    SecurityAlertActionLog,
    SecurityEvidenceContainer,
    SecurityEvidenceItem,
    SecurityRemediationTicket,
    SecurityReport,
)

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 10
MAX_CONTENT_LENGTH = 4000

CONTEXT_DIR = Path(__file__).parent.parent / "context"


def load_context_file(filename: str) -> str:
    """Load markdown context file"""
    try:
        path = CONTEXT_DIR / filename
        if path.exists():
            return path.read_text(encoding="utf-8")
        return ""
    except Exception as e:
        logger.warning(f"Failed to load context file {filename}: {e}")
        return ""


def sanitize_chat_history(history: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Sanitize chat history - only accept user/assistant, max 10 messages, max 4000 chars"""
    if not isinstance(history, list):
        return []

    sanitized = []
    for msg in history[-MAX_HISTORY_MESSAGES:]:
        if not isinstance(msg, dict):
            continue

        role = msg.get("role", "")
        content = msg.get("content", "")

        if role not in ("user", "assistant"):
            continue

        if not isinstance(content, str) or not content.strip():
            continue

        content = content[:MAX_CONTENT_LENGTH]
        sanitized.append({"role": role, "content": content})

    return sanitized


def get_alert_context(alert_id: int) -> Dict[str, Any]:
    """Get context for SecurityAlert"""
    try:
        alert = SecurityAlert.objects.select_related("source", "event").prefetch_related(
            "evidence_containers__items", "tickets", "action_logs"
        ).get(id=alert_id)

        context = {
            "type": "alert",
            "id": alert.id,
            "title": alert.title,
            "severity": alert.severity,
            "status": alert.status,
            "source": alert.source.name if alert.source else None,
            "source_type": alert.source.source_type if alert.source else None,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
            "updated_at": alert.updated_at.isoformat() if alert.updated_at else None,
            "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            "closed_at": alert.closed_at.isoformat() if alert.closed_at else None,
            "snoozed_until": alert.snoozed_until.isoformat() if alert.snoozed_until else None,
            "status_reason": alert.status_reason,
            "owner": alert.owner,
            "dedup_hash": alert.dedup_hash,
            "decision_trace": alert.decision_trace,
        }

        if alert.event:
            context["event"] = {
                "event_type": alert.event.event_type,
                "severity": alert.event.severity,
                "payload": alert.event.payload,
                "parsed_at": alert.event.parsed_at.isoformat() if alert.event.parsed_at else None,
            }

        evidence_containers = []
        for container in alert.evidence_containers.all()[:5]:
            container_data = {
                "id": str(container.id),
                "title": container.title,
                "status": container.status,
                "created_at": container.created_at.isoformat() if container.created_at else None,
            }
            items = []
            for item in container.items.all()[:10]:
                items.append(
                    {
                        "item_type": item.item_type,
                        "content": item.content,
                    }
                )
            container_data["items"] = items
            evidence_containers.append(container_data)
        context["evidence_containers"] = evidence_containers

        tickets = []
        for ticket in alert.tickets.all()[:5]:
            tickets.append(
                {
                    "id": ticket.id,
                    "title": ticket.title,
                    "status": ticket.status,
                    "severity": ticket.severity,
                    "cve": ticket.cve,
                    "cve_ids": ticket.cve_ids,
                    "affected_product": ticket.affected_product,
                    "max_cvss": ticket.max_cvss,
                    "max_exposed_devices": ticket.max_exposed_devices,
                    "occurrence_count": ticket.occurrence_count,
                }
            )
        context["tickets"] = tickets

        action_logs = []
        for log in alert.action_logs.all()[:10]:
            action_logs.append(
                {
                    "action": log.action,
                    "actor": log.actor,
                    "details": log.details,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
            )
        context["action_logs"] = action_logs

        return context
    except SecurityAlert.DoesNotExist:
        logger.warning(f"Alert {alert_id} not found")
        return {"error": "requested object not found or unavailable"}
    except Exception as e:
        logger.exception(f"Error getting alert context: {e}")
        return {"error": "error retrieving alert context"}


def get_report_context(report_id: int) -> Dict[str, Any]:
    """Get context for SecurityReport"""
    try:
        report = SecurityReport.objects.select_related("source", "mailbox_message", "source_file").prefetch_related(
            "metrics", "vulnerability_findings"
        ).get(id=report_id)

        context = {
            "type": "report",
            "id": report.id,
            "title": report.title,
            "report_type": report.report_type,
            "report_date": report.report_date.isoformat() if report.report_date else None,
            "parser_name": report.parser_name,
            "parse_status": report.parse_status,
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "source": report.source.name if report.source else None,
            "source_type": report.source.source_type if report.source else None,
        }

        metrics = []
        for metric in report.metrics.all()[:20]:
            metrics.append(
                {
                    "name": metric.name,
                    "value": metric.value,
                    "unit": metric.unit,
                    "labels": metric.labels,
                }
            )
        context["metrics"] = metrics

        vulnerabilities = []
        for vuln in report.vulnerability_findings.all()[:20]:
            vulnerabilities.append(
                {
                    "cve": vuln.cve,
                    "severity": vuln.severity,
                    "cvss_score": vuln.cvss_score,
                    "affected_asset": vuln.affected_asset.hostname if vuln.affected_asset else None,
                    "description": vuln.description,
                }
            )
        context["vulnerabilities"] = vulnerabilities

        return context
    except SecurityReport.DoesNotExist:
        logger.warning(f"Report {report_id} not found")
        return {"error": "requested object not found or unavailable"}
    except Exception as e:
        logger.exception(f"Error getting report context: {e}")
        return {"error": "error retrieving report context"}


def get_ticket_context(ticket_id: int) -> Dict[str, Any]:
    """Get context for SecurityRemediationTicket"""
    try:
        ticket = SecurityRemediationTicket.objects.select_related("source", "alert").prefetch_related(
            "evidence", "linked_alerts"
        ).get(id=ticket_id)

        context = {
            "type": "ticket",
            "id": ticket.id,
            "title": ticket.title,
            "status": ticket.status,
            "severity": ticket.severity,
            "cve": ticket.cve,
            "cve_ids": ticket.cve_ids,
            "affected_product": ticket.affected_product,
            "organization": ticket.organization,
            "source_system": ticket.source_system,
            "max_cvss": ticket.max_cvss,
            "max_exposed_devices": ticket.max_exposed_devices,
            "first_seen_at": ticket.first_seen_at.isoformat() if ticket.first_seen_at else None,
            "last_seen_at": ticket.last_seen_at.isoformat() if ticket.last_seen_at else None,
            "occurrence_count": ticket.occurrence_count,
            "dedup_hash": ticket.dedup_hash,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
            "source": ticket.source.name if ticket.source else None,
            "source_type": ticket.source.source_type if ticket.source else None,
        }

        evidence_count = ticket.evidence.count()
        linked_alerts_count = ticket.linked_alerts.count()
        context["evidence_count"] = evidence_count
        context["linked_alerts_count"] = linked_alerts_count

        linked_alerts = []
        for alert in ticket.linked_alerts.all()[:5]:
            linked_alerts.append(
                {
                    "id": alert.id,
                    "title": alert.title,
                    "severity": alert.severity,
                    "status": alert.status,
                }
            )
        context["linked_alerts"] = linked_alerts

        return context
    except SecurityRemediationTicket.DoesNotExist:
        logger.warning(f"Ticket {ticket_id} not found")
        return {"error": "requested object not found or unavailable"}
    except Exception as e:
        logger.exception(f"Error getting ticket context: {e}")
        return {"error": "error retrieving ticket context"}


def get_evidence_context(evidence_id: str) -> Dict[str, Any]:
    """Get context for SecurityEvidenceContainer"""
    try:
        container = SecurityEvidenceContainer.objects.select_related("source", "alert").prefetch_related("items").get(
            id=evidence_id
        )

        context = {
            "type": "evidence",
            "id": str(container.id),
            "title": container.title,
            "status": container.status,
            "created_at": container.created_at.isoformat() if container.created_at else None,
            "source": container.source.name if container.source else None,
            "source_type": container.source.source_type if container.source else None,
            "decision_trace": container.decision_trace,
        }

        if container.alert:
            context["alert"] = {
                "id": container.alert.id,
                "title": container.alert.title,
                "severity": container.alert.severity,
                "status": container.alert.status,
            }

        items = []
        for item in container.items.all()[:20]:
            items.append(
                {
                    "item_type": item.item_type,
                    "content": item.content,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                }
            )
        context["items"] = items

        return context
    except SecurityEvidenceContainer.DoesNotExist:
        logger.warning(f"Evidence container {evidence_id} not found")
        return {"error": "requested object not found or unavailable"}
    except Exception as e:
        logger.exception(f"Error getting evidence context: {e}")
        return {"error": "error retrieving evidence context"}


def get_dashboard_context() -> Dict[str, Any]:
    """Get synthetic dashboard overview context"""
    try:
        from django.db.models import Count, Q

        now = timezone.now()

        open_alerts = SecurityAlert.objects.filter(status="new").count()
        critical_alerts = SecurityAlert.objects.filter(severity="critical", status="new").count()
        high_alerts = SecurityAlert.objects.filter(severity="high", status="new").count()
        medium_alerts = SecurityAlert.objects.filter(severity="medium", status="new").count()
        low_alerts = SecurityAlert.objects.filter(severity="low", status="new").count()

        open_tickets = SecurityRemediationTicket.objects.filter(status="open").count()
        cve_tickets = SecurityRemediationTicket.objects.filter(status="open").exclude(cve="").count()

        recent_alerts = (
            SecurityAlert.objects.select_related("source")
            .filter(created_at__gte=now - timezone.timedelta(days=7))
            .order_by("-created_at")[:5]
        )
        recent_reports = (
            SecurityReport.objects.select_related("source")
            .filter(created_at__gte=now - timezone.timedelta(days=7))
            .order_by("-created_at")[:5]
        )

        context = {
            "type": "dashboard",
            "generated_at": now.isoformat(),
            "alerts": {
                "open": open_alerts,
                "critical": critical_alerts,
                "high": high_alerts,
                "medium": medium_alerts,
                "low": low_alerts,
            },
            "tickets": {
                "open": open_tickets,
                "cve": cve_tickets,
                "non_cve": open_tickets - cve_tickets,
            },
            "recent_alerts": [
                {
                    "id": alert.id,
                    "title": alert.title,
                    "severity": alert.severity,
                    "status": alert.status,
                    "source": alert.source.name if alert.source else None,
                    "created_at": alert.created_at.isoformat() if alert.created_at else None,
                }
                for alert in recent_alerts
            ],
            "recent_reports": [
                {
                    "id": report.id,
                    "title": report.title,
                    "report_type": report.report_type,
                    "report_date": report.report_date.isoformat() if report.report_date else None,
                    "parser_name": report.parser_name,
                    "parse_status": report.parse_status,
                    "source": report.source.name if report.source else None,
                }
                for report in recent_reports
            ],
        }

        return context
    except Exception as e:
        logger.exception(f"Error getting dashboard context: {e}")
        return {"error": "error retrieving dashboard context"}


def get_runtime_context(runtime_context: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Get runtime context based on object_type and object_id"""
    if not runtime_context:
        return None

    object_type = runtime_context.get("object_type")
    object_id = runtime_context.get("object_id")

    if not object_type:
        return None

    try:
        if object_type == "alert" and object_id:
            return get_alert_context(int(object_id))
        elif object_type == "report" and object_id:
            return get_report_context(int(object_id))
        elif object_type == "ticket" and object_id:
            return get_ticket_context(int(object_id))
        elif object_type == "evidence" and object_id:
            return get_evidence_context(str(object_id))
        elif object_type == "dashboard":
            return get_dashboard_context()
        else:
            logger.warning(f"Unknown object_type: {object_type}")
            return None
    except (ValueError, TypeError) as e:
        logger.warning(f"Invalid object_id for {object_type}: {e}")
        return None


def build_ai_messages(
    user: User,
    user_message: str,
    history: Optional[List[Dict[str, str]]] = None,
    runtime_context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, str]]:
    """Build AI messages with application context

    Args:
        user: Django user instance
        user_message: Current user message
        history: Chat history from client
        runtime_context: Optional context with object_type and object_id

    Returns:
        List of messages for AI completion
    """
    messages = []

    assistant_profile = load_context_file("assistant_profile.md")
    domain_knowledge = load_context_file("domain_knowledge.md")
    safety_policy = load_context_file("safety_policy.md")
    response_formats = load_context_file("response_formats.md")

    system_content = ""

    if assistant_profile:
        system_content += f"\n{assistant_profile}\n"

    if domain_knowledge:
        system_content += f"\n{domain_knowledge}\n"

    if safety_policy:
        system_content += f"\n{safety_policy}\n"

    if response_formats:
        system_content += f"\n{response_formats}\n"

    if system_content:
        messages.append({"role": "system", "content": system_content.strip()})

    user_context = {
        "username": user.username,
        "is_staff": user.is_staff,
        "permissions": list(user.get_all_permissions())[:10],
    }

    messages.append({"role": "system", "content": f"User context: {user_context}"})

    sanitized_history = sanitize_chat_history(history or [])
    messages.extend(sanitized_history)

    if runtime_context:
        context_data = get_runtime_context(runtime_context)
        if context_data:
            redacted_context = redact_ai_context(context_data)
            messages.append({"role": "system", "content": f"Context: {redacted_context}"})

    messages.append({"role": "user", "content": user_message})

    return messages
