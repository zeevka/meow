import { apiJson } from "@/lib/http";
import type { DashboardPayload } from "@/lib/types";

export async function fetchDashboardPayload(): Promise<DashboardPayload> {
  return apiJson<DashboardPayload>("/api/dashboard", {
    method: "GET",
  });
}
