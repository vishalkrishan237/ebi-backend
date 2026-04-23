import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, coinTransactionsTable, matchesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/rewards", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

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
    .where(eq(coinTransactionsTable.userId, userId))
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
