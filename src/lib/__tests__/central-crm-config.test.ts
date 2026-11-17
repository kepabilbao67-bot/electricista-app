import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { centralCrmConfiguration } from "../central-crm/config";

const base = {
  APP_VERTICAL: "tecnologia",
  CENTRAL_CRM_ENABLED: "true",
  CENTRAL_CRM_BASE_URL: "https://crm.example.com",
  CENTRAL_CRM_TENANT_ID: "tenant_kepa",
  CENTRAL_CRM_SERVICE_TOKEN: "server-only-token",
};

describe("central CRM safe configuration", () => {
  test("disabled by default", () => {
    assert.deepEqual(centralCrmConfiguration({}), { ready: false, reason: "disabled" });
  });
  test("not enabled for other verticals", () => {
    assert.equal(centralCrmConfiguration({ ...base, APP_VERTICAL: "electricista" }).ready, false);
  });
  test("rejects partial configuration", () => {
    const { CENTRAL_CRM_SERVICE_TOKEN: _token, ...partial } = base;
    assert.equal(centralCrmConfiguration(partial).ready, false);
  });
  test("accepts an explicit HTTPS service and fixed tenant", () => {
    const result = centralCrmConfiguration(base);
    assert.equal(result.ready, true);
    if (result.ready) assert.equal(result.tenantId, "tenant_kepa");
  });
  test("blocks insecure and local destinations", () => {
    for (const bad of ["http://crm.example.com", "https://127.0.0.1", "https://192.168.1.20", "https://crm.example.com/path", "https://a:b@crm.example.com"]) {
      assert.equal(centralCrmConfiguration({ ...base, CENTRAL_CRM_BASE_URL: bad }).ready, false);
    }
  });
  test("rejects unknown tenant identifiers", () => {
    assert.equal(centralCrmConfiguration({ ...base, CENTRAL_CRM_TENANT_ID: "../other" }).ready, false);
  });
});
