import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const matchParticipantsTable = pgTable(
  "match_participants",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    userId: integer("user_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("match_participants_match_user_idx").on(t.matchId, t.userId),
  }),
);
