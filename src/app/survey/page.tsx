import type { Metadata } from "next";
import { FestivalSurvey } from "@/features/festival-survey/components/festival-survey";
import { SURVEY_TITLE, SURVEY_DESCRIPTION } from "@/features/festival-survey/model";

export const metadata: Metadata = {
  title: SURVEY_TITLE,
  description: SURVEY_DESCRIPTION,
  alternates: { canonical: "/survey", languages: {} },
  robots: { index: false, follow: false },
  openGraph: {
    title: SURVEY_TITLE,
    description: "함께한 첫 번째 페스티벌, 여러분의 이야기를 들려주세요. 익명 설문 · 약 3분",
    url: "/survey",
  },
  twitter: { title: SURVEY_TITLE, description: SURVEY_DESCRIPTION },
};

export default function SurveyPage() {
  return <FestivalSurvey />;
}
