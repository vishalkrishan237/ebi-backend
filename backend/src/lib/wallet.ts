import { eq } from "drizzle-orm";
import {
  walletEntriesTable,
  usersTable,
  db,
} from "@workspace/db";
import type { AuditContext } from "./audit";
import { logAuditEvent } from "./audit";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function postWalletEntry(
  tx: Tx,
  ctx: AuditContext,
  input: {
    userId: number;
    direction: "credit" | "debit";
    amount: number;
    reason: string;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  },
) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Wallet amount must be a positive integer");
  }

  const [existing] = await tx
    .select()
    .from(walletEntriesTable)
    .where(eq(walletEntriesTable.idempotencyKey, input.idempotencyKey));

  if (existing) {
    return existing;
  }

  const [user] = await tx
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, input.userId))
    .for("update");

  if (!user) {
    throw new Error("User not found");
  }

  const signedAmount =
    input.direction === "credit" ? input.amount : -input.amount;
  const balanceAfter = user.coinBalance + signedAmount;

  if (balanceAfter < 0) {
    throw new Error("Insufficient wallet balance");
  }

  await tx
    .update(usersTable)
    .set({ coinBalance: balanceAfter })
    .where(eq(usersTable.id, user.id));

  const [entry] = await tx
    .insert(walletEntriesTable)
    .values({
      userId: input.userId,
      direction: input.direction,
      amount: input.amount,
      balanceAfter,
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? {},
    })
    .returning();

  await logAuditEvent(tx, ctx, {
    eventType: "wallet.entry.posted",
    entityType: "wallet_entry",
    entityId: String(entry!.id),
    payload: {
      userId: input.userId,
      direction: input.direction,
      amount: input.amount,
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      balanceAfter,
    },
  });

  return entry!;
}
