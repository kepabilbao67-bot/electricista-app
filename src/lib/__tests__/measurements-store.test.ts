import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import {
  ensureMeasurementsTable,
  listMeasurementRecords,
  saveMeasurementRecord,
} from "../measurements360/store";

test("Mediciones360 persiste y filtra por parte sin tocar la BD real", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await ensureMeasurementsTable(db);

    const first = await saveMeasurementRecord(
      {
        label: "Salón - perímetro",
        kind: "perimeter",
        value: 14.5,
        unit: "m",
        source: "calculator",
        parteId: "parte-1",
        metadata: { a: 4, b: 3.25 },
      },
      db,
    );

    await saveMeasurementRecord(
      {
        label: "Dormitorio - cámara",
        kind: "camera-distance",
        value: 215,
        unit: "cm",
        source: "camera",
        parteId: "parte-2",
      },
      db,
    );

    assert.ok(first.id);
    const all = await listMeasurementRecords({ limit: 20 }, db);
    assert.equal(all.length, 2);

    const parte1 = await listMeasurementRecords({ parteId: "parte-1" }, db);
    assert.equal(parte1.length, 1);
    assert.equal(parte1[0].label, "Salón - perímetro");
    assert.equal(parte1[0].value, 14.5);
    assert.deepEqual(parte1[0].metadata, { a: 4, b: 3.25 });
  } finally {
    db.close();
  }
});

test("Mediciones360 rechaza valores inválidos", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await assert.rejects(
      () =>
        saveMeasurementRecord(
          {
            label: "Medida imposible",
            kind: "length",
            value: Number.NaN,
            unit: "m",
            source: "calculator",
          },
          db,
        ),
      /no es válido/,
    );
  } finally {
    db.close();
  }
});
