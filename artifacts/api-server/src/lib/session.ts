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

export const sessionMiddleware: RequestHandler = session({
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
});
