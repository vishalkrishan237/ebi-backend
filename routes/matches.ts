import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  matchesTable,
  matchParticipantsTable,
  matchSquadsTable,
  matchSquadMembersTable,
  usersTable,
} from "../models/index.js";
import {
  CreateMatchBody,
  GetMatchParams,
  JoinMatchParams,
  DeclareWinnerParams,
  DeclareWinnerBody,
} from "../src/lib/api-zod/index.js";
import { requireAuth, requireAdmin } from "../src/middlewares/auth.js";
import { buildAuditContext } from "../src/lib/audit.js";
import { postWalletEntry } from "../src/lib/wallet.js";
import { DEFAULT_MATCH_DESCRIPTION } from "../src/lib/ebi-config.js";

const router: IRouter = Router();

const RegisterSquadBody = z.object({
  teamName: z.string().trim().min(3).max(40),
  teammateUids: z.array(z.string().trim().min(6).max(15).regex(/^[0-9]+$/)).length(3),
});

function serializeMatch(m: typeof matchesTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    type: m.type,
    entryFee: m.entryFee,
    entryFeeInr: m.entryFeeInr,
    prize: m.prize,
    slots: m.slots,
    slotsTaken: m.slotsTaken,
    minPlayersToStart: m.minPlayersToStart,
    teamSize: m.teamSize,
    mode: m.mode,
    isCaptainEntryOnly: m.isCaptainEntryOnly,
    payoutPerKill: m.payoutPerKill,
    booyahBonus: m.booyahBonus,
    status: m.status,
    winnerUserId: m.winnerUserId,
    startsAt: m.startsAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/matches", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(matchesTable)
    .orderBy(desc(matchesTable.createdAt));
  res.json(rows.map(serializeMatch));
});

router.post("/matches", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    name,
    type,
    entryFee,
    prize,
    slots,
    startsAt,
    description,
    entryFeeInr,
    minPlayersToStart,
    teamSize,
    mode,
    isCaptainEntryOnly,
  } = parsed.data;
  const startsAtDate = new Date(startsAt);

  if (Number.isNaN(startsAtDate.getTime())) {
    res.status(400).json({ error: "Invalid startsAt" });
    return;
  }

  if (type === "paid" && entryFee <= 0) {
    res.status(400).json({ error: "Paid matches must have a positive entry fee" });
    return;
  }

  const [created] = await db
    .insert(matchesTable)
    .values({
      name: name.trim(),
      description: description?.trim() || DEFAULT_MATCH_DESCRIPTION,
      type,
      entryFee: type === "free" ? 0 : entryFee,
      entryFeeInr: type === "free" ? 0 : (entryFeeInr ?? 0),
      prize,
      slots,
      slotsTaken: 0,
      minPlayersToStart: minPlayersToStart ?? Math.min(30, slots),
      teamSize: teamSize ?? 1,
      mode: mode ?? "solo",
      isCaptainEntryOnly: isCaptainEntryOnly ?? false,
      payoutPerKill: 10,
      booyahBonus: 80,
      status: "open",
      startsAt: startsAtDate,
    })
    .returning();

  if (!created) {
    res.status(500).json({ error: "Failed to create match" });
    return;
  }

  res.json(serializeMatch(created));
});

