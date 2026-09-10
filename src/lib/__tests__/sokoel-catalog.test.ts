import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  SOKOEL_CATALOG,
  SOKOEL_DOCUMENT_SUBTOTAL,
  SOKOEL_DOCUMENT_TOTAL,
  SOKOEL_DOCUMENT_VAT,
  SOKOEL_DOCUMENT_VAT_RATE,
  SOKOEL_PRICE_DATE,
  SOKOEL_SOURCE_DOCUMENT,
  getSokoelDocumentSubtotal,
  hasUniqueSokoelReferences,
} from "../sokoel-catalog";

describe("SOKOEL catalog — Oferta 100790", () => {
  test("contains exactly 32 products", () => {
    assert.equal(SOKOEL_CATALOG.length, 32);
  });

  test("all supplier references are unique", () => {
    assert.equal(hasUniqueSokoelReferences(), true);
  });

  test("document subtotal matches 694.70 EUR", () => {
    assert.equal(getSokoelDocumentSubtotal(), 694.7);
    assert.equal(SOKOEL_DOCUMENT_SUBTOTAL, 694.7);
  });

  test("document VAT and total match source offer", () => {
    assert.equal(SOKOEL_DOCUMENT_VAT_RATE, 21);
    assert.equal(SOKOEL_DOCUMENT_VAT, 145.89);
    assert.equal(SOKOEL_DOCUMENT_TOTAL, 840.59);
  });

  test("all supplier costs are positive and no sale price is invented", () => {
    for (const item of SOKOEL_CATALOG) {
      assert.ok(item.costPrice > 0, `${item.supplierReference} must have a positive supplier cost`);
      assert.equal("unitPrice" in item, false, `${item.supplierReference} must not contain a sale price`);
    }
  });

  test("source metadata is fixed", () => {
    assert.equal(SOKOEL_PRICE_DATE, "2026-08-24");
    assert.equal(SOKOEL_SOURCE_DOCUMENT, "Oferta 100790");
  });

  test("key references and costs are preserved", () => {
    const byRef = new Map(SOKOEL_CATALOG.map((item) => [item.supplierReference, item]));
    assert.equal(byRef.get("N2100 BL")?.costPrice, 1.49);
    assert.equal(byRef.get("N2288 BL")?.costPrice, 3.0288888889);
    assert.equal(byRef.get("2CDS251190R0164")?.costPrice, 3.22);
    assert.equal(byRef.get("77706517")?.costPrice, 127.09);
    assert.equal(byRef.get("TD-603UT-D-LBR")?.costPrice, 0.4080983607);
    assert.equal(byRef.get("RTR50608PLAS")?.costPrice, 47.03);
  });
});
