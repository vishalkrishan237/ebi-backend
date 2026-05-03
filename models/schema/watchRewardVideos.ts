import { pgTable, serial, integer, text, boolean, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const watchRewardVideosTable = pgTable(
  "watch_reward_videos",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    videoUrl: text("video_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    durationSeconds: integer("duration_seconds").notNull(),
    rewardCoins: integer("reward_coins").notNull(),
    cooldownHours: integer("cooldown_hours").notNull().default(24),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    durationCheck: check(
      "watch_reward_videos_duration_range",
      sql`${t.durationSeconds} between 30 and 60`,
    ),
    rewardCheck: check(
      "watch_reward_videos_reward_range",
      sql`${t.rewardCoins} between 10 and 20`,
    ),
    cooldownCheck: check(
      "watch_reward_videos_cooldown_nonneg",
      sql`${t.cooldownHours} >= 0`,
    ),
  }),
);
