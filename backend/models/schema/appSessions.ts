import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const appSessionsTable = pgTable("app_sessions", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull(),
});
