import { HealthCheckResponse } from "@workspace/api-zod";

export function getHealthStatus() {
  return HealthCheckResponse.parse({ status: "ok" });
}
