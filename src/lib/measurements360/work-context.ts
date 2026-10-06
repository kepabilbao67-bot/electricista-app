export function getParteIdFromSearch(search: string): string {
  const value = new URLSearchParams(search).get("parte_id");
  return value?.trim() ?? "";
}

export function buildWorkContextHref(pathname: string, parteId: string): string {
  const id = parteId.trim();
  if (!id) return pathname;
  const params = new URLSearchParams({ parte_id: id });
  return `${pathname}?${params.toString()}`;
}

export function replaceParteIdInCurrentUrl(parteId: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const id = parteId.trim();
  if (id) url.searchParams.set("parte_id", id);
  else url.searchParams.delete("parte_id");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
