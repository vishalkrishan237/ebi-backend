import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  matchParticipantsTable,
  matchesTable,
} from "@workspace/db";
import { toUserDto } from "../lib/users";

const router: IRouter = Router();

router.get("/profile", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

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
    user: toUserDto(user),
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
