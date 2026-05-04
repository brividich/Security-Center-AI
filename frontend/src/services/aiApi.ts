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

export async function chatWithAI(
  message: string,
  history: ChatMessage[] = []
): Promise<{ message: string; model: string }> {
  return securityApiFetch<{ message: string; model: string }>("/api/security/ai/chat/", {
    method: "POST",
    body: JSON.stringify({ message, history }),
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
