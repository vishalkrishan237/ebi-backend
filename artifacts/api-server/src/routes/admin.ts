import { Router, type IRouter } from "express";
import { eq, desc, sql, and, or, ilike, count } from "drizzle-orm";
import {
  db,
  usersTable,
  matchesTable,
  matchParticipantsTable,
  coinTransactionsTable,
  adminLogsTable,
} from "@workspace/db";
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
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";

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
    type: m.type,
    entryFee: m.entryFee,
    prize: m.prize,
    slots: m.slots,
    slotsTaken: m.slotsTaken,
    status: m.status,
    winnerUserId: m.winnerUserId,
    startsAt: m.startsAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
  };
}

// ---------- Stats ----------
router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
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

// ---------- Users ----------
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
      id: coinTransactionsTable.id,
      amount: coinTransactionsTable.amount,
      reason: coinTransactionsTable.reason,
      matchId: coinTransactionsTable.matchId,
      matchName: matchesTable.name,
      createdAt: coinTransactionsTable.createdAt,
    })
    .from(coinTransactionsTable)
    .leftJoin(matchesTable, eq(matchesTable.id, coinTransactionsTable.matchId))
    .where(eq(coinTransactionsTable.userId, user.id))
    .orderBy(desc(coinTransactionsTable.createdAt))
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
      amount: c.amount,
      reason: c.reason,
      matchId: c.matchId,
      matchName: c.matchName,
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
    if (target.isAdmin)
      return { ok: false as const, status: 400, error: "Cannot ban an admin" };
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

  try {
    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, params.data.id))
        .for("update");
      if (!target) return { ok: false as const, status: 404, error: "User not found" };

      await tx
        .update(usersTable)
        .set({ coinBalance: sql`${usersTable.coinBalance} + ${amount}` })
        .where(eq(usersTable.id, target.id));

      await tx.insert(coinTransactionsTable).values({
        userId: target.id,
        amount,
        reason: `[ADMIN] ${reason.trim()}`,
        matchId: null,
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
        `${amount > 0 ? "+" : ""}${amount} — ${reason.trim()}`,
      );
      return { ok: true as const, user: updated! };
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json(serializeAdminUser(result.user));
  } catch (err: any) {
    if (err?.code === "23514") {
      res.status(400).json({ error: "Adjustment would make balance negative" });
      return;
    }
    throw err;
  }
});

// ---------- Match management ----------
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
    if (match.status === "completed")
      return { ok: false as const, status: 400, error: "Cannot edit a completed match" };
    if (match.slotsTaken > 0)
      return {
        ok: false as const,
        status: 400,
        error: "Cannot edit a match that already has participants",
      };

    const updates: Partial<typeof matchesTable.$inferInsert> = {};
    if (body.data.name !== undefined) updates.name = body.data.name.trim();
    if (body.data.type !== undefined) updates.type = body.data.type;
    if (body.data.entryFee !== undefined) updates.entryFee = body.data.entryFee;
    if (body.data.prize !== undefined) updates.prize = body.data.prize;
    if (body.data.slots !== undefined) updates.slots = body.data.slots;
    if (body.data.startsAt !== undefined) {
      const d = new Date(body.data.startsAt);
      if (Number.isNaN(d.getTime()))
        return { ok: false as const, status: 400, error: "Invalid startsAt" };
      updates.startsAt = d;
    }

    const finalType = updates.type ?? match.type;
    const finalFee = updates.entryFee ?? match.entryFee;
    if (finalType === "paid" && finalFee <= 0)
      return {
        ok: false as const,
        status: 400,
        error: "Paid matches must have a positive entry fee",
      };
    if (finalType === "free") updates.entryFee = 0;

    const [updated] = await tx
      .update(matchesTable)
      .set(updates)
      .where(eq(matchesTable.id, match.id))
      .returning();
    await logAction(
      tx,
      req.userId!,
      "match.update",
      "match",
      match.id,
      JSON.stringify(updates),
    );
    return { ok: true as const, match: updated! };
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(serializeMatch(result.match));
});

router.delete("/admin/matches/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.id, params.data.id))
        .for("update");
      if (!match) return { ok: false as const, status: 404, error: "Match not found" };

      // Refund any participants if this is a paid match still open
      if (match.status !== "completed" && match.type === "paid" && match.entryFee > 0) {
        const participants = await tx
          .select()
          .from(matchParticipantsTable)
          .where(eq(matchParticipantsTable.matchId, match.id));
        for (const p of participants) {
          await tx
            .update(usersTable)
            .set({ coinBalance: sql`${usersTable.coinBalance} + ${match.entryFee}` })
            .where(eq(usersTable.id, p.userId));
          await tx.insert(coinTransactionsTable).values({
            userId: p.userId,
            amount: match.entryFee,
            reason: `Refund: ${match.name} cancelled by admin`,
            matchId: match.id,
          });
        }
      }

      await tx
        .delete(matchParticipantsTable)
        .where(eq(matchParticipantsTable.matchId, match.id));
      await tx
        .delete(coinTransactionsTable)
        .where(eq(coinTransactionsTable.matchId, match.id));
      await tx.delete(matchesTable).where(eq(matchesTable.id, match.id));

      await logAction(tx, req.userId!, "match.delete", "match", match.id, match.name);
      return { ok: true as const };
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ deleted: true });
  } catch (err: any) {
    if (err?.code === "23514") {
      res
        .status(400)
        .json({ error: "Refund would overflow user balance limits" });
      return;
    }
    throw err;
  }
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
    if (match.status !== "open")
      return {
        ok: false as const,
        status: 400,
        error: `Match is already ${match.status}`,
      };
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
  try {
    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.id, params.data.id))
        .for("update");
      if (!match) return { ok: false as const, status: 404, error: "Match not found" };
      if (match.status === "completed")
        return { ok: false as const, status: 400, error: "Match already completed" };

      // End without winner = refund any paid participants
      if (match.type === "paid" && match.entryFee > 0) {
        const participants = await tx
          .select()
          .from(matchParticipantsTable)
          .where(eq(matchParticipantsTable.matchId, match.id));
        for (const p of participants) {
          await tx
            .update(usersTable)
            .set({ coinBalance: sql`${usersTable.coinBalance} + ${match.entryFee}` })
            .where(eq(usersTable.id, p.userId));
          await tx.insert(coinTransactionsTable).values({
            userId: p.userId,
            amount: match.entryFee,
            reason: `Refund: ${match.name} ended without winner`,
            matchId: match.id,
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
    if (err?.code === "23514") {
      res.status(400).json({ error: "Refund failed due to balance constraint" });
      return;
    }
    throw err;
  }
});

// ---------- Logs ----------
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
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
