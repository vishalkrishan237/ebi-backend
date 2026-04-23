import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, matchesTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/matches/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: matchesTable.id,
      name: matchesTable.name,
      type: matchesTable.type,
      entryFee: matchesTable.entryFee,
      prize: matchesTable.prize,
      slots: matchesTable.slots,
      slotsTaken: matchesTable.slotsTaken,
      winnerUserId: matchesTable.winnerUserId,
      winnerUsername: usersTable.username,
      winnerFreeFireUid: usersTable.freeFireUid,
      startsAt: matchesTable.startsAt,
    })
    .from(matchesTable)
    .leftJoin(usersTable, eq(usersTable.id, matchesTable.winnerUserId))
    .where(eq(matchesTable.status, "completed"))
    .orderBy(desc(matchesTable.startsAt))
    .limit(50);

  res.json(
    rows.map((r) => ({
      ...r,
      startsAt: r.startsAt.toISOString(),
    })),
  );
});

export default router;
