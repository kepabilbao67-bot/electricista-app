import { test } from "node:test";
import assert from "node:assert/strict";
import { recoveryMailConfigured, sendRecoveryMail } from "../recovery-mail";

test("Gmail recovery: only dedicated OAuth env enables provider", () => {
  assert.equal(recoveryMailConfigured({} as NodeJS.ProcessEnv), false);
  assert.equal(recoveryMailConfigured({
    NODE_ENV: "test", GMAIL_CLIENT_ID: "client", GMAIL_CLIENT_SECRET: "secret",
    GMAIL_REFRESH_TOKEN: "refresh", GMAIL_FROM: "owner@example.com"
  } as NodeJS.ProcessEnv), true);
});

test("Gmail recovery: refresh token and send produce one addressed MIME message", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const env = {
    NODE_ENV: "test", GMAIL_CLIENT_ID: "test-client", GMAIL_CLIENT_SECRET: "test-secret",
    GMAIL_REFRESH_TOKEN: "test-refresh", GMAIL_FROM: "owner@example.com",
  } as NodeJS.ProcessEnv;
  const mock = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init: init || {} });
    if (calls.length === 1) return Response.json({ access_token: "test-access" });
    return Response.json({ id: "fake-mail-id" });
  };
  const result = await sendRecoveryMail("owner@example.com", "https://example.com/restablecer#token=fake", env, mock);
  assert.equal(result, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(calls[1].url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
  const body = JSON.parse(String(calls[1].init.body));
  const decoded = Buffer.from(body.raw, "base64url").toString("utf8");
  assert.match(decoded, /To: owner@example.com/);
  assert.match(decoded, /restablecer#token=fake/);
  assert.doesNotMatch(decoded, /test-secret|test-refresh/);
});

test("Gmail recovery: provider errors do not claim success", async () => {
  const env = {
    NODE_ENV: "test", GMAIL_CLIENT_ID: "x", GMAIL_CLIENT_SECRET: "y",
    GMAIL_REFRESH_TOKEN: "z", GMAIL_FROM: "owner@example.com",
  } as NodeJS.ProcessEnv;
  assert.equal(await sendRecoveryMail("owner@example.com", "https://example.com", env,
    async () => new Response("unauthorized", { status: 401 })), false);
});
