import { apiClient } from "./apiClient";
import type { AddonDetail, AddonRegistryResponse, AddonSummary } from "../types/security";

export const securityApi = {
  async getAddons(): Promise<AddonSummary[]> {
    const data = await apiClient.get<AddonRegistryResponse>("/api/security/addons/");
    return data.addons;
  },

  async getAddonDetail(code: string): Promise<AddonDetail> {
    return apiClient.get<AddonDetail>(`/api/security/addons/${code}/`);
  },
};
