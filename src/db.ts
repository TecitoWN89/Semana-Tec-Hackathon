import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "./config";

let db: Database.Database;

export function initDb(): void {
  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    DROP TABLE IF EXISTS readings;

    CREATE TABLE readings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      dev_eui      TEXT    NOT NULL,
      device_name  TEXT,
      f_cnt        INTEGER,
      f_port       INTEGER,
      distance_mm  INTEGER,
      battery      INTEGER,
      raw_object   TEXT    NOT NULL,
      gateway_time TEXT,
      received_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_readings_dev_eui_received
      ON readings (dev_eui, received_at DESC);
  `);
}

export interface ReadingRow {
  id: number;
  dev_eui: string;
  device_name: string | null;
  f_cnt: number | null;
  f_port: number | null;
  distance_mm: number | null;
  battery: number | null;
  raw_object: string;
  gateway_time: string | null;
  received_at: string;
}

export interface InsertReadingParams {
  devEUI: string;
  deviceName?: string;
  fCnt?: number;
  fPort?: number;
  distanceMm?: number | null;
  battery?: number | null;
  rawObject: string;
  gatewayTime?: string;
}

export function insertReading(params: InsertReadingParams): number {
  const stmt = db.prepare(`
    INSERT INTO readings (dev_eui, device_name, f_cnt, f_port, distance_mm, battery, raw_object, gateway_time)
    VALUES (@devEUI, @deviceName, @fCnt, @fPort, @distanceMm, @battery, @rawObject, @gatewayTime)
  `);
  const result = stmt.run(params);
  return result.lastInsertRowid as number;
}

export function getReadings(limit: number, devEUI?: string): ReadingRow[] {
  if (devEUI) {
    return db
      .prepare(
        `SELECT * FROM readings WHERE dev_eui = ? ORDER BY received_at DESC LIMIT ?`
      )
      .all(devEUI, limit) as ReadingRow[];
  }
  return db
    .prepare(`SELECT * FROM readings ORDER BY received_at DESC LIMIT ?`)
    .all(limit) as ReadingRow[];
}

export function getLatest(devEUI: string): ReadingRow | null {
  return (
    (db
      .prepare(
        `SELECT * FROM readings WHERE dev_eui = ? ORDER BY received_at DESC LIMIT 1`
      )
      .get(devEUI) as ReadingRow | undefined) ?? null
  );
}
