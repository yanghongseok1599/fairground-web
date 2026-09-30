# Supabase DB CA

Public root certificate downloaded on 2026-10-01 from the URL configured in
[official Supabase Studio content](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json):
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.

- SHA-256 fingerprint: `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`
- Valid until 2031-04-26. Replace from the official dashboard/source when Supabase rotates its CA.
- This is a public CA, not a credential or private key.
- The build gate adds it only for Supabase direct/pooler hosts. Explicit `sslrootcert` is preserved.
- Certificate chain and hostname verification remain required. `verify-ca`, `no-verify` and disabled TLS are rejected when their effective driver options weaken verification.

See [Supabase SSL documentation](https://supabase.com/docs/guides/platform/ssl-enforcement).