router.get("/matches/:id", async (req, res): Promise<void> => {
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, params.data.id));

  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const participants = await db
    .select({
      userId: matchParticipantsTable.userId,
      username: usersTable.username,
      freeFireUid: usersTable.freeFireUid,
      joinedAt: matchParticipantsTable.joinedAt,
    })
    .from(matchParticipantsTable)
    .innerJoin(usersTable, eq(usersTable.id, matchParticipantsTable.userId))
    .where(eq(matchParticipantsTable.matchId, match.id));

  const sessionUserId = req.session.userId;
  const joinedByMe =
    sessionUserId != null && participants.some((p) => p.userId === sessionUserId);

  let winnerUsername: string | null = null;
  if (match.winnerUserId != null) {
    const [winner] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, match.winnerUserId));
    winnerUsername = winner?.username ?? null;
  }

  type SquadView = {
    id: number;
    teamName: string;
    side: string;
    captainUserId: number;
    inviteCode: string | null;
    members: Array<{
      userId: number;
      username: string;
      freeFireUid: string;
    }>;
  };

  let squads: SquadView[] | undefined;

  if (match.mode === "squad") {
    const squadRows = await db
      .select({
        squadId: matchSquadsTable.id,
        teamName: matchSquadsTable.teamName,
        side: matchSquadsTable.side,
        captainUserId: matchSquadsTable.captainUserId,
        inviteCode: matchSquadsTable.inviteCode,
        userId: usersTable.id,
        username: usersTable.username,
        freeFireUid: usersTable.freeFireUid,
      })
      .from(matchSquadsTable)
      .leftJoin(matchSquadMembersTable, eq(matchSquadMembersTable.squadId, matchSquadsTable.id))
      .leftJoin(usersTable, eq(usersTable.id, matchSquadMembersTable.userId))
      .where(eq(matchSquadsTable.matchId, match.id));

    const squadMap = new Map<number, SquadView>();
    for (const row of squadRows) {
      const existingSquad = squadMap.get(row.squadId) ?? {
        id: row.squadId,
        teamName: row.teamName,
        side: row.side,
        captainUserId: row.captainUserId,
        inviteCode: row.captainUserId === sessionUserId ? row.inviteCode : null,
        members: [],
      };
      if (row.userId != null) {
        existingSquad.members.push({
          userId: row.userId,
          username: row.username!,
          freeFireUid: row.freeFireUid!,
        });
      }
      squadMap.set(row.squadId, existingSquad);
    }
    squads = Array.from(squadMap.values());
  }

  res.json({
    ...serializeMatch(match),
    participants: participants.map((p) => ({
      userId: p.userId,
      username: p.username,
      freeFireUid: p.freeFireUid,
      joinedAt: p.joinedAt.toISOString(),
    })),
    joinedByMe,
    winnerUsername,
    squads,
  });
});

router.post("/matches/:id/join", requireAuth, async (req, res): Promise<void> => {
  const params = JoinMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const couponCodeRaw =
    typeof req.body?.couponCode === "string" ? req.body.couponCode.trim() : "";

  if (couponCodeRaw.length > 0) {
    res.status(400).json({
      error: "Coupons are reward vouchers and cannot be used for match entry.",
    });
    return;
  }

  const userId = req.userId!;
  const auditContext = buildAuditContext(req);

  try {
    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.id, params.data.id))
        .for("update");

      if (!match) {
        return { ok: false as const, status: 404, error: "Match not found" };
      }

      if (match.status !== "open") {
        return { ok: false as const, status: 400, error: "Match is closed" };
      }
      if (match.isCaptainEntryOnly) {
        return {
          ok: false as const,
          status: 400,
          error: "This squad match requires captain registration with teammate UIDs",
        };
      }

      if (match.slotsTaken >= match.slots) {
        return { ok: false as const, status: 400, error: "Match is full" };
      }

      const existing = await tx
        .select({ id: matchParticipantsTable.id })
        .from(matchParticipantsTable)
        .where(
          and(
            eq(matchParticipantsTable.matchId, match.id),
            eq(matchParticipantsTable.userId, userId),
          ),
        );

      if (existing.length > 0) {
        return { ok: false as const, status: 400, error: "Already joined this match" };
      }

      const [user] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .for("update");

      if (!user) {
        return { ok: false as const, status: 404, error: "User not found" };
      }

      const finalFee = match.type === "paid" ? match.entryFee : 0;
      if (user.coinBalance < finalFee) {
        return { ok: false as const, status: 400, error: "Not enough coins" };
      }

      if (finalFee > 0) {
        await postWalletEntry(tx, auditContext, {
          userId: user.id,
          direction: "debit",
          amount: finalFee,
          reason: `Joined ${match.name}`,
          sourceType: "match_join",
          sourceId: String(match.id),
          idempotencyKey: `match-join:${match.id}:${user.id}`,
          metadata: { matchName: match.name },
        });
      }

      await tx
        .insert(matchParticipantsTable)
        .values({ matchId: match.id, userId: user.id });

      const newSlotsTaken = match.slotsTaken + 1;
      const autoClose = newSlotsTaken >= match.slots;

      const [updatedMatch] = await tx
        .update(matchesTable)
        .set({
          slotsTaken: newSlotsTaken,
          ...(autoClose ? { status: "live" as const } : {}),
        })
        .where(eq(matchesTable.id, match.id))
        .returning();

      const [refreshedUser] = await tx
        .select({ coinBalance: usersTable.coinBalance })
        .from(usersTable)
        .where(eq(usersTable.id, user.id));

      return {
        ok: true as const,
        match: updatedMatch!,
        coinBalance: refreshedUser!.coinBalance,
      };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({
      match: serializeMatch(result.match),
      coinBalance: result.coinBalance,
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(400).json({ error: "Already joined this match" });
      return;
    }

    if (err instanceof Error && err.message === "Insufficient wallet balance") {
      res.status(400).json({ error: "Not enough coins" });
      return;
    }

    throw err;
  }
});

