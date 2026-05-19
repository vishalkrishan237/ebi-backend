import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  referralRewardsTable,
  usersTable,
  walletEntriesTable,
  watchRewardSessionsTable,
  watchRewardVideosTable,
} from "@workspace/db";
import { requireAuth } from "../src/middlewares/auth.js";
import { buildAuditContext, logAuditEvent } from "../src/lib/audit.js";
import { postWalletEntry } from "../src/lib/wallet.js";

const router: IRouter = Router();

const CompleteWatchBody = z.object({
  sessionId: z.number().int().positive(),
  sessionToken: z.string().min(8).max(128),
});

router.get("/engagement/watch-videos", requireAuth, async (req, res): Promise<void> => {
  const videos = await db
    .select()
    .from(watchRewardVideosTable)
    .where(eq(watchRewardVideosTable.isActive, true))
    .orderBy(desc(watchRewardVideosTable.createdAt));

  const items = await Promise.all(
    videos.map(async (video) => {
      const [lastSession] = await db
        .select()
        .from(watchRewardSessionsTable)
        .where(
          and(
            eq(watchRewardSessionsTable.userId, req.userId!),
            eq(watchRewardSessionsTable.videoId, video.id),
          ),
        )
        .orderBy(desc(watchRewardSessionsTable.createdAt))
        .limit(1);

      const now = Date.now();
      const nextEligibleAt =
        lastSession?.completedAt != null
          ? new Date(lastSession.completedAt.getTime() + video.cooldownHours * 60 * 60 * 1000)
          : null;

      return {
        id: video.id,
        title: video.title,
        description: video.description,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        durationSeconds: video.durationSeconds,
        rewardCoins: video.rewardCoins,
        cooldownHours: video.cooldownHours,
        nextEligibleAt: nextEligibleAt?.toISOString() ?? null,
        availableNow: nextEligibleAt == null || nextEligibleAt.getTime() <= now,
      };
    }),
  );

  res.json(items);
});

router.post("/engagement/watch-videos/:id/start", requireAuth, async (req, res): Promise<void> => {
  const videoId = Number(req.params.id);
  if (!Number.isInteger(videoId) || videoId <= 0) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }

  const [video] = await db
    .select()
    .from(watchRewardVideosTable)
    .where(eq(watchRewardVideosTable.id, videoId));

  if (!video || !video.isActive) {
    res.status(404).json({ error: "Reward video not found" });
    return;
  }

  const [lastSession] = await db
    .select()
    .from(watchRewardSessionsTable)
    .where(
      and(
        eq(watchRewardSessionsTable.userId, req.userId!),
        eq(watchRewardSessionsTable.videoId, video.id),
      ),
    )
    .orderBy(desc(watchRewardSessionsTable.createdAt))
    .limit(1);

  const [activeSession] = await db
    .select({ id: watchRewardSessionsTable.id })
    .from(watchRewardSessionsTable)
    .where(
      and(
        eq(watchRewardSessionsTable.userId, req.userId!),
        isNull(watchRewardSessionsTable.completedAt),
      ),
    )
    .limit(1);

  if (activeSession) {
    res.status(400).json({ error: "Finish the current reward session before starting another" });
    return;
  }

  if (lastSession && !lastSession.completedAt) {
    res.status(400).json({ error: "A reward session is already active for this video" });
    return;
  }

  if (
    lastSession?.completedAt &&
    lastSession.completedAt.getTime() + video.cooldownHours * 60 * 60 * 1000 > Date.now()
  ) {
    res.status(400).json({ error: "This reward is still on cooldown" });
    return;
  }

  const sessionToken = randomBytes(24).toString("hex");
  const unlocksAt = new Date(Date.now() + video.durationSeconds * 1000);

  const [session] = await db
    .insert(watchRewardSessionsTable)
    .values({
      userId: req.userId!,
      videoId: video.id,
      sessionToken,
      unlocksAt,
    })
    .returning();

  await logAuditEvent(db, buildAuditContext(req), {
    eventType: "watch_reward.session_started",
    entityType: "watch_reward_session",
    entityId: String(session!.id),
    payload: { videoId: video.id },
  });

  res.json({
    sessionId: session!.id,
    sessionToken,
    unlocksAt: unlocksAt.toISOString(),
  });
});

