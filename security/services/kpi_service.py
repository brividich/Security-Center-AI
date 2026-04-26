from django.db.models import Count
from django.utils import timezone

from security.models import SecurityEventRecord, SecurityKpiSnapshot


def build_daily_kpi_snapshots(snapshot_date=None):
    snapshot_date = snapshot_date or timezone.localdate()
    start = timezone.make_aware(timezone.datetime.combine(snapshot_date, timezone.datetime.min.time()))
    end = timezone.make_aware(timezone.datetime.combine(snapshot_date, timezone.datetime.max.time()))
    created = 0
    rows = (
        SecurityEventRecord.objects.filter(occurred_at__range=(start, end))
        .values("source", "event_type")
        .annotate(total=Count("id"))
    )
    for row in rows:
        SecurityKpiSnapshot.objects.update_or_create(
            source_id=row["source"],
            snapshot_date=snapshot_date,
            name=row["event_type"],
            defaults={"value": row["total"], "labels": {"source_id": row["source"]}},
        )
        created += 1
    return created
