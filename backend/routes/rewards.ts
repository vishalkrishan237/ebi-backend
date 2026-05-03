import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, matchesTable, walletEntriesTable } from "@workspace/db";
import { requireAuth } from "../src/middlewares/auth";

const router: IRouter = Router();

router.get("/rewards", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: walletEntriesTable.id,
      amount: walletEntriesTable.amount,
      direction: walletEntriesTable.direction,
      reason: walletEntriesTable.reason,
      sourceType: walletEntriesTable.sourceType,
      sourceId: walletEntriesTable.sourceId,
      matchName: matchesTable.name,
      createdAt: walletEntriesTable.createdAt,
    })
    .from(walletEntriesTable)
    .leftJoin(
      matchesTable,
      sql`${matchesTable.id} = case
        when ${walletEntriesTable.sourceType} in ('match_join', 'match_prize', 'match_refund')
        then ${walletEntriesTable.sourceId}::int
        else null
      end`,
    )
    .where(eq(walletEntriesTable.userId, req.userId!))
    .orderBy(desc(walletEntriesTable.createdAt));

  res.json(
    rows.map((r) => ({
      id: r.id,
      amount: r.direction === "credit" ? r.amount : -r.amount,
      reason: r.reason,
      matchId:
        r.sourceType === "match_join" ||
        r.sourceType === "match_prize" ||
        r.sourceType === "match_refund"
          ? Number(r.sourceId)
          : null,
      matchName: r.matchName ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
