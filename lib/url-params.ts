// lib/url-params.ts
//
// Синхронное чтение параметров из window.location.search.
//
// Используется для initial state в client-компонентах ВМЕСТО useSearchParams,
// потому что useSearchParams возвращает устаревший snapshot при перемонтировании
// (после router.replace) — это известная проблема Next.js App Router.
//
// window.location.search всегда актуален на клиенте.
// На сервере (SSR) возвращает пустую строку — но эти компоненты "use client",
// им SSR не нужен для initial state.
//
// ВАЖНО: использовать только в useEffect (после mount), иначе будет
// hydration mismatch (сервер вернёт '', клиент — реальное значение).

export function getInitialUrlParam(name: string): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get(name) ?? "";
}

/**
 * Собирает query-строку из объекта: пустые значения (null/undefined/"")
 * пропускаются. Возвращает "?a=b&c=d" либо "" — но никогда голый "?"
 * (голый «?» раньше оставался в адресе у 16 списочных страниц).
 */
export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Полный URL для router.replace: pathname без параметров либо pathname
 * с query. Убирает query-часть полностью, когда фильтров нет.
 */
export function buildUrl(
  pathname: string,
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const qs = buildQuery(params);
  return qs ? `${pathname}${qs}` : pathname;
}