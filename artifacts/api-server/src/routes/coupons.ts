import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  couponsTable,
  coinTransactionsTable,
} from "@workspace/db";
import { RedeemCouponBody } from "@workspace/api-zod";

const router: IRouter = Router();

const COUPON_OPTIONS = [
  { coinCost: 500, valueInr: 10 },
  { coinCost: 1000, valueInr: 20 },
  { coinCost: 1500, valueInr: 30 },
  { coinCost: 2000, valueInr: 40 },
];

router.get("/coupons/options", (_req, res) => {
  res.json(COUPON_OPTIONS);
});

router.get("/coupons", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const rows = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.userId, userId))
    .orderBy(desc(couponsTable.createdAt));
  res.json(
    rows.map((c) => ({
      id: c.id,
      code: c.code,
      coinCost: c.coinCost,
      valueInr: c.valueInr,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

function generateCode(valueInr: number): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `ARN-${valueInr}-${stamp}${rand}`;
}

router.post("/coupons/redeem", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const parsed = RedeemCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const option = COUPON_OPTIONS.find((o) => o.coinCost === parsed.data.coinCost);
  if (!option) {
    res.status(400).json({ error: "Invalid coupon option" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const updated = await tx
        .update(usersTable)
        .set({ coinBalance: sql`${usersTable.coinBalance} - ${option.coinCost}` })
        .where(
          sql`${usersTable.id} = ${userId} AND ${usersTable.coinBalance} >= ${option.coinCost}`,
        )
        .returning({ id: usersTable.id });
      if (updated.length === 0) {
        throw new Error("INSUFFICIENT_COINS");
      }

      const code = generateCode(option.valueInr);
      const [coupon] = await tx
        .insert(couponsTable)
        .values({
          userId,
          code,
          coinCost: option.coinCost,
          valueInr: option.valueInr,
        })
        .returning();

      await tx.insert(coinTransactionsTable).values({
        userId,
        amount: -option.coinCost,
        reason: `Redeemed ₹${option.valueInr} coupon (${code})`,
      });

      return coupon;
    });

    res.json({
      id: result.id,
      code: result.code,
      coinCost: result.coinCost,
      valueInr: result.valueInr,
      status: result.status,
      createdAt: result.createdAt.toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "REDEEM_FAILED";
    if (msg === "INSUFFICIENT_COINS") {
      res.status(400).json({ error: "Not enough coins to redeem this coupon" });
      return;
    }
    res.status(500).json({ error: "Failed to redeem coupon" });
  }
});

export default router;
