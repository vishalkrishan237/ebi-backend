import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, {
    onDelete: "restrict",
  }),
  code: text("code").notNull().unique(),
  coinCost: integer("coin_cost").notNull(),
  valueInr: integer("value_inr").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CouponRow = typeof couponsTable.$inferSelect;
