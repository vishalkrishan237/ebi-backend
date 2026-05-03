import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { matchesTable } from "./matches";
import { usersTable } from "./users";

export const matchSquadsTable = pgTable(
  "match_squads",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull().references(() => matchesTable.id, {
      onDelete: "cascade",
    }),
    captainUserId: integer("captain_user_id").notNull().references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    teamName: text("team_name").notNull(),
    inviteCode: text("invite_code").notNull(),
    side: text("side").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    inviteCodeIdx: uniqueIndex("match_squads_invite_code_idx").on(t.inviteCode),
    captainPerMatchIdx: uniqueIndex("match_squads_match_captain_idx").on(t.matchId, t.captainUserId),
    sidePerMatchIdx: uniqueIndex("match_squads_match_side_idx").on(t.matchId, t.side),
  }),
);

export const matchSquadMembersTable = pgTable(
  "match_squad_members",
  {
    id: serial("id").primaryKey(),
    squadId: integer("squad_id").notNull().references(() => matchSquadsTable.id, {
      onDelete: "cascade",
    }),
    userId: integer("user_id").notNull().references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    squadUserIdx: uniqueIndex("match_squad_members_squad_user_idx").on(t.squadId, t.userId),
    userIdx: uniqueIndex("match_squad_members_user_idx").on(t.userId),
  }),
);
