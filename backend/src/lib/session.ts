import session from "express-session";
import type { RequestHandler } from "express";
import { pool } from "@workspace/db";
import { PgSessionStore } from "./session-store";

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
const frontendOrigin = process.env["FRONTEND_ORIGIN"]?.trim();
const crossSiteSession = Boolean(isProd && frontendOrigin);

void pool.query(`
  create table if not exists app_sessions (
    sid text primary key,
    sess jsonb not null,
    expire timestamptz not null
  );

  create index if not exists app_sessions_expire_idx on app_sessions(expire);
`);

export const sessionMiddleware: RequestHandler = session({
  name: "arena.sid",
  secret,
  store: new PgSessionStore(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  unset: "destroy",
  cookie: {
    httpOnly: true,
    sameSite: crossSiteSession ? "none" : "strict",
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
});
