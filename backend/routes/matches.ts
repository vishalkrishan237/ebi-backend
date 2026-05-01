import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  matchesTable,
  matchParticipantsTable,
  matchSquadsTable,
  matchSquadMembersTable,
  usersTable,
} from "@workspace/db";
import {
  CreateMatchBody,
  GetMatchParams,
  JoinMatchParams,
  DeclareWinnerParams,
  DeclareWinnerBody,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { buildAuditContext } from "../lib/audit";
import { postWalletEntry } from "../lib/wallet";
import { DEFAULT_MATCH_DESCRIPTION } from "../lib/ebi-config";

const router: IRouter = Router();

const RegisterSquadBody = z.object({
  teamName: z.string().trim().min(3).max(40),
});

const JoinSquadBody = z.object({
  inviteCode: z.string().trim().min(8).max(64),
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
          error: "This squad match requires captain registration and invite links",
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
      await tx.insert(matchSquadMembersTable).values({
        squadId: squad!.id,
        userId: user.id,
      });

      const [updatedMatch] = await tx
        .update(matchesTable)
        .set({ slotsTaken: match.slotsTaken + 1 })
        .where(eq(matchesTable.id, match.id))
        .returning();

      return {
        ok: true as const,
        squadId: squad!.id,
        inviteCode,
        teamName: squad!.teamName,
        side: squad!.side,
        match: serializeMatch(updatedMatch!),
      };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({
      ...result,
      inviteUrl: `${req.protocol}://${req.get("host")}/matches/${params.data.id}?invite=${result.inviteCode}`,
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
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = JoinSquadBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

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

    const [squad] = await tx
      .select()
      .from(matchSquadsTable)
      .where(
        and(
          eq(matchSquadsTable.matchId, match.id),
          eq(matchSquadsTable.inviteCode, body.data.inviteCode),
        ),
      )
      .for("update");

    if (!squad) return { ok: false as const, status: 404, error: "Invite link is invalid" };

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

    const squadMembers = await tx
      .select({ id: matchSquadMembersTable.id })
      .from(matchSquadMembersTable)
      .where(eq(matchSquadMembersTable.squadId, squad.id));
    if (squadMembers.length >= match.teamSize) {
      return { ok: false as const, status: 400, error: "This squad is already full" };
    }

    if (match.slotsTaken >= match.slots) {
      return { ok: false as const, status: 400, error: "Match is full" };
    }

    await tx.insert(matchParticipantsTable).values({
      matchId: match.id,
      userId: req.userId!,
    });
    await tx.insert(matchSquadMembersTable).values({
      squadId: squad.id,
      userId: req.userId!,
    });

    const [updatedMatch] = await tx
      .update(matchesTable)
      .set({
        slotsTaken: match.slotsTaken + 1,
        ...(match.slotsTaken + 1 >= match.slots ? { status: "live" as const } : {}),
      })
      .where(eq(matchesTable.id, match.id))
      .returning();

    return { ok: true as const, match: serializeMatch(updatedMatch!) };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(result);
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
