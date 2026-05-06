import { Router, Request, Response } from "express";
import { insertReading } from "../db";
import { bearerAuth } from "../middleware/auth";
import { logger } from "../index";
import { config } from "../config";

const router = Router();

function extractDistance(obj: Record<string, unknown>): number | null {
  const val = obj["distance"] ?? null;
  return typeof val === "number" ? Math.round(val) : null;
}

function extractBattery(obj: Record<string, unknown>): number | null {
  const val = obj["battery"] ?? null;
  return typeof val === "number" ? Math.round(val) : null;
}

router.post("/", bearerAuth, (req: Request, res: Response): void => {
  const body = req.body as Record<string, unknown>;
  console.log("BODY REQUEST: ", body);

  const devEUI =
    typeof body.devEUI === "string" ? body.devEUI : config.defaultDevEUI;

  // Gateway may send a flat decoded payload (no wrapper object) or the standard {object:{...}} format
  const obj =
    body.object && typeof body.object === "object"
      ? (body.object as Record<string, unknown>)
      : body;

  const id = insertReading({
    devEUI,
    deviceName:
      typeof body.deviceName === "string" ? body.deviceName : undefined,
    fCnt: typeof body.fCnt === "number" ? body.fCnt : undefined,
    fPort: typeof body.fPort === "number" ? body.fPort : undefined,
    distanceMm: extractDistance(obj),
    battery: extractBattery(obj),
    rawObject: JSON.stringify(obj),
    gatewayTime: typeof body.time === "string" ? body.time : undefined,
  });

  logger.info({ id, devEUI, fCnt: body.fCnt }, "uplink saved");

  res.status(200).json({ ok: true, id });
});

export default router;
