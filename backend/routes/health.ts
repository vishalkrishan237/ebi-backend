import { Router, type IRouter } from "express";
import { getHealthStatus } from "../controllers/health-controller";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = getHealthStatus();
  res.json(data);
});

export default router;
