import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, coinTransactionsTable, matchesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/rewards", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: coinTransactionsTable.id,
      amount: coinTransactionsTable.amount,
      reason: coinTransactionsTable.reason,
      matchId: coinTransactionsTable.matchId,
      matchName: matchesTable.name,
      createdAt: coinTransactionsTable.createdAt,
    })
    .from(coinTransactionsTable)
    .leftJoin(matchesTable, eq(matchesTable.id, coinTransactionsTable.matchId))
    .where(eq(coinTransactionsTable.userId, req.userId!))
    .orderBy(desc(coinTransactionsTable.createdAt));

  res.json(
    rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      matchId: r.matchId,
      matchName: r.matchName,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
