import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Server-only Supabase client. RSC/generateMetadata에서 사용.
// anon publishable key + RLS 정책으로 public read 접근 (board/notices/teams/profiles).
// 세션 의존성 없음 (persistSession: false) — 매 요청 stateless.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isDemoMode = !supabaseUrl || !supabaseKey;

export const supabaseServer = createClient<Database>(
  supabaseUrl ?? "https://demo.supabase.co",
  supabaseKey ?? "demo-publishable-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

export default supabaseServer;
