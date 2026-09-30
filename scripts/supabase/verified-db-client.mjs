import { checkServerIdentity, rootCertificates } from "node:tls";
import { readFileSync } from "node:fs";

// Public root from the official Supabase Studio SSL download; only trust it for Supabase hosts.
const supabaseCa = readFileSync(new URL("./certificates/supabase-ca-2021.crt", import.meta.url), "utf8");

/** Inspect the effective pg options after URL parsing, which overrides explicit SSL options. */
export function verifiedDatabaseClient(pg, options) {
  const client = new pg.Client({ ...options, ssl: { rejectUnauthorized: true } });
  const ssl = client.ssl;
  if (!ssl || (typeof ssl === "object" && (
    ssl.rejectUnauthorized === false ||
    (ssl.checkServerIdentity && ssl.checkServerIdentity !== checkServerIdentity)
  ))) {
    throw new Error("DB 연결에는 검증된 TLS가 필요합니다. sslmode=disable/no-verify 또는 인증서 검증 해제 설정을 제거하세요.");
  }
  if (typeof ssl === "object" && !ssl.ca && /^(?:db\.[a-z0-9]+\.supabase\.co|[a-z0-9.-]+\.pooler\.supabase\.com)$/i.test(client.host)) {
    // pg's Client and Connection share this parsed SSL options object.
    ssl.ca = [...rootCertificates, supabaseCa];
  }
  return client;
}
