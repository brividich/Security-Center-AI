from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.static import serve


def _frontend_dist_dir():
    return Path(settings.FRONTEND_DIST_DIR)


@ensure_csrf_cookie
def react_app_view(request, *args, **kwargs):
    if not getattr(settings, "SERVE_REACT_APP", True):
        raise Http404("React app serving is disabled.")

    index_path = _frontend_dist_dir() / "index.html"
    if not index_path.exists():
        return HttpResponse(_missing_build_html(), content_type="text/html; charset=utf-8")

    response = HttpResponse(index_path.read_bytes(), content_type="text/html; charset=utf-8")
    response["X-Content-Type-Options"] = "nosniff"
    return response


def react_asset_view(request, path):
    if not getattr(settings, "SERVE_REACT_APP", True):
        raise Http404("React asset serving is disabled.")

    assets_dir = _frontend_dist_dir() / "assets"
    return serve(request, path, document_root=assets_dir)


def _missing_build_html():
    return """<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Build frontend mancante</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f6f7f9;
      color: #1f2933;
    }
    main {
      max-width: 720px;
      margin: 12vh auto;
      padding: 32px;
      background: #ffffff;
      border: 1px solid #d8dee6;
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 28px;
    }
    p {
      line-height: 1.55;
    }
    code {
      display: inline-block;
      margin-top: 8px;
      padding: 10px 12px;
      background: #eef2f7;
      border-radius: 6px;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <main>
    <h1>Build frontend di produzione mancante</h1>
    <p>Security Center AI puo servire l'app React da Django, ma il file <strong>frontend/dist/index.html</strong> non e stato trovato.</p>
    <p>Esegui dal repository root:</p>
    <code>npm --prefix frontend run build</code>
    <p>Quindi riavvia Django e apri di nuovo questa pagina.</p>
  </main>
</body>
</html>
"""
