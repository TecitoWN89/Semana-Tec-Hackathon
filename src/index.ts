import "dotenv/config";
import express from "express";
import pino from "pino";
import { config } from "./config";
import { initDb } from "./db";
import uplinkRouter from "./routes/uplink";
import readingsRouter from "./routes/readings";
import healthRouter from "./routes/health";

export const logger = pino({
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

initDb();

const app = express();

app.use((req, _res, next) => {
  logger.info(
    { method: req.method, url: req.url, ip: req.ip, headers: req.headers },
    "incoming request",
  );
  next();
});

app.use(express.json({ limit: "1mb" }));

// Reject non-JSON uplink requests before they reach the route
app.use("/api/milesight/uplink", (req, res, next) => {
  if (!req.is("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return;
  }
  next();
});

app.use("/api/milesight/uplink", uplinkRouter);
app.use("/api/readings", readingsRouter);
app.use("/health", healthRouter);

app.listen(config.port, () => {
  logger.info({ port: config.port, db: config.dbPath }, "server started");
});
