import re

from .base import BaseParser, ParsedRecord, ParsedReport
from .registry import parser_registry


class SynologyActiveBackupEmailParser(BaseParser):
    name = "synology_active_backup_email_parser"

    def can_parse(self, item) -> bool:
        subject = getattr(item, "subject", "").lower()
        body = getattr(item, "body", "").lower()
        return "active backup" in subject or "synology" in body

    def parse(self, item) -> ParsedReport:
        text = item.body
        job = self._match(r"(?:Job|Task):\s*(.+)", text, "Active Backup Job")
        raw_status = self._match(r"Status:\s*(.+)", text, "unknown").lower()
        status = "completed" if any(token in raw_status for token in ["success", "completed"]) else raw_status
        protected = int(self._match(r"Protected items?:\s*(\d+)", text, "0"))
        record = ParsedRecord(
            record_type="backup_job",
            payload={
                "job_name": job.strip(),
                "status": status.strip(),
                "protected_items": protected,
                "source_message_id": item.pk,
            },
            metrics={"backup_jobs": 1},
        )
        return ParsedReport(
            report_type="synology_active_backup",
            title=item.subject,
            parser_name=self.name,
            records=[record],
            metrics={"backup_jobs": 1, f"backup_{status.strip()}": 1},
            payload={"subject": item.subject},
        )

    def _match(self, pattern, text, default):
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        return match.group(1).strip() if match else default


parser_registry.register(SynologyActiveBackupEmailParser())
