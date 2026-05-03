import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import {
  db,
  couponsTable,
} from "@workspace/db";
import { RedeemCouponBody, PreviewCouponBody } from "@workspace/api-zod";
import { requireAuth } from "../src/middlewares/auth";
import { buildAuditContext } from "../src/lib/audit";
import { postWalletEntry } from "../src/lib/wallet";

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

router.post("/coupons/preview", requireAuth, async (req, res): Promise<void> => {
  const parsed = PreviewCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();
  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.code, code));

  if (!coupon) {
    res.status(404).json({ error: "Invalid coupon code" });
    return;
  }

  if (coupon.userId !== req.userId) {
    res.status(403).json({ error: "This coupon belongs to another player" });
    return;
  }

  if (coupon.status !== "active") {
    res.status(400).json({ error: "Coupon already used" });
    return;
  }

  res.json({ code: coupon.code, valueInr: coupon.valueInr, status: coupon.status });
});

router.get("/coupons", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.userId, req.userId!))
    .orderBy(desc(couponsTable.createdAt));

  res.json(
    rows.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      coinCost: coupon.coinCost,
      valueInr: coupon.valueInr,
      status: coupon.status,
      createdAt: coupon.createdAt.toISOString(),
    })),
  );
});

function generateCode(valueInr: number): string {
  return `ARN-${valueInr}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

router.post("/coupons/redeem", requireAuth, async (req, res): Promise<void> => {
  const parsed = RedeemCouponBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const option = COUPON_OPTIONS.find((item) => item.coinCost === parsed.data.coinCost);
  if (!option) {
    res.status(400).json({ error: "Invalid coupon option" });
    return;
  }

  const userId = req.userId!;
  const auditContext = buildAuditContext(req);

  try {
    const result = await db.transaction(async (tx) => {
      const code = generateCode(option.valueInr);

      await postWalletEntry(tx, auditContext, {
        userId,
        direction: "debit",
        amount: option.coinCost,
        reason: `Redeemed INR ${option.valueInr} coupon (${code})`,
        sourceType: "coupon_redeem",
        sourceId: code,
        idempotencyKey: `coupon-redeem:${userId}:${code}`,
        metadata: { valueInr: option.valueInr },
      });

      const [coupon] = await tx
        .insert(couponsTable)
        .values({
          userId,
          code,
          coinCost: option.coinCost,
          valueInr: option.valueInr,
        })
        .returning();

      return coupon!;
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
    if (err instanceof Error && err.message === "Insufficient wallet balance") {
      res.status(400).json({ error: "Not enough coins to redeem this coupon" });
      return;
    }

    throw err;
  }
});

export default router;
