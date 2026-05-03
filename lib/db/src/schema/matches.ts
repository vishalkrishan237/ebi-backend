import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'paid' | 'free'
  entryFee: integer("entry_fee").notNull().default(0),
  prize: integer("prize").notNull().default(0),
  slots: integer("slots").notNull(),
  slotsTaken: integer("slots_taken").notNull().default(0),
  status: text("status").notNull().default("open"), // 'open' | 'live' | 'completed'
  winnerUserId: integer("winner_user_id"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MatchRow = typeof matchesTable.$inferSelect;
