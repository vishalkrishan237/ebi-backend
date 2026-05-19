import { createHash } from "node:crypto";
import type { Request } from "express";
import { auditEventsTable, db } from "../../models/index.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export type AuditContext = {
  actorUserId: number | null;
  ipHash: string | null;
  userAgent: string | null;
};

export function buildAuditContext(req: Request): AuditContext {
  const rawIp = req.ip || req.socket.remoteAddress || null;
  const ipHash = rawIp
    ? createHash("sha256").update(rawIp).digest("hex")
    : null;

  return {
    actorUserId: req.userId ?? req.session.userId ?? null,
    ipHash,
    userAgent: req.get("user-agent") ?? null,
  };
}

export async function logAuditEvent(
  tx: Tx,
  ctx: AuditContext,
  input: {
    eventType: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(auditEventsTable).values({
    actorUserId: ctx.actorUserId,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
    payload: input.payload ?? {},
  });
}
