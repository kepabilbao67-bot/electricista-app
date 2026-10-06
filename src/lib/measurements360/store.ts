import { randomUUID } from "crypto";
import type { Client } from "@libsql/client";
import { getDbClient } from "@/lib/db";

export type MeasurementRecordSource = "calculator" | "camera" | "counter";

export interface MeasurementRecordInput {
  label: string;
  kind: string;
  value: number;
  unit: string;
  source: MeasurementRecordSource;
  parteId?: string | null;
  clientId?: string | null;
  budgetId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MeasurementRecord extends MeasurementRecordInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export async function ensureMeasurementsTable(db: Client = getDbClient()): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS measurements360_records (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'calculator',
      parte_id TEXT,
      client_id TEXT,
      budget_id TEXT,
      notes TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_measurements360_parte
      ON measurements360_records(parte_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_measurements360_client
      ON measurements360_records(client_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_measurements360_created
      ON measurements360_records(created_at);
  `);
}

function optionalText(value: string | null | undefined, max = 200): string | null {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned ? cleaned.slice(0, max) : null;
}

export async function saveMeasurementRecord(
  input: MeasurementRecordInput,
  db: Client = getDbClient(),
): Promise<MeasurementRecord> {
  await ensureMeasurementsTable(db);

  const label = input.label.trim().slice(0, 160);
  const kind = input.kind.trim().slice(0, 80);
  const unit = input.unit.trim().slice(0, 24);

  if (!label) throw new Error("La medición necesita una etiqueta.");
  if (!kind) throw new Error("Falta el tipo de medición.");
  if (!unit) throw new Error("Falta la unidad.");
  if (!Number.isFinite(input.value) || input.value < 0) {
    throw new Error("El valor de medición no es válido.");
  }
  if (!["calculator", "camera", "counter"].includes(input.source)) {
    throw new Error("Origen de medición no válido.");
  }

  const now = new Date().toISOString();
  const record: MeasurementRecord = {
    id: randomUUID(),
    label,
    kind,
    value: input.value,
    unit,
    source: input.source,
    parteId: optionalText(input.parteId, 120),
    clientId: optionalText(input.clientId, 120),
    budgetId: optionalText(input.budgetId, 120),
    notes: optionalText(input.notes, 2000),
    metadata: input.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.execute({
    sql: `INSERT INTO measurements360_records
      (id, label, kind, value, unit, source, parte_id, client_id, budget_id, notes, metadata_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      record.id,
      record.label,
      record.kind,
      record.value,
      record.unit,
      record.source,
      record.parteId ?? null,
      record.clientId ?? null,
      record.budgetId ?? null,
      record.notes ?? null,
      record.metadata ? JSON.stringify(record.metadata) : null,
      record.createdAt,
      record.updatedAt,
    ],
  });

  return record;
}

export async function listMeasurementRecords(
  filters: { parteId?: string | null; clientId?: string | null; limit?: number } = {},
  db: Client = getDbClient(),
): Promise<MeasurementRecord[]> {
  await ensureMeasurementsTable(db);

  const where: string[] = [];
  const args: (string | number)[] = [];

  if (filters.parteId) {
    where.push("parte_id = ?");
    args.push(filters.parteId);
  }
  if (filters.clientId) {
    where.push("client_id = ?");
    args.push(filters.clientId);
  }

  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 30)));
  args.push(limit);

  const result = await db.execute({
    sql:
      "SELECT * FROM measurements360_records" +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY created_at DESC LIMIT ?",
    args,
  });

  return result.rows.map((row) => {
    let metadata: Record<string, unknown> | null = null;
    if (row.metadata_json) {
      try {
        metadata = JSON.parse(String(row.metadata_json));
      } catch {
        metadata = null;
      }
    }

    return {
      id: String(row.id),
      label: String(row.label),
      kind: String(row.kind),
      value: Number(row.value),
      unit: String(row.unit),
      source: String(row.source) as MeasurementRecordSource,
      parteId: row.parte_id ? String(row.parte_id) : null,
      clientId: row.client_id ? String(row.client_id) : null,
      budgetId: row.budget_id ? String(row.budget_id) : null,
      notes: row.notes ? String(row.notes) : null,
      metadata,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  });
}
