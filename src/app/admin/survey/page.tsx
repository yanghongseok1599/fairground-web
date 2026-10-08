"use client";

import { AdminGuard } from "@/components/admin-guard";
import { AdminShell } from "@/components/admin-shell";
import { SurveyResultsDashboard } from "@/features/festival-survey/results/components/survey-results-dashboard";
import { downloadSurveyResponsesCsv } from "@/features/festival-survey/results/export-csv";
import { SURVEY_TITLE } from "@/features/festival-survey/model";
import { useAuth } from "@/hooks/useAuth";

export default function SurveyResultsPage() {
  const { user } = useAuth();
  return (
    <AdminGuard allow={["admin"]} requireApproval>
      <AdminShell
        eyebrow="FESTIVAL SURVEY REPORT"
        title="설문 결과"
        description={SURVEY_TITLE}
      >
        <SurveyResultsDashboard key={user?.uid} onDownload={downloadSurveyResponsesCsv} />
      </AdminShell>
    </AdminGuard>
  );
}
