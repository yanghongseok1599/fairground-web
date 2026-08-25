const DEFAULT_SITE_URL = "https://fairground-kor.com";
const LEGACY_SITE_HOSTS = new Set([
  "www.fairground-kor.com",
  "fairground-futsal.vercel.app",
  "fairground-footsal.vercel.app",
]);

function normalizeSiteUrl(value?: string): string {
  const raw = value?.trim();
  if (!raw) return DEFAULT_SITE_URL;

  try {
    const url = new URL(raw);
    if (LEGACY_SITE_HOSTS.has(url.hostname)) return DEFAULT_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const SITE_NAME = "FairGround";
