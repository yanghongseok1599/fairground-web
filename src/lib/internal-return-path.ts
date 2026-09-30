const RETURN_ORIGIN = "https://fairground.invalid";

/** Validate the path exactly as navigation will parse it; never return raw input. */
export function internalReturnPath(raw: string | null | undefined, fallback = "/my"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, RETURN_ORIGIN);
    // Dot-segment normalization can turn an apparently local path into //host.
    if (url.origin !== RETURN_ORIGIN || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