router.post("/matches/:id/squad/register", requireAuth, async (req, res): Promise<void> => {
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RegisterSquadBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const auditContext = buildAuditContext(req);

  try {
    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.id, params.data.id))
        .for("update");

      if (!match) return { ok: false as const, status: 404, error: "Match not found" };
      if (match.status !== "open") return { ok: false as const, status: 400, error: "Match is closed" };
      if (match.mode !== "squad" || !match.isCaptainEntryOnly) {
        return { ok: false as const, status: 400, error: "This match does not use squad invites" };
      }

      const existingUserEntry = await tx
        .select({ id: matchParticipantsTable.id })
        .from(matchParticipantsTable)
        .where(
          and(
            eq(matchParticipantsTable.matchId, match.id),
            eq(matchParticipantsTable.userId, req.userId!),
          ),
        )
        .limit(1);
      if (existingUserEntry.length > 0) {
        return { ok: false as const, status: 400, error: "You are already registered for this match" };
      }

      const squads = await tx
        .select()
        .from(matchSquadsTable)
        .where(eq(matchSquadsTable.matchId, match.id));
      if (squads.length >= 2) {
        return { ok: false as const, status: 400, error: "Both squad slots are already taken" };
      }

      const [user] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, req.userId!))
        .for("update");
      if (!user) return { ok: false as const, status: 404, error: "User not found" };
      if (user.coinBalance < match.entryFee) {
        return { ok: false as const, status: 400, error: "Not enough coins" };
      }

      const teammateUids = body.data.teammateUids.map((value) => value.trim());
      if (new Set(teammateUids).size !== teammateUids.length) {
        return { ok: false as const, status: 400, error: "Each teammate UID must be unique" };
      }

      if (teammateUids.includes(user.freeFireUid)) {
        return {
          ok: false as const,
          status: 400,
          error: "Do not enter the captain UID in teammate slots",
        };
      }

      const teammateRows = await tx
        .select()
        .from(usersTable)
        .where(inArray(usersTable.freeFireUid, teammateUids));

      if (teammateRows.length !== teammateUids.length) {
        const foundUids = new Set(teammateRows.map((row) => row.freeFireUid));
        const missingUid = teammateUids.find((uid) => !foundUids.has(uid));
        return {
          ok: false as const,
          status: 400,
          error: `Player with UID ${missingUid} has not signed up yet`,
        };
      }

      const bannedTeammate = teammateRows.find((row) => row.isBanned);
      if (bannedTeammate) {
        return {
          ok: false as const,
          status: 400,
          error: `${bannedTeammate.username} is banned and cannot join this squad`,
        };
      }

      const teammateByUid = new Map(teammateRows.map((row) => [row.freeFireUid, row]));
      const orderedTeammates = teammateUids.map((uid) => teammateByUid.get(uid)!);
      const teammateIds = orderedTeammates.map((row) => row.id);
      const fullSquadUsers = [user, ...orderedTeammates];
      const fullSquadUserIds = fullSquadUsers.map((row) => row.id);

      const existingTeammateEntries = await tx
        .select({
          userId: matchParticipantsTable.userId,
          username: usersTable.username,
        })
        .from(matchParticipantsTable)
        .innerJoin(usersTable, eq(usersTable.id, matchParticipantsTable.userId))
        .where(
          and(
            eq(matchParticipantsTable.matchId, match.id),
            inArray(matchParticipantsTable.userId, teammateIds),
          ),
        );

      if (existingTeammateEntries.length > 0) {
        return {
          ok: false as const,
          status: 400,
          error: `${existingTeammateEntries[0]!.username} is already registered in this match`,
        };
      }

      const existingSquadMembers = await tx
        .select({ userId: matchSquadMembersTable.userId })
        .from(matchSquadMembersTable)
        .where(inArray(matchSquadMembersTable.userId, fullSquadUserIds));

      if (existingSquadMembers.length > 0) {
        const alreadyLockedId = existingSquadMembers[0]!.userId;
        const alreadyLockedUser = fullSquadUsers.find((member) => member.id === alreadyLockedId);
        return {
          ok: false as const,
          status: 400,
          error: `${alreadyLockedUser?.username ?? "A player"} is already locked in another squad`,
        };
      }

      await postWalletEntry(tx, auditContext, {
        userId: user.id,
        direction: "debit",
        amount: match.entryFee,
        reason: `Captain entry for ${match.name}`,
        sourceType: "squad_match_join",
        sourceId: `${match.id}:${user.id}`,
        idempotencyKey: `squad-match-join:${match.id}:${user.id}`,
        metadata: { matchName: match.name, teamName: body.data.teamName },
      });

      const inviteCode = randomBytes(8).toString("hex");
      const [squad] = await tx
        .insert(matchSquadsTable)
        .values({
          matchId: match.id,
          captainUserId: user.id,
          teamName: body.data.teamName,
          inviteCode,
          side: squads.length === 0 ? "alpha" : "bravo",
        })
        .returning();

      await tx.insert(matchParticipantsTable).values({
        matchId: match.id,
        userId: user.id,
      });
      await tx.insert(matchParticipantsTable).values(
        orderedTeammates.map((teammate) => ({
          matchId: match.id,
          userId: teammate.id,
        })),
      );
      await tx.insert(matchSquadMembersTable).values({
        squadId: squad!.id,
        userId: user.id,
      });
      await tx.insert(matchSquadMembersTable).values(
        orderedTeammates.map((teammate) => ({
          squadId: squad!.id,
          userId: teammate.id,
        })),
      );

      const [updatedMatch] = await tx
        .update(matchesTable)
        .set({ slotsTaken: match.slotsTaken + 1 + orderedTeammates.length })
        .where(eq(matchesTable.id, match.id))
        .returning();

      return {
        ok: true as const,
        squadId: squad!.id,
        teamName: squad!.teamName,
        side: squad!.side,
        members: [
          {
            userId: user.id,
            username: user.username,
            freeFireUid: user.freeFireUid,
          },
          ...orderedTeammates.map((teammate) => ({
            userId: teammate.id,
            username: teammate.username,
            freeFireUid: teammate.freeFireUid,
          })),
        ],
        match: serializeMatch(updatedMatch!),
      };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({
      ...result,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Insufficient wallet balance") {
      res.status(400).json({ error: "Not enough coins" });
      return;
    }
    throw err;
  }
});

