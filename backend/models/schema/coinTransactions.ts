import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const coinTransactionsTable = pgTable("coin_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(), // positive = earn, negative = spend
  reason: text("reason").notNull(),
  matchId: integer("match_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
