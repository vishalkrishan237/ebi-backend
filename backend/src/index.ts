import app from "./app";
import { logger } from "./lib/logger";

export async function startServer(): Promise<void> {
  const rawPort = process.env["PORT"] ?? "8081";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        reject(err);
        return;
      }

      logger.info({ port }, "Server listening");
      resolve();
    });
  });
}
