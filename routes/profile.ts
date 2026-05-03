import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  matchParticipantsTable,
  matchesTable,
} from "@workspace/db";
import { toUserDto } from "../src/lib/users";
import { requireAuth } from "../src/middlewares/auth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;

  const joined = await db
    .select({
      id: matchesTable.id,
      name: matchesTable.name,
      type: matchesTable.type,
      entryFee: matchesTable.entryFee,
      prize: matchesTable.prize,
      status: matchesTable.status,
      winnerUserId: matchesTable.winnerUserId,
      joinedAt: matchParticipantsTable.joinedAt,
    })
    .from(matchParticipantsTable)
    .innerJoin(matchesTable, eq(matchesTable.id, matchParticipantsTable.matchId))
    .where(eq(matchParticipantsTable.userId, userId))
    .orderBy(desc(matchParticipantsTable.joinedAt));

  res.json({
    user: toUserDto(req.user!),
    joinedMatches: joined.map((j) => ({
      id: j.id,
      name: j.name,
      type: j.type,
      entryFee: j.entryFee,
      prize: j.prize,
      status: j.status,
      wonByMe: j.winnerUserId === userId,
      joinedAt: j.joinedAt.toISOString(),
    })),
  });
});

export default router;
