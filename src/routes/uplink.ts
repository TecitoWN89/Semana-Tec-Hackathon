import { Router, Request, Response } from "express";
import { insertReading } from "../db";
import { bearerAuth } from "../middleware/auth";
import { config } from "../config";

const router = Router();

function extractNum(obj: Record<string, unknown>, key: string): number | null {
  const val = obj[key] ?? null;
  return typeof val === "number" ? val : null;
}

router.post("/", bearerAuth, (req: Request, res: Response): void => {
  const body = req.body as Record<string, unknown>;
  console.log("UPLINK recibido:", JSON.stringify(body, null, 2));

  const devEUI =
    typeof body.devEUI === "string" ? body.devEUI : config.defaultDevEUI;

  // El gateway puede enviar payload plano o anidado en {object:{...}}
  const obj =
    body.object && typeof body.object === "object"
      ? (body.object as Record<string, unknown>)
      : body;

  const id = insertReading({
    devEUI,
    deviceName: typeof body.deviceName === "string" ? body.deviceName : undefined,
    fCnt: typeof body.fCnt === "number" ? body.fCnt : undefined,
    fPort: typeof body.fPort === "number" ? body.fPort : undefined,
    temperature: extractNum(obj, "temperature"),
    moisture: extractNum(obj, "moisture"),
    electricity: extractNum(obj, "electricity"),
    rawObject: JSON.stringify(obj),
    gatewayTime: typeof body.time === "string" ? body.time : undefined,
  });

  console.log(`✅ Guardado id=${id} | temp=${extractNum(obj, "temperature")}°C | humedad=${extractNum(obj, "moisture")}% | elec=${extractNum(obj, "electricity")}`);
  res.status(200).json({ ok: true, id });
});

export default router;