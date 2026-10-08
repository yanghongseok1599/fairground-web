"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { parseSurveyResponses } from "./model";
import type { SurveyResponse } from "./model";

type SurveyResultsDatabase = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: { get_festival_survey_results: { Args: Record<never, never>; Returns: unknown } };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
// This is the existing browser client and its signed-in session, with a narrow RPC type.
const resultsClient = supabase as unknown as SupabaseClient<SurveyResultsDatabase>;

export class SurveyResultsAccessError extends Error {
  constructor() {
    super("승인된 관리자만 설문 결과를 볼 수 있습니다.");
    this.name = "SurveyResultsAccessError";
  }
}

export async function loadSurveyResponses(): Promise<SurveyResponse[]> {
  let data: unknown;
  try {
    const result = await resultsClient.rpc("get_festival_survey_results")
      .abortSignal(AbortSignal.timeout(15_000)).retry(false);
    if (result.error) {
      if (result.error.code === "42501" || result.status === 401 || result.status === 403) throw new SurveyResultsAccessError();
      throw new Error("설문 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
    data = result.data;
  } catch (error) {
    if (error instanceof SurveyResultsAccessError) throw error;
    if (error instanceof Error && [
      "설문 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    ].includes(error.message)) throw error;
    throw new Error("인터넷 연결을 확인한 뒤 설문 결과를 다시 불러와 주세요.");
  }
  return parseSurveyResponses(data);
}
