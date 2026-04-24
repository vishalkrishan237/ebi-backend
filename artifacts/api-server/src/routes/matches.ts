import { Router, type IRouter } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  db,
  matchesTable,
  matchParticipantsTable,
  usersTable,
  coinTransactionsTable,
  couponsTable,
} from "@workspace/db";
import {
  CreateMatchBody,
  GetMatchParams,
  JoinMatchParams,
  DeclareWinnerParams,
  DeclareWinnerBody,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

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
  const { name, type, entryFee, prize, slots, startsAt } = parsed.data;

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
      type,
      entryFee: type === "free" ? 0 : entryFee,
      prize,
      slots,
      slotsTaken: 0,
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
    const [w] = await db
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, match.winnerUserId));
    winnerUsername = w?.username ?? null;
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
  });
});

router.post(
  "/matches/:id/join",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = JoinMatchParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = req.userId!;

    const couponCodeRaw =
      typeof req.body?.couponCode === "string" ? req.body.couponCode.trim() : "";
    if (couponCodeRaw.length > 64) {
      res.status(400).json({ error: "Coupon code is too long" });
      return;
    }
    const couponCode =
      couponCodeRaw.length > 0 ? couponCodeRaw.toUpperCase() : null;

    try {
      const result = await db.transaction(async (tx) => {
        const [match] = await tx
          .select()
          .from(matchesTable)
          .where(eq(matchesTable.id, params.data.id))
          .for("update");
        if (!match) return { ok: false as const, status: 404, error: "Match not found" };
        if (match.status !== "open")
          return { ok: false as const, status: 400, error: "Match is closed" };
        if (match.slotsTaken >= match.slots)
          return { ok: false as const, status: 400, error: "Match is full" };

        let coupon: typeof couponsTable.$inferSelect | null = null;
        if (couponCode) {
          if (match.type !== "paid")
            return {
              ok: false as const,
              status: 400,
              error: "Coupons only apply to paid matches",
            };
          const [c] = await tx
            .select()
            .from(couponsTable)
            .where(eq(couponsTable.code, couponCode))
            .for("update");
          if (!c) return { ok: false as const, status: 400, error: "Invalid coupon code" };
          if (c.userId !== userId)
            return {
              ok: false as const,
              status: 403,
              error: "This coupon belongs to another player",
            };
          if (c.status !== "active")
            return { ok: false as const, status: 400, error: "Coupon already used" };
          coupon = c;
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
        if (existing.length > 0)
          return { ok: false as const, status: 400, error: "Already joined this match" };

        const [user] = await tx
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .for("update");
        if (!user)
          return { ok: false as const, status: 404, error: "User not found" };

        let finalFee = 0;
        if (match.type === "paid") {
          const discount = coupon ? Math.min(coupon.valueInr, match.entryFee) : 0;
          finalFee = Math.max(0, match.entryFee - discount);

          if (user.coinBalance < finalFee)
            return { ok: false as const, status: 400, error: "Not enough coins" };

          if (finalFee > 0) {
            await tx
              .update(usersTable)
              .set({
                coinBalance: sql`${usersTable.coinBalance} - ${finalFee}`,
              })
              .where(eq(usersTable.id, user.id));
            await tx.insert(coinTransactionsTable).values({
              userId: user.id,
              amount: -finalFee,
              reason: coupon
                ? `Joined ${match.name} (coupon ${coupon.code} -₹${discount})`
                : `Joined ${match.name}`,
              matchId: match.id,
            });
          }

          if (coupon) {
            await tx
              .update(couponsTable)
              .set({ status: "used" })
              .where(eq(couponsTable.id, coupon.id));
          }
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
      // Unique constraint on (matchId, userId) or coin_balance check fired
      const code = err?.code;
      if (code === "23505") {
        res.status(400).json({ error: "Already joined this match" });
        return;
      }
      if (code === "23514") {
        res.status(400).json({ error: "Not enough coins" });
        return;
      }
      throw err;
    }
  },
);

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

    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.id, params.data.id))
        .for("update");
      if (!match)
        return { ok: false as const, status: 404, error: "Match not found" };
      if (match.status === "completed")
        return { ok: false as const, status: 400, error: "Already completed" };

      const [participant] = await tx
        .select({ id: matchParticipantsTable.id })
        .from(matchParticipantsTable)
        .where(
          and(
            eq(matchParticipantsTable.matchId, match.id),
            eq(matchParticipantsTable.userId, body.data.winnerUserId),
          ),
        );
      if (!participant)
        return {
          ok: false as const,
          status: 400,
          error: "Winner is not a participant of this match",
        };

      await tx
        .update(usersTable)
        .set({ coinBalance: sql`${usersTable.coinBalance} + ${match.prize}` })
        .where(eq(usersTable.id, body.data.winnerUserId));

      await tx.insert(coinTransactionsTable).values({
        userId: body.data.winnerUserId,
        amount: match.prize,
        reason: `Won ${match.name}`,
        matchId: match.id,
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
