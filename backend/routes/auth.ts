import { Router, type IRouter, type Request } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, referralRewardsTable, usersTable } from "@workspace/db";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { toUserDto } from "../lib/users";
import { requireAuth } from "../middlewares/auth";
import { buildAuditContext, logAuditEvent } from "../lib/audit";
import { postWalletEntry } from "../lib/wallet";
import { getIndiaDateStamp } from "../lib/ebi-config";

const router: IRouter = Router();

const BCRYPT_ROUNDS = 12;
const SIGNUP_BONUS_COINS = 400;
const REFERRAL_REWARD_COINS = 25;
const DAILY_LOGIN_REWARD_COINS = 20;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function regenerateSession(req: Request) {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function destroySession(req: Request) {
  await new Promise<void>((resolve) => {
    req.session.destroy(() => resolve());
  });
}

async function generateUniqueReferralCode(tx: Tx) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = randomBytes(5).toString("hex").toUpperCase();
    const [existing] = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, candidate));

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Could not generate unique referral code");
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const username = parsed.data.username.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const freeFireUid = parsed.data.freeFireUid.trim();
  const { password } = parsed.data;
  const rawReferralCode =
    typeof req.body?.referralCode === "string"
      ? req.body.referralCode.trim().toUpperCase()
      : "";
  const auditContext = buildAuditContext(req);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await db.transaction(async (tx) => {
    const existingEmail = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));
    if (existingEmail.length > 0) {
      return { ok: false as const, status: 400, error: "Email already registered" };
    }

    const existingUsername = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (existingUsername.length > 0) {
      return { ok: false as const, status: 400, error: "Username already taken" };
    }

    const existingFreeFireUid = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.freeFireUid, freeFireUid));
    if (existingFreeFireUid.length > 0) {
      return { ok: false as const, status: 400, error: "Free Fire UID already registered" };
    }

    let referrerId: number | null = null;
    if (rawReferralCode) {
      const [referrer] = await tx
        .select({ id: usersTable.id, username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.referralCode, rawReferralCode));

      if (!referrer) {
        return { ok: false as const, status: 400, error: "Invalid referral code" };
      }

      referrerId = referrer.id;
    }

    const referralCode = await generateUniqueReferralCode(tx);
    const [user] = await tx
      .insert(usersTable)
      .values({
        username,
        email,
        freeFireUid,
        passwordHash,
        referralCode,
        referredByUserId: referrerId,
        coinBalance: 0,
        isAdmin: false,
      })
      .returning();

    if (!user) {
      return { ok: false as const, status: 500, error: "Failed to create user" };
    }

    await postWalletEntry(tx, auditContext, {
      userId: user.id,
      direction: "credit",
      amount: SIGNUP_BONUS_COINS,
      reason: "Welcome bonus",
      sourceType: "signup_bonus",
      sourceId: String(user.id),
      idempotencyKey: `signup-bonus:${user.id}`,
      metadata: { username: user.username },
    });

    if (referrerId != null) {
      const rewardEntry = await postWalletEntry(tx, auditContext, {
        userId: referrerId,
        direction: "credit",
        amount: REFERRAL_REWARD_COINS,
        reason: `Referral reward for ${user.username}`,
        sourceType: "referral_reward",
        sourceId: `${referrerId}:${user.id}`,
        idempotencyKey: `referral-reward:${referrerId}:${user.id}`,
        metadata: { referredUserId: user.id, referredUsername: user.username },
      });

      await tx.insert(referralRewardsTable).values({
        referrerUserId: referrerId,
        referredUserId: user.id,
        walletEntryId: rewardEntry.id,
      });
    }

    await logAuditEvent(tx, auditContext, {
      eventType: "auth.signup",
      entityType: "user",
      entityId: String(user.id),
      payload: {
        username: user.username,
        referralCode: user.referralCode,
        referredByUserId: referrerId,
      },
    });

    const [freshUser] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id));

    return { ok: true as const, user: freshUser! };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  await regenerateSession(req);
  req.session.userId = result.user.id;
  res.json(toUserDto(result.user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  const auditContext = buildAuditContext(req);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (user.isBanned) {
    res.status(403).json({ error: "Account is banned" });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await regenerateSession(req);
  req.session.userId = user.id;
  await db.transaction(async (tx) => {
    await postWalletEntry(tx, auditContext, {
      userId: user.id,
      direction: "credit",
      amount: DAILY_LOGIN_REWARD_COINS,
      reason: "Daily login reward",
      sourceType: "daily_login",
      sourceId: `${user.id}:${getIndiaDateStamp()}`,
      idempotencyKey: `daily-login:${user.id}:${getIndiaDateStamp()}`,
      metadata: { username: user.username },
    });

    await logAuditEvent(tx, auditContext, {
      eventType: "auth.login",
      entityType: "user",
      entityId: String(user.id),
      payload: { username: user.username },
    });
  });
  res.json(toUserDto(user));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const auditContext = buildAuditContext(req);
  if (req.session.userId) {
    await logAuditEvent(db, auditContext, {
      eventType: "auth.logout",
      entityType: "user",
      entityId: String(req.session.userId),
    });
  }
  await destroySession(req);
  res.clearCookie("arena.sid");
  res.sendStatus(204);
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.json({ user: null });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (user?.isBanned) {
    await destroySession(req);
    res.clearCookie("arena.sid");
    res.status(403).json({ error: "Account is banned" });
    return;
  }
  if (!user) {
    res.json({ user: null });
    return;
  }
  res.json({ user: toUserDto(user) });
});

router.get("/auth/session", requireAuth, async (req, res): Promise<void> => {
  res.json({ user: toUserDto(req.user!) });
});

export default router;
