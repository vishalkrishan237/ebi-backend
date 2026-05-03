import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import matchesRouter from "./matches";
import profileRouter from "./profile";
import rewardsRouter from "./rewards";
import leaderboardRouter from "./leaderboard";
import couponsRouter from "./coupons";
import matchHistoryRouter from "./match-history";
import adminRouter from "./admin";
import engagementRouter from "./engagement";
import economyRouter from "./economy";

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
