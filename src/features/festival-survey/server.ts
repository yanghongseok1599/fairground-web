import { createClient } from "@supabase/supabase-js";
import type { SurveySubmission, ValidatedSurveyAnswers } from "./model";

// Keep this small RPC contract independent from the shared application schema.
type SurveyDatabase = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      submit_festival_survey: {
        Args: { p_response_id: string; p_answers: ValidatedSurveyAnswers };
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type SurveySaveResult = { success: true } | { success: false; status: number; error: string };

/** A fresh anonymous client never forwards participant cookies or member sessions. */
export async function saveSurveyResponse(submission: SurveySubmission): Promise<SurveySaveResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { success: false, status: 503, error: "설문 접수가 준비 중입니다. 잠시 후 다시 시도해 주세요." };
  try {
    const client = createClient<SurveyDatabase>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.rpc("submit_festival_survey", {
      p_response_id: submission.responseId, p_answers: submission.answers,
    }).abortSignal(AbortSignal.timeout(12_000)).retry(false);
    if (error) {
      if (error.code === "23505") return { success: false, status: 409, error: "이미 제출된 응답입니다. 같은 응답은 다시 제출할 수 없습니다." };
      if (error.code === "22023") return { success: false, status: 422, error: "응답 내용을 확인하고 다시 제출해 주세요." };
      return { success: false, status: 503, error: "응답 접수를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요." };
    }
    if (data !== true) return { success: false, status: 503, error: "응답 접수를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요." };
    return { success: true };
  } catch {
    return { success: false, status: 503, error: "인터넷 연결을 확인한 뒤 다시 제출해 주세요." };
  }
}
