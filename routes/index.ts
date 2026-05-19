import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import matchesRouter from "./matches.js";
import profileRouter from "./profile.js";
import rewardsRouter from "./rewards.js";
import leaderboardRouter from "./leaderboard.js";
import couponsRouter from "./coupons.js";
import matchHistoryRouter from "./match-history.js";
import adminRouter from "./admin.js";
import engagementRouter from "./engagement.js";
import economyRouter from "./economy.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(matchHistoryRouter);
router.use(matchesRouter);
router.use(profileRouter);
router.use(rewardsRouter);
router.use(leaderboardRouter);
router.use(couponsRouter);
router.use(engagementRouter);
router.use(economyRouter);

export default router;