router.post("/engagement/watch-videos/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const videoId = Number(req.params.id);
  if (!Number.isInteger(videoId) || videoId <= 0) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }

  const parsed = CompleteWatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const auditContext = buildAuditContext(req);

  const result = await db.transaction(async (tx) => {
    const [video] = await tx
      .select()
      .from(watchRewardVideosTable)
      .where(eq(watchRewardVideosTable.id, videoId))
      .for("update");

    if (!video || !video.isActive) {
      return { ok: false as const, status: 404, error: "Reward video not found" };
    }

    const [session] = await tx
      .select()
      .from(watchRewardSessionsTable)
      .where(
        and(
          eq(watchRewardSessionsTable.id, parsed.data.sessionId),
          eq(watchRewardSessionsTable.videoId, video.id),
          eq(watchRewardSessionsTable.userId, req.userId!),
          eq(watchRewardSessionsTable.sessionToken, parsed.data.sessionToken),
        ),
      )
      .for("update");

    if (!session) {
      return { ok: false as const, status: 404, error: "Reward session not found" };
    }

    if (session.completedAt) {
      return { ok: false as const, status: 400, error: "Reward already claimed" };
    }

    if (session.unlocksAt.getTime() > Date.now()) {
      return { ok: false as const, status: 400, error: "Watch time requirement not met" };
    }

    const entry = await postWalletEntry(tx, auditContext, {
      userId: req.userId!,
      direction: "credit",
      amount: video.rewardCoins,
      reason: `Watch and earn: ${video.title}`,
      sourceType: "watch_reward",
      sourceId: String(session.id),
      idempotencyKey: `watch-reward:${session.id}`,
      metadata: { videoId: video.id, videoTitle: video.title },
    });

    const [updatedSession] = await tx
      .update(watchRewardSessionsTable)
      .set({ completedAt: new Date(), walletEntryId: entry.id })
      .where(eq(watchRewardSessionsTable.id, session.id))
      .returning();

    await logAuditEvent(tx, auditContext, {
      eventType: "watch_reward.claimed",
      entityType: "watch_reward_session",
      entityId: String(session.id),
      payload: {
        videoId: video.id,
        rewardCoins: video.rewardCoins,
        walletEntryId: entry.id,
      },
    });

    return {
      ok: true as const,
      rewardCoins: video.rewardCoins,
      balanceAfter: entry.balanceAfter,
      completedAt: updatedSession!.completedAt!.toISOString(),
    };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json(result);
});

router.get("/referrals/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select({
      id: usersTable.id,
      referralCode: usersTable.referralCode,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const rewards = await db
    .select({
      id: referralRewardsTable.id,
      referredUserId: referralRewardsTable.referredUserId,
      username: usersTable.username,
      createdAt: referralRewardsTable.createdAt,
      amount: walletEntriesTable.amount,
    })
    .from(referralRewardsTable)
    .innerJoin(usersTable, eq(usersTable.id, referralRewardsTable.referredUserId))
    .innerJoin(walletEntriesTable, eq(walletEntriesTable.id, referralRewardsTable.walletEntryId))
    .where(eq(referralRewardsTable.referrerUserId, req.userId!))
    .orderBy(desc(referralRewardsTable.createdAt));

  res.json({
    referralCode: user.referralCode,
    referredCount: rewards.length,
    totalEarnedCoins: rewards.reduce((sum, reward) => sum + reward.amount, 0),
    referrals: rewards.map((reward) => ({
      id: reward.id,
      referredUserId: reward.referredUserId,
      username: reward.username,
      rewardCoins: reward.amount,
      createdAt: reward.createdAt.toISOString(),
    })),
  });
});

export default router;
