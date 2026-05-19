import { Router, type IRouter } from "express";
import { COIN_PACKAGES } from "../src/lib/ebi-config.js";

const router: IRouter = Router();

router.get("/economy", async (_req, res): Promise<void> => {
  res.json({
    signupBonusCoins: 400,
    dailyLoginRewardCoins: 20,
    packages: COIN_PACKAGES,
    payoutRules: {
      perKillCoins: 10,
      booyahCoins: 80,
    },
  });
});

export default router;
