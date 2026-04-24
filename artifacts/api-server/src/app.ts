import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/session";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";

const app: Express = express();

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
      try {
        const host = new URL(origin).hostname;
        if (
          host === "localhost" ||
          host === "127.0.0.1" ||
          host.endsWith(".replit.dev") ||
          host.endsWith(".repl.co") ||
          host.endsWith(".replit.app") ||
          host.endsWith(".replit.com")
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

app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
