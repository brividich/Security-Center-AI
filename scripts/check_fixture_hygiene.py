#!/usr/bin/env python
"""Fixture hygiene check — blocca dati reali nelle fixture e nei test.

Motivo (incidente 2026-07): export reali del Firebox aziendale (login SSL VPN con
username e IP domestici di dipendenti) sono stati committati sotto
``security/tests/fixtures/watchguard/`` e pubblicati su un repository GitHub pubblico.
La policy del progetto (CLAUDE.md) impone dati esclusivamente sintetici.

Questo check fallisce (exit 1) se in ``security/tests/`` compaiono indicatori di dati
reali. Uso:

    python scripts/check_fixture_hygiene.py            # scansiona tutto security/tests
    python scripts/check_fixture_hygiene.py FILE...    # scansiona i file indicati (pre-commit)

Installazione come hook pre-commit:

    python scripts/check_fixture_hygiene.py --install-hook
"""
from __future__ import annotations

import ipaddress
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCAN_ROOT = REPO_ROOT / "security" / "tests"

# Estensioni testuali ispezionabili. I binari (pdf/png/xlsx) sono vietati a prescindere
# nelle fixture: non sono verificabili e sono il veicolo dell'incidente originale.
TEXT_SUFFIXES = {".py", ".csv", ".txt", ".json", ".eml", ".log", ".md", ".html"}
FORBIDDEN_FIXTURE_SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".docx", ".pptx"}

# Indicatori di dati reali dell'organizzazione.
REAL_DATA_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("dominio AD interno", re.compile(r"\bcnovicrom\.local\b", re.I)),
    ("nome host firewall reale", re.compile(r"\bNovicromFW\b", re.I)),
    ("nome azienda", re.compile(r"\bnovicrom\b", re.I)),
    ("dominio aziendale", re.compile(r"\bcostruzioninovicrom\b", re.I)),
]

IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")

# Solo questi range sono ammessi nei test: privati (RFC1918), loopback, link-local
# e i tre blocchi di documentazione RFC5737 (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24).
DOC_NETWORKS = [
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
]


def _ip_allowed(raw: str) -> bool:
    try:
        ip = ipaddress.ip_address(raw)
    except ValueError:
        return True  # non e' un IP valido (es. numero di versione): ignora
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_multicast:
        return True
    return any(ip in net for net in DOC_NETWORKS)


def scan_file(path: Path) -> list[str]:
    findings: list[str] = []
    rel = path.relative_to(REPO_ROOT).as_posix()

    if "fixtures/" in rel and path.suffix.lower() in FORBIDDEN_FIXTURE_SUFFIXES:
        findings.append(
            f"{rel}: file binario non ammesso nelle fixture ({path.suffix}). "
            "Le fixture devono essere testuali e sintetiche."
        )
        return findings

    if path.suffix.lower() not in TEXT_SUFFIXES:
        return findings

    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:  # pragma: no cover
        return [f"{rel}: impossibile leggere ({exc})"]

    for lineno, line in enumerate(text.splitlines(), start=1):
        for label, pattern in REAL_DATA_PATTERNS:
            if pattern.search(line):
                findings.append(f"{rel}:{lineno}: {label} — usare valori sintetici (example.local / ExampleFW)")
        for raw_ip in IP_RE.findall(line):
            if not _ip_allowed(raw_ip):
                findings.append(
                    f"{rel}:{lineno}: IP pubblico {raw_ip} — usare RFC1918 (10.99.99.x) "
                    "o RFC5737 (192.0.2.x / 198.51.100.x / 203.0.113.x)"
                )
    return findings


def iter_targets(argv: list[str]):
    if argv:
        for arg in argv:
            path = Path(arg)
            if not path.is_absolute():
                path = REPO_ROOT / path
            if path.is_file():
                try:
                    path.relative_to(SCAN_ROOT)
                except ValueError:
                    continue  # fuori da security/tests: non di competenza di questo check
                yield path
        return
    if SCAN_ROOT.exists():
        yield from (p for p in SCAN_ROOT.rglob("*") if p.is_file())


HOOK = """#!/bin/sh
# Fixture hygiene: blocca il commit di dati reali nei test (vedi scripts/check_fixture_hygiene.py)
files=$(git diff --cached --name-only --diff-filter=ACM -- 'security/tests/*')
[ -z "$files" ] && exit 0
python scripts/check_fixture_hygiene.py $files || {
    echo ""
    echo "Commit bloccato: dati reali rilevati nei test. Usa dati sintetici."
    exit 1
}
"""


def install_hook() -> int:
    hooks_dir = REPO_ROOT / ".git" / "hooks"
    if not hooks_dir.is_dir():
        print("ERRORE: .git/hooks non trovata.", file=sys.stderr)
        return 1
    hook_path = hooks_dir / "pre-commit"
    hook_path.write_text(HOOK, encoding="utf-8", newline="\n")
    print(f"hook installato: {hook_path}")
    return 0


def main(argv: list[str]) -> int:
    if "--install-hook" in argv:
        return install_hook()

    findings: list[str] = []
    for path in iter_targets(argv):
        findings.extend(scan_file(path))

    if findings:
        print("FIXTURE HYGIENE: rilevati dati potenzialmente reali\n", file=sys.stderr)
        for item in findings:
            print(f"  {item}", file=sys.stderr)
        print(f"\n{len(findings)} problemi. Commit da correggere: le fixture devono essere sintetiche.", file=sys.stderr)
        return 1

    print("Fixture hygiene OK: nessun dato reale rilevato in security/tests.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
