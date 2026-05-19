import { pgEnum, pgTable, serial, integer, text, timestamp, jsonb, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users.js";

export const walletEntryDirectionEnum = pgEnum("wallet_entry_direction", [
  "credit",
  "debit",
]);

export const walletEntriesTable = pgTable(
  "wallet_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    direction: walletEntryDirectionEnum("direction").notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    amountCheck: check("wallet_entries_amount_positive", sql`${t.amount} > 0`),
    balanceCheck: check("wallet_entries_balance_nonneg", sql`${t.balanceAfter} >= 0`),
    idempotencyIdx: uniqueIndex("wallet_entries_idempotency_idx").on(t.idempotencyKey),
  }),
);
