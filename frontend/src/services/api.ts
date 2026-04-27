import {
  assets,
  days,
  evidence,
  inboxItems,
  modules,
  reports,
  rules,
  severityDistribution,
  sourcePipeline,
  timeline,
} from "../data/mockData";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const securityCenterApi = {
  baseUrl: API_BASE_URL,
  async getOverview() {
    return { modules, days, sourcePipeline, timeline, severityDistribution };
  },
  async getEvents() {
    return inboxItems;
  },
  async getAssets() {
    return assets;
  },
  async getReports() {
    return reports;
  },
  async getEvidence() {
    return evidence;
  },
  async getRules() {
    return rules;
  },
};
