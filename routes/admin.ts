import { Router, type IRouter } from "express";
import { eq, desc, sql, or, ilike, count } from "drizzle-orm";
import {
  db,
  usersTable,
  matchesTable,
  matchParticipantsTable,
  adminLogsTable,
  walletEntriesTable,
} from "../models/index.js";
import {
  GetAdminUserParams,
  BanUserParams,
  BanUserBody,
  UnbanUserParams,
  AdjustUserCoinsParams,
  AdjustUserCoinsBody as AdjustCoinsBody,
  UpdateMatchParams,
  UpdateMatchBody,
  DeleteMatchParams,
  StartMatchParams,
  EndMatchParams,
  ListAdminUsersQueryParams as ListAdminUsersParams,
  GetAdminLogsQueryParams as GetAdminLogsParams,
} from "../src/lib/api-zod/index.js";
import { requireAdmin } from "../src/middlewares/auth.js";
import { buildAuditContext } from "../src/lib/audit.js";
import { postWalletEntry } from "../src/lib/wallet.js";
import { COIN_PACKAGES, OFFICIAL_EBI_MATCHES } from "../src/lib/ebi-config.js";

const router: IRouter = Router();

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function logAction(
  tx: Tx | typeof db,
  adminUserId: number,
  action: string,
  targetType: string | null,
  targetId: number | null,
  details: string | null,
): Promise<void> {
  await tx.insert(adminLogsTable).values({
    adminUserId,
    action,
    targetType,
    targetId,
    details,
  });
}

function serializeAdminUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    freeFireUid: u.freeFireUid,
    coinBalance: u.coinBalance,
    isAdmin: u.isAdmin,
    isBanned: u.isBanned,
    createdAt: u.createdAt.toISOString(),
  };
}

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

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [[u], [m], [a], [c], [b], [coins], logs] = await Promise.all([
    db.select({ n: count() }).from(usersTable),
    db.select({ n: count() }).from(matchesTable),
    db
      .select({ n: count() })
      .from(matchesTable)
      .where(or(eq(matchesTable.status, "open"), eq(matchesTable.status, "live"))),
    db.select({ n: count() }).from(matchesTable).where(eq(matchesTable.status, "completed")),
    db.select({ n: count() }).from(usersTable).where(eq(usersTable.isBanned, true)),
    db.select({ s: sql<number>`coalesce(sum(${usersTable.coinBalance}), 0)::int` }).from(usersTable),
    db
      .select({
        id: adminLogsTable.id,
        adminUserId: adminLogsTable.adminUserId,
        adminUsername: usersTable.username,
        action: adminLogsTable.action,
        targetType: adminLogsTable.targetType,
        targetId: adminLogsTable.targetId,
        details: adminLogsTable.details,
        createdAt: adminLogsTable.createdAt,
      })
      .from(adminLogsTable)
      .leftJoin(usersTable, eq(usersTable.id, adminLogsTable.adminUserId))
      .orderBy(desc(adminLogsTable.createdAt))
      .limit(10),
  ]);

  res.json({
    totalUsers: u?.n ?? 0,
    totalMatches: m?.n ?? 0,
    activeMatches: a?.n ?? 0,
    completedMatches: c?.n ?? 0,
    bannedUsers: b?.n ?? 0,
    coinsInCirculation: coins?.s ?? 0,
    recentLogs: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListAdminUsersParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const search = params.data.search?.trim();
  const rows = await db
    .select()
    .from(usersTable)
    .where(
      search && search.length > 0
        ? or(
            ilike(usersTable.username, `%${search}%`),
            ilike(usersTable.email, `%${search}%`),
            ilike(usersTable.freeFireUid, `%${search}%`),
            ilike(usersTable.referralCode, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(usersTable.createdAt))
    .limit(200);

  res.json(rows.map(serializeAdminUser));
});

router.get("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetAdminUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const joinedMatches = await db
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
    .where(eq(matchParticipantsTable.userId, user.id))
    .orderBy(desc(matchParticipantsTable.joinedAt));

  const coinHistory = await db
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
    .where(eq(walletEntriesTable.userId, user.id))
    .orderBy(desc(walletEntriesTable.createdAt))
    .limit(100);

  res.json({
    user: serializeAdminUser(user),
    joinedMatches: joinedMatches.map((j) => ({
      id: j.id,
      name: j.name,
      type: j.type,
      entryFee: j.entryFee,
      prize: j.prize,
      status: j.status,
      wonByMe: j.winnerUserId === user.id,
      joinedAt: j.joinedAt.toISOString(),
    })),
    coinHistory: coinHistory.map((c) => ({
      id: c.id,
      amount: c.direction === "credit" ? c.amount : -c.amount,
      reason: c.reason,
      matchId:
        c.sourceType === "match_join" ||
        c.sourceType === "match_prize" ||
        c.sourceType === "match_refund"
          ? Number(c.sourceId)
          : null,
      matchName: c.matchName ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

router.post("/admin/users/:id/ban", requireAdmin, async (req, res): Promise<void> => {
  const params = BanUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = BanUserBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (params.data.id === req.userId) {
    res.status(400).json({ error: "Cannot ban yourself" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id))
      .for("update");

    if (!target) return { ok: false as const, status: 404, error: "User not found" };
    if (target.isAdmin) {
      return { ok: false as const, status: 400, error: "Cannot ban an admin" };
    }

    const [updated] = await tx
      .update(usersTable)
      .set({ isBanned: true })
      .where(eq(usersTable.id, target.id))
      .returning();

    await logAction(
      tx,
      req.userId!,
      "user.ban",
      "user",
      target.id,
      body.data.reason?.trim() || null,
    );

    return { ok: true as const, user: updated! };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(serializeAdminUser(result.user));
});

router.post("/admin/users/:id/unban", requireAdmin, async (req, res): Promise<void> => {
  const params = UnbanUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id))
      .for("update");

    if (!target) return { ok: false as const, status: 404, error: "User not found" };

    const [updated] = await tx
      .update(usersTable)
      .set({ isBanned: false })
      .where(eq(usersTable.id, target.id))
      .returning();

    await logAction(tx, req.userId!, "user.unban", "user", target.id, null);

    return { ok: true as const, user: updated! };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(serializeAdminUser(result.user));
});

router.post("/admin/users/:id/coins", requireAdmin, async (req, res): Promise<void> => {
  const params = AdjustUserCoinsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AdjustCoinsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { amount, reason } = body.data;
  if (amount === 0) {
    res.status(400).json({ error: "Amount must be non-zero" });
    return;
  }

  const auditContext = buildAuditContext(req);

  try {
    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, params.data.id))
        .for("update");

      if (!target) return { ok: false as const, status: 404, error: "User not found" };

      await postWalletEntry(tx, auditContext, {
        userId: target.id,
        direction: amount > 0 ? "credit" : "debit",
        amount: Math.abs(amount),
        reason: `[ADMIN] ${reason.trim()}`,
        sourceType: "admin_adjustment",
        sourceId: `${req.userId}:${target.id}:${Date.now()}`,
        idempotencyKey: `admin-adjustment:${req.userId}:${target.id}:${amount}:${reason.trim()}`,
        metadata: { adminUserId: req.userId },
      });

      const [updated] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, target.id));

      await logAction(
        tx,
        req.userId!,
        amount > 0 ? "coins.add" : "coins.remove",
        "user",
        target.id,
        `${amount > 0 ? "+" : ""}${amount} - ${reason.trim()}`,
      );

      return { ok: true as const, user: updated! };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json(serializeAdminUser(result.user));
  } catch (err: any) {
    if (err instanceof Error && err.message === "Insufficient wallet balance") {
      res.status(400).json({ error: "Adjustment would make balance negative" });
      return;
    }

    throw err;
  }
});

router.patch("/admin/matches/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateMatchBody.safeParse(req.body);
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
    if (match.status === "completed") {
      return { ok: false as const, status: 400, error: "Cannot edit a completed match" };
    }
    if (match.slotsTaken > 0) {
      return {
        ok: false as const,
        status: 400,
        error: "Cannot edit a match that already has participants",
      };
    }

    const updates: Partial<typeof matchesTable.$inferInsert> = {};
    if (body.data.name !== undefined) updates.name = body.data.name.trim();
    if (body.data.type !== undefined) updates.type = body.data.type;
    if (body.data.entryFee !== undefined) updates.entryFee = body.data.entryFee;
    if (body.data.prize !== undefined) updates.prize = body.data.prize;
    if (body.data.slots !== undefined) updates.slots = body.data.slots;
    if (body.data.startsAt !== undefined) {
      const startsAt = new Date(body.data.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        return { ok: false as const, status: 400, error: "Invalid startsAt" };
      }
      updates.startsAt = startsAt;
    }

    const finalType = updates.type ?? match.type;
    const finalFee = updates.entryFee ?? match.entryFee;
    if (finalType === "paid" && finalFee <= 0) {
      return {
        ok: false as const,
        status: 400,
        error: "Paid matches must have a positive entry fee",
      };
    }
    if (finalType === "free") updates.entryFee = 0;

    const [updated] = await tx
      .update(matchesTable)
      .set(updates)
      .where(eq(matchesTable.id, match.id))
      .returning();

    await logAction(tx, req.userId!, "match.update", "match", match.id, JSON.stringify(updates));

    return { ok: true as const, match: updated! };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(serializeMatch(result.match));
});

router.post("/admin/matches/bootstrap-ebi", requireAdmin, async (req, res): Promise<void> => {
  const result = await db.transaction(async (tx) => {
    const existingMatches = await tx.select().from(matchesTable);
    const existingByName = new Map(existingMatches.map((match) => [match.name, match]));
    const reusableMatches = existingMatches.filter(
      (match) =>
        match.status === "open" &&
        match.slotsTaken === 0 &&
        !OFFICIAL_EBI_MATCHES.some((template) => template.name === match.name),
    );
    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const template of OFFICIAL_EBI_MATCHES) {
      const existing = existingByName.get(template.name);
      const startsAt = new Date(now + template.startsAtOffsetHours * 60 * 60 * 1000);

      if (existing) {
        if (existing.status === "open" && existing.slotsTaken === 0) {
          await tx
            .update(matchesTable)
            .set({
              description: template.description,
              type: template.type,
              entryFee: template.entryFee,
              entryFeeInr: template.entryFeeInr,
              prize: template.prize,
              slots: template.slots,
              minPlayersToStart: template.minPlayersToStart,
              teamSize: template.teamSize,
              mode: template.mode,
              isCaptainEntryOnly: template.isCaptainEntryOnly,
              payoutPerKill: 10,
              booyahBonus: 80,
              startsAt,
            })
            .where(eq(matchesTable.id, existing.id));
          updated += 1;
        }
        continue;
      }

      const reusable = reusableMatches.shift();
      if (reusable) {
        await tx
          .update(matchesTable)
          .set({
            name: template.name,
            description: template.description,
            type: template.type,
            entryFee: template.entryFee,
            entryFeeInr: template.entryFeeInr,
            prize: template.prize,
            slots: template.slots,
            slotsTaken: 0,
            minPlayersToStart: template.minPlayersToStart,
            teamSize: template.teamSize,
            mode: template.mode,
            isCaptainEntryOnly: template.isCaptainEntryOnly,
            payoutPerKill: 10,
            booyahBonus: 80,
            status: "open",
            winnerUserId: null,
            startsAt,
          })
          .where(eq(matchesTable.id, reusable.id));
        updated += 1;
        continue;
      }

      await tx.insert(matchesTable).values({
        name: template.name,
        description: template.description,
        type: template.type,
        entryFee: template.entryFee,
        entryFeeInr: template.entryFeeInr,
        prize: template.prize,
        slots: template.slots,
        slotsTaken: 0,
        minPlayersToStart: template.minPlayersToStart,
        teamSize: template.teamSize,
        mode: template.mode,
        isCaptainEntryOnly: template.isCaptainEntryOnly,
        payoutPerKill: 10,
        booyahBonus: 80,
        status: "open",
        startsAt,
      });
      created += 1;
    }

    await logAction(
      tx,
      req.userId!,
      "match.bootstrap_ebi",
      "match",
      null,
      `created=${created};updated=${updated}`,
    );

    return { created, updated };
  });

  res.json({
    ...result,
    packages: COIN_PACKAGES,
  });
});

router.delete("/admin/matches/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, params.data.id))
      .for("update");

    if (!match) return { ok: false as const, status: 404, error: "Match not found" };

    const [participantCount] = await tx
      .select({ n: count() })
      .from(matchParticipantsTable)
      .where(eq(matchParticipantsTable.matchId, match.id));

    if ((participantCount?.n ?? 0) > 0) {
      return {
        ok: false as const,
        status: 400,
        error: "Cannot delete a match with participants. End it instead.",
      };
    }

    await tx.delete(matchesTable).where(eq(matchesTable.id, match.id));
    await logAction(tx, req.userId!, "match.delete", "match", match.id, match.name);

    return { ok: true as const };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({ deleted: true });
});

