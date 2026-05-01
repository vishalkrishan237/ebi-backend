import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { matchesTable } from "./matches";
import { usersTable } from "./users";

export const matchParticipantsTable = pgTable(
  "match_participants",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull().references(() => matchesTable.id, {
      onDelete: "cascade",
    }),
    userId: integer("user_id").notNull().references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("match_participants_match_user_idx").on(t.matchId, t.userId),
  }),
);
