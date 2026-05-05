import { securityApiFetch } from "./securityApiClient.csrf";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIAnalysis {
  summary: string;
  vulnerabilities: Array<{
    cve: string;
    severity: string;
    asset: string;
    description: string;
  }>;
  recommendations: string[];
  risks: string[];
  suggested_actions: string[];
}

export interface AISuggestion {
  rule_name: string;
  condition: string;
  severity: string;
  description: string;
  recommended_actions: string[];
  rationale: string;
}

export interface AIEventAnalysis {
  patterns: string[];
  anomalies: Array<{
    event_id: string;
    description: string;
  }>;
  correlations: string[];
  potential_threats: string[];
  recommendations: string[];
}

export interface AIUsageMetrics {
  total_queries: number;
  successful_queries: number;
  failed_queries: number;
  avg_response_time: number;
  analyses_completed: number;
}

export interface AIUsageSummary extends AIUsageMetrics {
  recent_analyses: Array<{
    id: number;
    title: string;
    description: string;
    created_at: string;
    status: "completed" | "in_progress" | "failed";
  }>;
}

export interface AIProviderStatus {
  provider: string;
  configured: boolean;
  model: string;
  fast_model: string;
  base_url: string;
  api_key_present: boolean;
  api_key_label: "configured" | "missing" | "placeholder";
  status: "ok" | "warning" | "error" | "not_configured";
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string;
  recent_success_count: number;
  recent_error_count: number;
  avg_latency_ms: number;
}

export interface AIOperationsSummary {
  provider_status: AIProviderStatus;
  usage_summary: AIUsageMetrics;
  recent_interactions: Array<{
    id: number;
    action: string;
    provider: string;
    model: string;
    status: string;
    page: string;
    object_type: string;
    object_id: string;
    request_chars: number;
    response_chars: number;
    latency_ms: number;
    created_at: string;
  }>;
  supported_contexts: Array<{
    type: string;
    label: string;
    enabled: boolean;
  }>;
  quick_actions: Array<{
    key: string;
    label: string;
    context_type: string;
  }>;
  safety: {
    redaction_enabled: boolean;
    context_builder_enabled: boolean;
    audit_log_enabled: boolean;
    stores_full_prompts: boolean;
    stores_full_responses: boolean;
  };
}

export async function chatWithAI(
  message: string,
  history: ChatMessage[] = [],
  context?: { object_type?: string; object_id?: string | number }
): Promise<{ message: string; model: string }> {
  return securityApiFetch<{ message: string; model: string }>("/api/security/ai/chat/", {
    method: "POST",
    body: JSON.stringify({ message, history, context }),
  });
}

export async function analyzeReport(
  reportId: string,
  content: string
): Promise<{ report_id: string; analysis: AIAnalysis }> {
  return securityApiFetch<{ report_id: string; analysis: AIAnalysis }>(
    "/api/security/ai/analyze-report/",
    {
      method: "POST",
      body: JSON.stringify({ report_id: reportId, content }),
    }
  );
}

export async function suggestAlertRule(
  context: string
): Promise<{ suggestion: AISuggestion }> {
  return securityApiFetch<{ suggestion: AISuggestion }>(
    "/api/security/ai/suggest-alert-rule/",
    {
      method: "POST",
      body: JSON.stringify({ context }),
    }
  );
}

export async function analyzeEvents(
  events: any[]
): Promise<{ analysis: AIEventAnalysis }> {
  return securityApiFetch<{ analysis: AIEventAnalysis }>(
    "/api/security/ai/analyze-events/",
    {
      method: "POST",
      body: JSON.stringify({ events }),
    }
  );
}

export async function generateSummary(
  data: any
): Promise<{ summary: string }> {
  return securityApiFetch<{ summary: string }>(
    "/api/security/ai/generate-summary/",
    {
      method: "POST",
      body: JSON.stringify({ data }),
    }
  );
}

export async function getAIUsageSummary(): Promise<AIUsageSummary> {
  return securityApiFetch<AIUsageSummary>("/api/security/ai/usage-summary/");
}

export async function getAIProviderStatus(): Promise<AIProviderStatus> {
  return securityApiFetch<AIProviderStatus>("/api/security/ai/provider-status/");
}

export async function getAIOperationsSummary(): Promise<AIOperationsSummary> {
  return securityApiFetch<AIOperationsSummary>("/api/security/ai/operations-summary/");
}
