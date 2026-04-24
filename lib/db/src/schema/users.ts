import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    freeFireUid: text("free_fire_uid").notNull(),
    passwordHash: text("password_hash").notNull(),
    coinBalance: integer("coin_balance").notNull().default(1000),
    isAdmin: boolean("is_admin").notNull().default(false),
    isBanned: boolean("is_banned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    usernameIdx: uniqueIndex("users_username_idx").on(t.username),
    coinBalanceCheck: check("users_coin_balance_nonneg", sql`${t.coinBalance} >= 0`),
  }),
);

export type UserRow = typeof usersTable.$inferSelect;
