import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

export async function getHealthStatus() {
  await pool.query("select 1");
  return HealthCheckResponse.parse({ status: "ok" });
}
