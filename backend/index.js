import { existsSync } from "node:fs";
import { resolve } from "node:path";

process.loadEnvFile?.(".env");

const bundlePath = resolve("dist", "index.mjs");

if (!existsSync(bundlePath)) {
  throw new Error(
    "Missing dist/index.mjs. Run `npm run build` before starting the backend.",
  );
}

const { startServer } = await import("./dist/index.mjs");

await startServer();
