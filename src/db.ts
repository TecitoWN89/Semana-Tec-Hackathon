import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import { config } from "./config";

let db: Database;

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  const dir = path.dirname(config.dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Si ya existe el archivo, cargarlo; si no, crear uno nuevo
  if (fs.existsSync(config.dbPath)) {
    const fileBuffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS readings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      dev_eui      TEXT    NOT NULL,
      device_name  TEXT,
      f_cnt        INTEGER,
      f_port       INTEGER,
      temperature  REAL,
      moisture     REAL,
      electricity  REAL,
      raw_object   TEXT    NOT NULL,
      gateway_time TEXT,
      received_at  DATETIME DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_readings_dev_eui_received
      ON readings (dev_eui, received_at DESC);
  `);

  persist(); // guardar archivo inicial
}

// Persiste la DB en disco después de cada escritura
function persist(): void {
  const data = db.export();
  fs.writeFileSync(config.dbPath, Buffer.from(data));
}

// ── Tipos ────────────────────────────────────────────────────

export interface ReadingRow {
  id: number;
  dev_eui: string;
  device_name: string | null;
  f_cnt: number | null;
  f_port: number | null;
  temperature: number | null;
  moisture: number | null;
  electricity: number | null;
  raw_object: string;
  gateway_time: string | null;
  received_at: string;
}

export interface InsertReadingParams {
  devEUI: string;
  deviceName?: string;
  fCnt?: number;
  fPort?: number;
  temperature?: number | null;
  moisture?: number | null;
  electricity?: number | null;
  rawObject: string;
  gatewayTime?: string;
}

// ── Escritura ────────────────────────────────────────────────

export function insertReading(params: InsertReadingParams): number {
  db.run(
    `INSERT INTO readings
      (dev_eui, device_name, f_cnt, f_port, temperature, moisture, electricity, raw_object, gateway_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.devEUI,
      params.deviceName ?? null,
      params.fCnt ?? null,
      params.fPort ?? null,
      params.temperature ?? null,
      params.moisture ?? null,
      params.electricity ?? null,
      params.rawObject,
      params.gatewayTime ?? null,
    ]
  );

  // Obtener el último id insertado
  const result = db.exec("SELECT last_insert_rowid() as id");
  const id = result[0]?.values[0]?.[0] as number ?? 0;

  persist();
  return id;
}

// ── Lectura ──────────────────────────────────────────────────

function rowsFromExec(result: ReturnType<Database["exec"]>): ReadingRow[] {
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => (obj[col] = row[i]));
    return obj as unknown as ReadingRow;
  });
}

export function getReadings(limit: number, devEUI?: string): ReadingRow[] {
  if (devEUI) {
    const result = db.exec(
      `SELECT * FROM readings WHERE dev_eui = ? ORDER BY received_at DESC LIMIT ?`,
      [devEUI, limit]
    );
    return rowsFromExec(result);
  }
  const result = db.exec(
    `SELECT * FROM readings ORDER BY received_at DESC LIMIT ?`,
    [limit]
  );
  return rowsFromExec(result);
}

export function getLatest(devEUI: string): ReadingRow | null {
  const result = db.exec(
    `SELECT * FROM readings WHERE dev_eui = ? ORDER BY received_at DESC LIMIT 1`,
    [devEUI]
  );
  const rows = rowsFromExec(result);
  return rows[0] ?? null;
}