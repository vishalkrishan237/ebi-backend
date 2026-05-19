import app from "./app";
import type { Server } from "node:http";
import { logger } from "./lib/logger";
import { ensureDatabaseReady, pool } from "@workspace/db";
import { initializeSessionStore } from "./lib/session";

export async function startServer(): Promise<void> {
  const rawPort = process.env["PORT"] ?? "8081";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  await ensureDatabaseReady();
  await initializeSessionStore();

  const server = await new Promise<Server>((resolve, reject) => {
    const nextServer = app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }

      logger.info({ port }, "Server listening");
      resolve(nextServer);
    });
  });

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info({ signal }, "Shutting down server");

    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) {
          logger.error({ err, signal }, "Error while closing HTTP server");
        }
        resolve();
      });
    });

    try {
      await pool.end();
    } catch (err) {
      logger.error({ err, signal }, "Error while closing database pool");
    }

    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}
