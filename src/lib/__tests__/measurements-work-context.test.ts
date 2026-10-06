import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWorkContextHref, getParteIdFromSearch } from "../measurements360/work-context";

describe("Mediciones360/Luz360 work context", () => {
  it("recupera parte_id de la URL", () => {
    assert.equal(getParteIdFromSearch("?parte_id=parte-123"), "parte-123");
  });

  it("conserva el parte al saltar entre módulos", () => {
    assert.equal(buildWorkContextHref("/luz360", "parte 123"), "/luz360?parte_id=parte+123");
    assert.equal(buildWorkContextHref("/mediciones360", "parte-9"), "/mediciones360?parte_id=parte-9");
  });

  it("no añade query si no hay parte", () => {
    assert.equal(buildWorkContextHref("/luz360", ""), "/luz360");
  });
});
