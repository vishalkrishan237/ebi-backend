import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "../routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";

const app: Express = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "../../frontend/dist");
const hasFrontendBuild = existsSync(webRoot);
const configuredOrigins = (process.env["CORS_ORIGINS"] ?? process.env["FRONTEND_ORIGIN"] ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / non-browser requests with no Origin header.
      if (!origin) return cb(null, true);
      if (configuredOrigins.includes(origin)) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        if (
          host === "localhost" ||
          host === "127.0.0.1" ||
          host.endsWith(".replit.dev") ||
          host.endsWith(".repl.co") ||
          host.endsWith(".replit.app") ||
          host.endsWith(".replit.com") ||
          host.endsWith(".vercel.app") ||
          host.endsWith(".netlify.app")
        ) {
          return cb(null, true);
        }
      } catch {
        // fall through
      }
      cb(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(sessionMiddleware);

app.use("/api", router);

if (hasFrontendBuild) {
  app.use(express.static(webRoot));

  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(webRoot, "index.html"));
  });
}

app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