router.post("/admin/matches/:id/start", requireAdmin, async (req, res): Promise<void> => {
  const params = StartMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, params.data.id))
      .for("update");

    if (!match) return { ok: false as const, status: 404, error: "Match not found" };
    if (match.status !== "open") {
      return {
        ok: false as const,
        status: 400,
        error: `Match is already ${match.status}`,
      };
    }
    if (match.slotsTaken < match.minPlayersToStart) {
      return {
        ok: false as const,
        status: 400,
        error: `Need at least ${match.minPlayersToStart} players before this match can start`,
      };
    }

    const [updated] = await tx
      .update(matchesTable)
      .set({ status: "live" })
      .where(eq(matchesTable.id, match.id))
      .returning();

    await logAction(tx, req.userId!, "match.start", "match", match.id, null);

    return { ok: true as const, match: updated! };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(serializeMatch(result.match));
});

router.post("/admin/matches/:id/end", requireAdmin, async (req, res): Promise<void> => {
  const params = EndMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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
      if (match.status === "completed") {
        return { ok: false as const, status: 400, error: "Match already completed" };
      }
      if (match.status !== "live") {
        return { ok: false as const, status: 400, error: "Only live matches can be ended" };
      }

      if (match.type === "paid" && match.entryFee > 0) {
        const participants = await tx
          .select()
          .from(matchParticipantsTable)
          .where(eq(matchParticipantsTable.matchId, match.id));

        for (const participant of participants) {
          await postWalletEntry(tx, auditContext, {
            userId: participant.userId,
            direction: "credit",
            amount: match.entryFee,
            reason: `Refund: ${match.name} ended without winner`,
            sourceType: "match_refund",
            sourceId: String(match.id),
            idempotencyKey: `match-refund:${match.id}:${participant.userId}`,
            metadata: { matchName: match.name },
          });
        }
      }

      const [updated] = await tx
        .update(matchesTable)
        .set({ status: "completed" })
        .where(eq(matchesTable.id, match.id))
        .returning();

      await logAction(tx, req.userId!, "match.end", "match", match.id, "no winner");

      return { ok: true as const, match: updated! };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json(serializeMatch(result.match));
  } catch (err: any) {
    throw err;
  }
});

router.get("/admin/logs", requireAdmin, async (req, res): Promise<void> => {
  const params = GetAdminLogsParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 100;
  const rows = await db
    .select({
      id: adminLogsTable.id,
      adminUserId: adminLogsTable.adminUserId,
      adminUsername: usersTable.username,
      action: adminLogsTable.action,
      targetType: adminLogsTable.targetType,
      targetId: adminLogsTable.targetId,
      details: adminLogsTable.details,
      createdAt: adminLogsTable.createdAt,
    })
    .from(adminLogsTable)
    .leftJoin(usersTable, eq(usersTable.id, adminLogsTable.adminUserId))
    .orderBy(desc(adminLogsTable.createdAt))
    .limit(limit);

  res.json(
    rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  );
});

export default router;
