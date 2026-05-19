import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, usersTable, matchesTable } from "../models/index.js";

const router: IRouter = Router();

router.get("/leaderboard", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      userId: usersTable.id,
      username: usersTable.username,
      freeFireUid: usersTable.freeFireUid,
      coinBalance: usersTable.coinBalance,
      wins: sql<number>`COALESCE(COUNT(${matchesTable.id}), 0)::int`,
      totalPrize: sql<number>`COALESCE(SUM(${matchesTable.prize}), 0)::int`,
    })
    .from(usersTable)
    .leftJoin(
      matchesTable,
      sql`${matchesTable.winnerUserId} = ${usersTable.id} AND ${matchesTable.status} = 'completed'`,
    )
    .groupBy(usersTable.id)
    .orderBy(
      desc(sql`COALESCE(SUM(${matchesTable.prize}), 0)`),
      desc(sql`COALESCE(COUNT(${matchesTable.id}), 0)`),
      desc(usersTable.coinBalance),
    )
    .limit(50);

  res.json(
    rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      freeFireUid: r.freeFireUid,
      wins: r.wins,
      totalPrize: r.totalPrize,
      coinBalance: r.coinBalance,
    })),
  );
});

export default router;
