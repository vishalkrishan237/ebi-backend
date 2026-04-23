import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import matchesRouter from "./matches";
import profileRouter from "./profile";
import rewardsRouter from "./rewards";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(matchesRouter);
router.use(profileRouter);
router.use(rewardsRouter);

export default router;
