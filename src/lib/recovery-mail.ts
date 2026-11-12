/**
 * Recovery mail is sent only to the allowlisted account email, never to a caller-selected address.
 * Gmail uses a dedicated OAuth token with gmail.send scope, configured for Electricista 360.
 */
export function recoveryMailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const resend = Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
  const gmail = Boolean(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET &&
    env.GMAIL_REFRESH_TOKEN && env.GMAIL_FROM);
  return resend || gmail;
}

export async function sendRecoveryMail(
  to: string,
  url: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const subject = "Recuperar acceso - Electricista 360";
  const message = "Para cambiar tu contraseña abre este enlace (15 minutos, un solo uso):\n" +
    url + "\nSi no solicitaste el cambio, ignora este mensaje.";
  if (env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [to], subject, text: message }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  }
  const id = env.GMAIL_CLIENT_ID, secret = env.GMAIL_CLIENT_SECRET;
  const refresh = env.GMAIL_REFRESH_TOKEN, from = env.GMAIL_FROM;
  if (!id || !secret || !refresh || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))
    return false;
  const access = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token"
    }).toString(),
    signal: AbortSignal.timeout(8000),
  });
  if (!access.ok) return false;
  const tokenResponse = await access.json() as { access_token?: string };
  if (!tokenResponse.access_token) return false;
  const headers = [
    "From: " + from,
    "To: " + to,
    "Subject: =?UTF-8?B?" + Buffer.from(subject, "utf8").toString("base64") + "?=",
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  const raw = Buffer.from(headers.join("\r\n") + "\r\n\r\n" + message, "utf8").toString("base64url");
  const result = await fetchImpl("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokenResponse.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(8000),
  });
  return result.ok;
}
