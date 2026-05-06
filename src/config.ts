import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  dbPath: process.env.DB_PATH ?? "./data/readings.db",
  authToken: process.env.AUTH_TOKEN ?? null,
  // Used when the gateway sends a flat payload without devEUI metadata
  defaultDevEUI: process.env.DEFAULT_DEV_EUI ?? "unknown",
};
