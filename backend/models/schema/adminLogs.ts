import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminLogsTable = pgTable(
  "admin_logs",
  {
    id: serial("id").primaryKey(),
    adminUserId: integer("admin_user_id").notNull().references(() => usersTable.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: integer("target_id"),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("admin_logs_created_idx").on(t.createdAt),
  }),
);

export type AdminLogRow = typeof adminLogsTable.$inferSelect;
