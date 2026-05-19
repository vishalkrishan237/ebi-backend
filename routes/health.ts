import { Router, type IRouter } from "express";
import { getHealthStatus } from "../controllers/health-controller";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    const data = await getHealthStatus();
    res.json(data);
  } catch {
    res.status(503).json({ status: "degraded" });
  }
});

export default router;
