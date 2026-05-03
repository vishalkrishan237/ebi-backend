import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { watchRewardVideosTable } from "./watchRewardVideos";
import { walletEntriesTable } from "./walletEntries";

export const watchRewardSessionsTable = pgTable(
  "watch_reward_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    videoId: integer("video_id").notNull().references(() => watchRewardVideosTable.id, {
      onDelete: "cascade",
    }),
    sessionToken: text("session_token").notNull(),
    unlocksAt: timestamp("unlocks_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    walletEntryId: integer("wallet_entry_id").references(() => walletEntriesTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("watch_reward_sessions_token_idx").on(t.sessionToken),
  }),
);
