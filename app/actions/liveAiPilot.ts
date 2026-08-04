"use server";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";

export type LiveAiPilotStatus = {
  enabled: boolean;
  provider: string;
  model: string;
  credentialConfigured: boolean;
  syntheticEnabled: boolean;
  nonConfidentialEnabled: boolean;
  proposalSourceEnabled: boolean;
  killSwitch: boolean;
  inputTokenLimit: number;
  outputTokenLimit: number;
  commercialSpendCap: null;
  proposalMutation: false;
  publication: false;
};

export const getLiveAiPilotStatus =
  async (): Promise<LiveAiPilotStatus | null> => {
    try {
      const base = BACKEND_URL.endsWith("/api")
        ? BACKEND_URL
        : `${BACKEND_URL}/api`;
      const response = await authenticatedBackendFetch(
        `${base}/v1/ai/pilot/status`,
        {
          cache: "no-store",
          headers: { "X-Correlation-ID": crypto.randomUUID() },
        },
      );
      if (!response.ok) return null;
      return (await response.json()).data as LiveAiPilotStatus;
    } catch {
      return null;
    }
  };
