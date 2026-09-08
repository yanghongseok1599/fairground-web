"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { registrationFetch } from "@/lib/registration/reliability";
import type { Database } from "@/lib/database.types";

// FairGround Supabase (project ovtnmslyjzvghirdvife, 서울 ap-northeast-2)
// Firebase RTDB → Supabase Postgres 마이그레이션 (그린필드).
// 보안: 권한은 RLS + end_match() 트랜잭션 RPC로 서버측 강제 (D-B/D-C 해결).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const missingSupabaseEnv = !supabaseUrl || !supabaseKey;

// 데모 모드: 환경변수 미설정 시. Firebase 시절 isDemoMode 분기를 대체.
export const isDemoMode = missingSupabaseEnv;

if (process.env.NODE_ENV === "production" && missingSupabaseEnv) {
  throw new Error(
    "Missing Supabase public environment variables. Production demo mode is blocked."
  );
}

type FairGroundGlobal = typeof globalThis & {
  __fairgroundSupabase?: SupabaseClient<Database>;
};

function createSupabaseBrowserClient(): SupabaseClient<Database> {
  return createClient<Database>(
    supabaseUrl ?? "https://demo.supabase.co",
    supabaseKey ?? "demo-publishable-key",
    {
      global: { fetch: registrationFetch },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}

const fairGroundGlobal = globalThis as FairGroundGlobal;

export const supabase =
  fairGroundGlobal.__fairgroundSupabase ??
  (fairGroundGlobal.__fairgroundSupabase = createSupabaseBrowserClient());

export default supabase;
