import session from "express-session";
import type { RequestHandler } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const secret = process.env["SESSION_SECRET"];
if (!secret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const isProd = process.env["NODE_ENV"] === "production";

export const sessionMiddleware: RequestHandler = session({
  name: "arena.sid",
  secret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
});
