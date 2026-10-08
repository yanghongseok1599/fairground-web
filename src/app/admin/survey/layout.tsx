import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "설문 결과 | 관리자",
  robots: { index: false, follow: false },
};

export default function SurveyResultsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
