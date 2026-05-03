import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  couponsTable,
  coinTransactionsTable,
} from "@workspace/db";
import { RedeemCouponBody, PreviewCouponBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

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

router.post(
  "/coupons/preview",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = PreviewCouponBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const code = parsed.data.code.trim().toUpperCase();
    const [c] = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.code, code));
    if (!c) {
      res.status(404).json({ error: "Invalid coupon code" });
      return;
    }
    if (c.userId !== req.userId) {
      res.status(403).json({ error: "This coupon belongs to another player" });
      return;
    }
    if (c.status !== "active") {
      res.status(400).json({ error: "Coupon already used" });
      return;
    }
    res.json({ code: c.code, valueInr: c.valueInr, status: c.status });
  },
);

router.get("/coupons", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.userId, req.userId!))
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

router.post(
  "/coupons/redeem",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = RedeemCouponBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const option = COUPON_OPTIONS.find(
      (o) => o.coinCost === parsed.data.coinCost,
    );
    if (!option) {
      res.status(400).json({ error: "Invalid coupon option" });
      return;
    }

    const userId = req.userId!;

    try {
      const result = await db.transaction(async (tx) => {
        const updated = await tx
          .update(usersTable)
          .set({
            coinBalance: sql`${usersTable.coinBalance} - ${option.coinCost}`,
          })
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
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "REDEEM_FAILED";
      if (msg === "INSUFFICIENT_COINS" || err?.code === "23514") {
        res
          .status(400)
          .json({ error: "Not enough coins to redeem this coupon" });
        return;
      }
      throw err;
    }
  },
);

export default router;
