/**
 * Central CRM integration settings. No network access or customer data migration.
 * Keep credentials server-only and never infer tenant identity from user input.
 */
export type CentralCrmConfiguration =
  | { ready: false; reason: "disabled" | "missing_configuration" | "unsafe_url" }
  | { ready: true; origin: string; tenantId: string; token: string };

export function centralCrmConfiguration(env: NodeJS.ProcessEnv = process.env): CentralCrmConfiguration {
  if (env.APP_VERTICAL !== "tecnologia" || env.CENTRAL_CRM_ENABLED !== "true") {
    return { ready: false, reason: "disabled" };
  }
  const rawUrl = env.CENTRAL_CRM_BASE_URL?.trim();
  const tenantId = env.CENTRAL_CRM_TENANT_ID?.trim();
  const token = env.CENTRAL_CRM_SERVICE_TOKEN?.trim();
  if (!rawUrl || !tenantId || !token) {
    return { ready: false, reason: "missing_configuration" };
  }
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.search || url.hash || url.pathname !== "/" ||
        url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
        /^(127|10|0)\./.test(url.hostname) ||
        /^192\.168\./.test(url.hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) {
      return { ready: false, reason: "unsafe_url" };
    }
    if (!/^[a-zA-Z0-9_-]{3,128}$/.test(tenantId)) {
      return { ready: false, reason: "missing_configuration" };
    }
    return { ready: true, origin: url.origin, tenantId, token };
  } catch {
    return { ready: false, reason: "unsafe_url" };
  }
}
