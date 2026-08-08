import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  convertLength,
  toMm,
  fromMm,
  perimetroRectangulo,
  areaRectangulo,
  areaTriangulo,
  areaCirculo,
  volumenPrisma,
  volumenCilindro,
  pendientePorcentaje,
  pendienteGrados,
  caidaPorMetro,
  convertArea,
  convertVolume,
} from "../autonomo360/measurements";

// --- Conversiones de longitud ---

describe("measurements: convertLength", () => {
  test("mm a cm", () => {
    assert.equal(convertLength(10, "mm", "cm"), 1);
  });

  test("cm a m", () => {
    assert.equal(convertLength(100, "cm", "m"), 1);
  });

  test("m a mm", () => {
    assert.equal(convertLength(1, "m", "mm"), 1000);
  });

  test("misma unidad devuelve mismo valor", () => {
    assert.equal(convertLength(42, "cm", "cm"), 42);
  });

  test("mm a m", () => {
    assert.equal(convertLength(1500, "mm", "m"), 1.5);
  });
});

describe("measurements: toMm / fromMm", () => {
  test("toMm desde cm", () => {
    assert.equal(toMm(5, "cm"), 50);
  });

  test("fromMm a m", () => {
    assert.equal(fromMm(2500, "m"), 2.5);
  });
});

// --- Geometría ---

describe("measurements: perímetro", () => {
  test("rectángulo 3x4 = 14", () => {
    assert.equal(perimetroRectangulo(3, 4), 14);
  });

  test("cuadrado 5x5 = 20", () => {
    assert.equal(perimetroRectangulo(5, 5), 20);
  });

  test("dimensión negativa lanza error", () => {
    assert.throws(() => perimetroRectangulo(-1, 5), /negativas/);
  });
});

describe("measurements: área", () => {
  test("rectángulo 3x4 = 12", () => {
    assert.equal(areaRectangulo(3, 4), 12);
  });

  test("triángulo base=6 altura=4 = 12", () => {
    assert.equal(areaTriangulo(6, 4), 12);
  });

  test("círculo radio=1 ≈ π", () => {
    const area = areaCirculo(1);
    assert.ok(Math.abs(area - Math.PI) < 0.0001);
  });

  test("dimensión negativa lanza error", () => {
    assert.throws(() => areaRectangulo(-2, 3), /negativas/);
    assert.throws(() => areaCirculo(-1), /negativo/);
  });
});

describe("measurements: volumen", () => {
  test("prisma 2x3x4 = 24", () => {
    assert.equal(volumenPrisma(2, 3, 4), 24);
  });

  test("cilindro radio=1 alto=1 ≈ π", () => {
    const vol = volumenCilindro(1, 1);
    assert.ok(Math.abs(vol - Math.PI) < 0.0001);
  });

  test("dimensión negativa lanza error", () => {
    assert.throws(() => volumenPrisma(-1, 2, 3), /negativas/);
    assert.throws(() => volumenCilindro(-1, 2), /negativas/);
  });
});

// --- Pendiente ---

describe("measurements: pendiente", () => {
  test("pendiente 1m desnivel en 100m horizontal = 1%", () => {
    assert.equal(pendientePorcentaje(1, 100), 1);
  });

  test("pendiente 2m en 100m = 2%", () => {
    assert.equal(pendientePorcentaje(2, 100), 2);
  });

  test("pendiente 45 grados = desnivel igual a horizontal", () => {
    const grados = pendienteGrados(1, 1);
    assert.ok(Math.abs(grados - 45) < 0.0001);
  });

  test("distancia horizontal cero lanza error", () => {
    assert.throws(() => pendientePorcentaje(1, 0), /cero/);
    assert.throws(() => pendienteGrados(1, 0), /cero/);
  });

  test("caída por metro con 2% = 0.02", () => {
    assert.equal(caidaPorMetro(2), 0.02);
  });
});

// --- Conversiones de área y volumen ---

describe("measurements: convertArea", () => {
  test("1 m2 = 10000 cm2", () => {
    assert.equal(convertArea(1, "m2", "cm2"), 10000);
  });

  test("100 cm2 = 0.01 m2", () => {
    const result = convertArea(100, "cm2", "m2");
    assert.ok(Math.abs(result - 0.01) < 0.000001);
  });
});

describe("measurements: convertVolume", () => {
  test("1 m3 = 1000000000 mm3", () => {
    assert.equal(convertVolume(1, "m3", "mm3"), 1_000_000_000);
  });

  test("1000 cm3 = 1000000 mm3", () => {
    assert.equal(convertVolume(1000, "cm3", "mm3"), 1_000_000);
  });
});

// --- Valores especiales ---

describe("measurements: edge cases", () => {
  test("cero es válido en dimensiones", () => {
    assert.equal(areaRectangulo(0, 5), 0);
    assert.equal(volumenPrisma(0, 3, 4), 0);
    assert.equal(perimetroRectangulo(0, 0), 0);
  });

  test("valores decimales", () => {
    const area = areaRectangulo(2.5, 4.2);
    assert.ok(Math.abs(area - 10.5) < 0.0001);
  });
});
