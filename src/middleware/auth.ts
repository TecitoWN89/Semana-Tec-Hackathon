import { Request, Response, NextFunction } from "express";
import { config } from "../config";

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.authToken) {
    next();
    return;
  }

  const header = req.headers["authorization"] ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (token !== config.authToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
