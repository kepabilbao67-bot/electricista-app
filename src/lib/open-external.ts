export function openExternalCommunicationUrl(url: string): boolean {
  if (typeof window === "undefined") return false;

  const isMail = /^mailto:/i.test(url);
  const isWhatsApp = /^https:\/\/wa\.me\//i.test(url);
  if (!isMail && !isWhatsApp) return false;

  try {
    const bridge = window.AndroidExternal;
    if (bridge?.openUrl && bridge.openUrl(url)) {
      return true;
    }
  } catch {
    // Si el puente nativo no está disponible o falla, usa el navegador.
  }

  window.location.href = url;
  return true;
}
