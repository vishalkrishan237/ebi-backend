import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default("1 kill = 10 coins, Booyah = 80 coins."),
  type: text("type").notNull(), // 'paid' | 'free'
  entryFee: integer("entry_fee").notNull().default(0),
  entryFeeInr: integer("entry_fee_inr").notNull().default(0),
  prize: integer("prize").notNull().default(0),
  slots: integer("slots").notNull(),
  slotsTaken: integer("slots_taken").notNull().default(0),
  minPlayersToStart: integer("min_players_to_start").notNull().default(30),
  teamSize: integer("team_size").notNull().default(1),
  mode: text("mode").notNull().default("solo"),
  isCaptainEntryOnly: boolean("is_captain_entry_only").notNull().default(false),
  payoutPerKill: integer("payout_per_kill").notNull().default(10),
  booyahBonus: integer("booyah_bonus").notNull().default(80),
  status: text("status").notNull().default("open"), // 'open' | 'live' | 'completed'
  winnerUserId: integer("winner_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MatchRow = typeof matchesTable.$inferSelect;
