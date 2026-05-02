@'
# CLAUDE.md — Security Center AI

Follow AGENTS.md as the main project instruction file.

## Project

Security Center AI is a Django + React/Vite security report intelligence platform.

Current stable version: 0.5.1.

Backend:
- Django app in project root
- Main security module: security/

Frontend:
- React/Vite app in frontend/

## Safety boundaries

Do not inspect, print, modify, or commit:
- .env
- secrets
- credentials
- certificates
- private keys
- real mailbox data
- real report uploads
- production logs
- .venv
- node_modules
- frontend/dist
- package-lock.json unless strictly required

Use fake data only.

## Workflow

Before editing:
1. Use targeted search.
2. Read only relevant files.
3. Do not read entire large docs.
4. Do not read README.md, CHANGELOG.md, docs/, or package-lock.json unless needed.
5. Keep patches small.
6. Run quality gates after changes.

## Quality gates

Backend:

```bash
python manage.py check
python manage.py test security.tests
python manage.py test
python manage.py makemigrations --check --dry-run