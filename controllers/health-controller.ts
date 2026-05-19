import { HealthCheckResponse } from "../src/lib/api-zod/index.js";
import { pool } from "../models/index.js";

export async function getHealthStatus() {
  await pool.query("select 1");
  return HealthCheckResponse.parse({ status: "ok" });
}