router.post("/matches/:id/squad/join", requireAuth, async (req, res): Promise<void> => {
  res.status(400).json({
    error: "Squad invite links are disabled. Captain must register the full squad with teammate UIDs.",
  });
});

router.post(
  "/matches/:id/declare-winner",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeclareWinnerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = DeclareWinnerBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const auditContext = buildAuditContext(req);

    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.id, params.data.id))
        .for("update");

      if (!match) {
        return { ok: false as const, status: 404, error: "Match not found" };
      }

      if (match.status !== "live") {
        return {
          ok: false as const,
          status: 400,
          error: "Winner can only be declared for a live match",
        };
      }

      const [participant] = await tx
        .select({ id: matchParticipantsTable.id })
        .from(matchParticipantsTable)
        .where(
          and(
            eq(matchParticipantsTable.matchId, match.id),
            eq(matchParticipantsTable.userId, body.data.winnerUserId),
          ),
        );

      if (!participant) {
        return {
          ok: false as const,
          status: 400,
          error: "Winner is not a participant of this match",
        };
      }

      await postWalletEntry(tx, auditContext, {
        userId: body.data.winnerUserId,
        direction: "credit",
        amount: match.prize,
        reason: `Won ${match.name}`,
        sourceType: "match_prize",
        sourceId: String(match.id),
        idempotencyKey: `match-prize:${match.id}:${body.data.winnerUserId}`,
        metadata: { matchName: match.name },
      });

      const [updated] = await tx
        .update(matchesTable)
        .set({ status: "completed", winnerUserId: body.data.winnerUserId })
        .where(eq(matchesTable.id, match.id))
        .returning();

      return { ok: true as const, match: updated! };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json(serializeMatch(result.match));
  },
);

export default router;
