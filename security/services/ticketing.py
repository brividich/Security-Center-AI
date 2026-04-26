from security.models import SecurityAlertActionLog, SecurityRemediationTicket, Status


ACTIVE_TICKET_STATUSES = [Status.OPEN, Status.IN_PROGRESS, Status.NEW]


def create_or_update_cve_ticket(source, alert, evidence, cve, affected_product, dedup_hash):
    ticket = (
        SecurityRemediationTicket.objects.filter(
            source=source,
            cve=cve,
            affected_product=affected_product,
            status__in=ACTIVE_TICKET_STATUSES,
        )
        .order_by("-updated_at")
        .first()
    )
    created = ticket is None
    if created:
        ticket = SecurityRemediationTicket.objects.create(
            source=source,
            alert=alert,
            cve=cve,
            affected_product=affected_product,
            title=f"Remediate {cve} on {affected_product}",
            dedup_hash=dedup_hash,
        )
        action = "ticket_created"
    else:
        ticket.alert = alert
        ticket.dedup_hash = dedup_hash
        ticket.save(update_fields=["alert", "dedup_hash", "updated_at"])
        action = "ticket_updated_existing_cve"
    if evidence:
        ticket.evidence.add(evidence)
    SecurityAlertActionLog.objects.create(
        alert=alert,
        ticket=ticket,
        action=action,
        details={"cve": cve, "affected_product": affected_product, "evidence_id": str(evidence.id) if evidence else None},
    )
    return ticket, created


def create_backup_ticket(source, alert, evidence, job_name, dedup_hash):
    ticket = SecurityRemediationTicket.objects.create(
        source=source,
        alert=alert,
        title=f"Investigate backup issue: {job_name}",
        dedup_hash=dedup_hash,
    )
    if evidence:
        ticket.evidence.add(evidence)
    SecurityAlertActionLog.objects.create(alert=alert, ticket=ticket, action="backup_ticket_created")
    return ticket
