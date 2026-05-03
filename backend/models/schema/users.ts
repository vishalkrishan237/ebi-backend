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
    referralCode: text("referral_code").notNull(),
    referredByUserId: integer("referred_by_user_id").references((): any => usersTable.id, {
      onDelete: "set null",
    }),
    coinBalance: integer("coin_balance").notNull().default(0),
    isAdmin: boolean("is_admin").notNull().default(false),
    isBanned: boolean("is_banned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    usernameIdx: uniqueIndex("users_username_idx").on(t.username),
    freeFireUidIdx: uniqueIndex("users_free_fire_uid_idx").on(t.freeFireUid),
    referralCodeIdx: uniqueIndex("users_referral_code_idx").on(t.referralCode),
    coinBalanceCheck: check("users_coin_balance_nonneg", sql`${t.coinBalance} >= 0`),
  }),
);

export type UserRow = typeof usersTable.$inferSelect;
