import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { walletEntriesTable } from "./walletEntries";

export const referralRewardsTable = pgTable(
  "referral_rewards",
  {
    id: serial("id").primaryKey(),
    referrerUserId: integer("referrer_user_id").notNull().references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    referredUserId: integer("referred_user_id").notNull().references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    walletEntryId: integer("wallet_entry_id").notNull().references(() => walletEntriesTable.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    referredUserIdx: uniqueIndex("referral_rewards_referred_user_idx").on(t.referredUserId),
    referrerPairIdx: uniqueIndex("referral_rewards_referrer_pair_idx").on(
      t.referrerUserId,
      t.referredUserId,
    ),
  }),
);
