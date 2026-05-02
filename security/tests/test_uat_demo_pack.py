import io
import json
import re

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from security.management.commands.seed_security_uat_demo import (
    DEMO_CODE_PREFIX,
    DEMO_MAILBOX_SOURCES,
    DEMO_RAW_BODY_MARKER,
    DEMO_SOURCE_NAME_PREFIX,
    DEMO_SUBJECT_PREFIX,
)
from security.models import (
    SecurityMailboxIngestionRun,
    SecurityMailboxMessage,
    SecurityMailboxSource,
    SecuritySource,
    SourceType,
)


class UatDemoPackTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(username="uat-staff", is_staff=True)
        self.client.force_authenticate(user=self.user)

    def test_seed_command_creates_demo_sources(self):
        call_command("seed_security_uat_demo", stdout=io.StringIO())

        codes = set(SecurityMailboxSource.objects.values_list("code", flat=True))
        for source in DEMO_MAILBOX_SOURCES:
            self.assertIn(source["code"], codes)

        self.assertEqual(SecurityMailboxSource.objects.filter(code__startswith=DEMO_CODE_PREFIX).count(), 6)
        self.assertEqual(SecurityMailboxMessage.objects.filter(subject__startswith=DEMO_SUBJECT_PREFIX).count(), 6)
        self.assertGreaterEqual(SecurityMailboxIngestionRun.objects.filter(status="success").count(), 1)
        self.assertGreaterEqual(SecurityMailboxIngestionRun.objects.filter(status="partial").count(), 1)
        self.assertGreaterEqual(SecurityMailboxIngestionRun.objects.filter(status="failed").count(), 1)

    def test_seed_command_is_idempotent(self):
        call_command("seed_security_uat_demo", stdout=io.StringIO())
        first_counts = self._demo_counts()

        call_command("seed_security_uat_demo", stdout=io.StringIO())
        second_counts = self._demo_counts()

        self.assertEqual(first_counts, second_counts)

    def test_dry_run_creates_nothing(self):
        call_command("seed_security_uat_demo", "--dry-run", stdout=io.StringIO())

        self.assertEqual(SecurityMailboxSource.objects.filter(code__startswith=DEMO_CODE_PREFIX).count(), 0)
        self.assertEqual(SecuritySource.objects.filter(name__startswith=DEMO_SOURCE_NAME_PREFIX).count(), 0)
        self.assertEqual(SecurityMailboxMessage.objects.filter(subject__startswith=DEMO_SUBJECT_PREFIX).count(), 0)

    def test_reset_deletes_only_demo_records(self):
        control_mailbox_source = SecurityMailboxSource.objects.create(
            name="Control Placeholder Source",
            code="control-placeholder",
            enabled=True,
            source_type="manual",
            mailbox_address="ops@example.local",
        )
        control_runtime_source = SecuritySource.objects.create(
            name="Control Placeholder Runtime",
            vendor="Example Company",
            source_type=SourceType.EMAIL,
        )
        SecurityMailboxMessage.objects.create(
            source=control_runtime_source,
            sender="ops@example.local",
            subject=f"{DEMO_SUBJECT_PREFIX} non-demo record must remain",
            body="Synthetic non-demo control record.",
        )
        SecurityMailboxIngestionRun.objects.create(source=control_mailbox_source, status="success")

        call_command("seed_security_uat_demo", stdout=io.StringIO())
        self.assertGreater(SecurityMailboxSource.objects.filter(code__startswith=DEMO_CODE_PREFIX).count(), 0)

        call_command("seed_security_uat_demo", "--reset", stdout=io.StringIO())

        self.assertEqual(SecurityMailboxSource.objects.filter(code__startswith=DEMO_CODE_PREFIX).count(), 0)
        self.assertEqual(SecuritySource.objects.filter(name__startswith=DEMO_SOURCE_NAME_PREFIX).count(), 0)
        self.assertEqual(SecurityMailboxMessage.objects.filter(source__name__startswith=DEMO_SOURCE_NAME_PREFIX).count(), 0)
        self.assertTrue(SecurityMailboxSource.objects.filter(pk=control_mailbox_source.pk).exists())
        self.assertTrue(SecuritySource.objects.filter(pk=control_runtime_source.pk).exists())
        self.assertTrue(SecurityMailboxMessage.objects.filter(source=control_runtime_source).exists())
        self.assertTrue(SecurityMailboxIngestionRun.objects.filter(source=control_mailbox_source).exists())

    def test_smoke_check_passes_after_seed(self):
        call_command("seed_security_uat_demo", stdout=io.StringIO())

        stdout = io.StringIO()
        call_command("security_uat_smoke_check", stdout=stdout)

        output = stdout.getvalue()
        self.assertIn("PASS: Demo mailbox sources exist", output)
        self.assertIn("Summary:", output)

    def test_no_real_looking_secrets_in_demo_data(self):
        call_command("seed_security_uat_demo", stdout=io.StringIO())

        payload = self._all_demo_text()
        unsafe_patterns = [
            r"password\s*[:=]",
            r"client_secret\s*[:=]",
            r"api[_ -]?key\s*[:=]",
            r"token\s*[:=]",
            r"bearer\s+[a-z0-9._-]{12,}",
            r"sk-[a-z0-9]{12,}",
        ]
        for pattern in unsafe_patterns:
            self.assertIsNone(re.search(pattern, payload, re.IGNORECASE))

        for email in re.findall(r"[\w.+-]+@([\w.-]+)", payload):
            self.assertIn(email, {"example.com", "example.local"})

        for ip_address in re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", payload):
            self.assertTrue(
                ip_address.startswith(("192.0.2.", "198.51.100.", "203.0.113.")),
                msg=f"Non-documentation IP address found in UAT demo data: {ip_address}",
            )

    def test_demo_subjects_and_sources_are_clearly_marked(self):
        call_command("seed_security_uat_demo", stdout=io.StringIO())

        for source in SecurityMailboxSource.objects.filter(code__startswith=DEMO_CODE_PREFIX):
            self.assertTrue(source.code.startswith(DEMO_CODE_PREFIX))
            self.assertTrue(source.name.startswith(DEMO_SOURCE_NAME_PREFIX))

        for source in SecuritySource.objects.filter(name__startswith=DEMO_SOURCE_NAME_PREFIX):
            self.assertTrue(source.name.startswith(DEMO_SOURCE_NAME_PREFIX))

        for message in SecurityMailboxMessage.objects.filter(source__name__startswith=DEMO_SOURCE_NAME_PREFIX):
            self.assertTrue(message.subject.startswith(DEMO_SUBJECT_PREFIX))
            self.assertTrue(message.raw_payload.get("uat_demo"))

    def test_api_summaries_do_not_expose_raw_synthetic_body_text(self):
        call_command("seed_security_uat_demo", stdout=io.StringIO())

        responses = [
            self.client.get(reverse("security:api_configuration_overview")),
            self.client.get(reverse("security:api_configuration_sources")),
            self.client.get(reverse("security:api_addons")),
            self.client.get(reverse("security:api_inbox_recent")),
        ]

        for response in responses:
            self.assertEqual(response.status_code, 200)
            response_text = json.dumps(response.json(), sort_keys=True)
            self.assertNotIn(DEMO_RAW_BODY_MARKER, response_text)
            self.assertNotIn("Microsoft Defender synthetic vulnerability digest", response_text)
            self.assertNotIn("Synology Active Backup synthetic failure notice", response_text)
            self.assertNotIn("timestamp,user,src_ip,result,device", response_text)

    def _demo_counts(self):
        return {
            "mailbox_sources": SecurityMailboxSource.objects.filter(code__startswith=DEMO_CODE_PREFIX).count(),
            "runtime_sources": SecuritySource.objects.filter(name__startswith=DEMO_SOURCE_NAME_PREFIX).count(),
            "messages": SecurityMailboxMessage.objects.filter(source__name__startswith=DEMO_SOURCE_NAME_PREFIX).count(),
            "runs": SecurityMailboxIngestionRun.objects.filter(source__code__startswith=DEMO_CODE_PREFIX).count(),
        }

    def _all_demo_text(self):
        parts = []
        for source in SecurityMailboxSource.objects.filter(code__startswith=DEMO_CODE_PREFIX):
            parts.extend(
                [
                    source.name,
                    source.code,
                    source.mailbox_address,
                    source.description,
                    source.sender_allowlist_text,
                    source.subject_include_text,
                    source.last_error_message,
                ]
            )
        for source in SecuritySource.objects.filter(name__startswith=DEMO_SOURCE_NAME_PREFIX):
            parts.extend([source.name, source.vendor, source.source_type])
        for message in SecurityMailboxMessage.objects.filter(source__name__startswith=DEMO_SOURCE_NAME_PREFIX):
            parts.extend(
                [
                    message.sender,
                    message.subject,
                    message.body,
                    json.dumps(message.raw_payload, sort_keys=True),
                    json.dumps(message.pipeline_result, sort_keys=True),
                ]
            )
        for run in SecurityMailboxIngestionRun.objects.filter(source__code__startswith=DEMO_CODE_PREFIX):
            parts.extend([run.error_message, json.dumps(run.details, sort_keys=True)])
        return "\n".join(str(part) for part in parts if part)
