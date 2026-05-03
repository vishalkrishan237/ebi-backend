import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../lib/logger";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  // Zod validation errors expose an `issues` array
  if (err && Array.isArray((err as { issues?: unknown }).issues)) {
    res
      .status(400)
      .json({ error: "Invalid request", details: (err as { issues: unknown }).issues });
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  if (err instanceof Error && err.message === "Origin not allowed by CORS") {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }

  logger.error(
    { err, method: req.method, url: req.url?.split("?")[0] },
    "Unhandled route error",
  );

  res.status(500).json({ error: "Internal server error" });
};
