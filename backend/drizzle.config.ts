import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";

process.loadEnvFile?.(".env");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: fileURLToPath(new URL("./models/schema/index.ts", import.meta.url)),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
