import { apiClient } from "./apiClient";
import type { AddonDetail, AddonRegistryResponse, AddonSummary } from "../types/security";

const mockAddons: AddonSummary[] = [
  {
    code: "watchguard",
    name: "WatchGuard",
    vendor: "WatchGuard",
    description: "WatchGuard Dimension, Firebox, EPDR, and ThreatSync reporting.",
    status: "enabled",
    status_reason: "Mock development data loaded because the backend is unreachable.",
    source_types: ["watchguard_dimension_firebox"],
    parser_names: ["watchguard_report_parser"],
    total_source_count: 3,
    enabled_source_count: 3,
    total_parser_count: 1,
    enabled_parser_count: 1,
    total_rule_count: 4,
    enabled_rule_count: 4,
    open_alert_count: 2,
    critical_alert_count: 0,
    open_ticket_count: 0,
    last_report_at: "2026-04-26T07:25:00+02:00",
    last_parser_warning_at: null,
    last_parser_error_at: null,
    warning_count: 0,
    documentation_file: "04_WATCHGUARD_ADDON.md",
    warnings: [],
    misconfigurations: [],
    links: {
      api_detail: "/api/security/addons/watchguard/",
      django_config: "/security/admin/config/",
      django_diagnostics: "/security/admin/diagnostics/",
      django_docs: "/security/admin/docs/?file=04_WATCHGUARD_ADDON.md",
    },
  },
  {
    code: "microsoft_defender",
    name: "Microsoft Defender",
    vendor: "Microsoft",
    description: "Microsoft Defender vulnerability notifications and remediation tickets.",
    status: "warning",
    status_reason: "Recent parser warnings are present for this addon.",
    source_types: ["microsoft_defender"],
    parser_names: ["microsoft_defender_vulnerability_notification_email_parser"],
    total_source_count: 1,
    enabled_source_count: 1,
    total_parser_count: 1,
    enabled_parser_count: 1,
    total_rule_count: 2,
    enabled_rule_count: 2,
    open_alert_count: 1,
    critical_alert_count: 1,
    open_ticket_count: 1,
    last_report_at: "2026-04-26T08:02:00+02:00",
    last_parser_warning_at: "2026-04-26T08:02:00+02:00",
    last_parser_error_at: null,
    warning_count: 1,
    documentation_file: "05_DEFENDER_ADDON.md",
    warnings: ["Recent parser warnings are present for this addon."],
    misconfigurations: [],
    links: {
      api_detail: "/api/security/addons/microsoft_defender/",
      django_config: "/security/admin/config/",
      django_diagnostics: "/security/admin/diagnostics/",
      django_docs: "/security/admin/docs/?file=05_DEFENDER_ADDON.md",
    },
  },
  {
    code: "backup_nas",
    name: "Backup/NAS",
    vendor: "Synology / NAS",
    description: "Backup and NAS monitoring, including Synology Active Backup email reports.",
    status: "enabled",
    status_reason: "Enabled source, parser, and alert rule coverage are available.",
    source_types: ["synology_backup"],
    parser_names: ["synology_active_backup_email_parser"],
    total_source_count: 1,
    enabled_source_count: 1,
    total_parser_count: 1,
    enabled_parser_count: 1,
    total_rule_count: 4,
    enabled_rule_count: 4,
    open_alert_count: 1,
    critical_alert_count: 0,
    open_ticket_count: 0,
    last_report_at: "2026-04-26T00:45:00+02:00",
    last_parser_warning_at: null,
    last_parser_error_at: null,
    warning_count: 0,
    documentation_file: "06_BACKUP_ADDON.md",
    warnings: [],
    misconfigurations: [],
    links: {
      api_detail: "/api/security/addons/backup_nas/",
      django_config: "/security/admin/config/",
      django_diagnostics: "/security/admin/diagnostics/",
      django_docs: "/security/admin/docs/?file=06_BACKUP_ADDON.md",
    },
  },
];

export const securityApi = {
  async getAddons(): Promise<{ addons: AddonSummary[]; fromMock: boolean }> {
    try {
      const data = await apiClient.get<AddonRegistryResponse>("/api/security/addons/");
      return { addons: data.addons, fromMock: false };
    } catch (error) {
      if (import.meta.env.DEV) {
        return { addons: mockAddons, fromMock: true };
      }
      throw error;
    }
  },

  async getAddonDetail(code: string): Promise<{ addon: AddonDetail; fromMock: boolean }> {
    try {
      const addon = await apiClient.get<AddonDetail>(`/api/security/addons/${code}/`);
      return { addon, fromMock: false };
    } catch (error) {
      if (import.meta.env.DEV) {
        const summary = mockAddons.find((addon) => addon.code === code) ?? mockAddons[0];
        return {
          addon: {
            ...summary,
            sources: [],
            runtime_sources: [],
            parsers: summary.parser_names.map((parserName, index) => ({
              parser_name: parserName,
              enabled: index < summary.enabled_parser_count,
              priority: 10 + index,
              source_type: summary.source_types.join(","),
              input_type: "email,pdf,csv,text",
              description: parserName,
              updated_at: null,
            })),
            alert_rules: [],
            suppressions: [],
            alerts_summary: { total: summary.open_alert_count, open: summary.open_alert_count, critical_open: summary.critical_alert_count },
            tickets_summary: { total: summary.open_ticket_count, open: summary.open_ticket_count },
            last_reports: [],
          },
          fromMock: true,
        };
      }
      throw error;
    }
  },
};
