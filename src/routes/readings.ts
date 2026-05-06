import { Router, Request, Response } from "express";
import { getReadings, getLatest } from "../db";

const router = Router();

router.get("/", (req: Request, res: Response): void => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10) || 50, 500);
  const devEUI = typeof req.query.devEUI === "string" ? req.query.devEUI : undefined;

  const rows = getReadings(limit, devEUI);
  res.json(rows);
});

router.get("/:devEUI/latest", (req: Request, res: Response): void => {
  const row = getLatest(req.params.devEUI);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

export default router;
