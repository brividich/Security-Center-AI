from django.shortcuts import render

from .models import SecurityAlert, SecurityEvidenceContainer, SecurityKpiSnapshot, SecurityReport


def dashboard(request):
    context = {
        "alerts": SecurityAlert.objects.order_by("-created_at")[:10],
        "reports_count": SecurityReport.objects.count(),
        "evidence_count": SecurityEvidenceContainer.objects.count(),
        "latest_kpis": SecurityKpiSnapshot.objects.order_by("-snapshot_date", "-created_at")[:12],
    }
    return render(request, "security/dashboard.html", context)
