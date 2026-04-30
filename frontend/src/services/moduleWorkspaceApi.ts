import {
  fetchConfigurationNotifications,
  fetchConfigurationRules,
  fetchConfigurationSources,
  fetchConfigurationSuppressions,
} from "./configurationApi";
import { buildModuleWorkspaces } from "../utils/moduleAggregation";
import type { ModuleWorkspaceData } from "../types/modules";

export async function fetchModuleWorkspaces(): Promise<ModuleWorkspaceData[]> {
  try {
    const [sources, rules, notifications, suppressions] = await Promise.all([
      fetchConfigurationSources(),
      fetchConfigurationRules(),
      fetchConfigurationNotifications(),
      fetchConfigurationSuppressions(),
    ]);
    return buildModuleWorkspaces(sources, rules, notifications, suppressions);
  } catch (error) {
    console.warn("Impossibile caricare le Aree Modulo dal backend:", error);
    return buildModuleWorkspaces([], [], [], []);
  }
}
