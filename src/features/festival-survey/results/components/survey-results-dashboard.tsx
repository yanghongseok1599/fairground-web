"use client";

import { useState } from "react";
import { AlertCircle, Download, Inbox, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { filterSurveyResponses, summarizeSurveyResponses, type RoleFilter, type SurveyResponse } from "../model";
import { useSurveyResults } from "../use-survey-results";
import { DistributionPanels } from "./distribution-panels";
import { formatKstDate } from "./format";
import { ResponseExplorer } from "./response-explorer";
import { SummaryCards } from "./summary-cards";
import styles from "./survey-results.module.css";

const ROLE_FILTERS = [{ value: "all", label: "전체" }, { value: "captain", label: "주장" }, { value: "player", label: "선수" }] as const;

export function SurveyResultsDashboard({ onDownload }: { onDownload: (responses: SurveyResponse[]) => void }) {
  const { responses, loading, error, loadedAt, refresh } = useSurveyResults();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const filtered = filterSurveyResponses(responses, roleFilter);
  const summary = summarizeSurveyResponses(filtered);
  const hasLoaded = loadedAt !== null;

  return <div className={styles.dashboard}>
      <div className={styles.toolbar}>
        <div className={styles.roleFilters} aria-label="응답자 역할 필터">{ROLE_FILTERS.map(({ value, label }) => <button key={value} type="button" aria-pressed={roleFilter === value} onClick={() => setRoleFilter(value)} disabled={!hasLoaded}><span>{label}</span><strong>{filterSurveyResponses(responses, value).length}</strong></button>)}</div>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} className={loading ? styles.spinner : undefined} /> {loading ? "불러오는 중" : "새로고침"}</button>
          <button type="button" className={styles.downloadButton} onClick={() => onDownload(filtered)} disabled={!filtered.length || loading}><Download size={16} /> CSV 다운로드</button>
        </div>
      </div>
      <div className={styles.statusLine}><span><ShieldCheck size={15} /> 승인된 관리자 전용 · 익명 응답</span><span>{loadedAt ? `마지막 조회 ${formatKstDate(loadedAt)} KST` : "설문 결과를 확인하고 있습니다."}</span></div>
      {error && <div className={styles.errorState} role="alert"><AlertCircle size={20} /><div><p>{error}</p>{hasLoaded && <span>마지막으로 불러온 결과를 표시하고 있습니다.</span>}</div><button type="button" onClick={() => void refresh()} disabled={loading}>다시 시도</button></div>}
      {!hasLoaded && loading ? <div className={styles.loadingState} role="status"><LoaderCircle size={26} className={styles.spinner} /><p>익명 설문 응답을 불러오는 중입니다.</p></div> : hasLoaded && !responses.length ? <div className={styles.emptyState}><Inbox size={34} /><h2>아직 제출된 응답이 없습니다.</h2><p>참가자가 설문을 제출하면 통계와 의견이 이곳에 표시됩니다.</p><button type="button" className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} /> 새로고침</button></div> : hasLoaded && <>
        <SummaryCards summary={summary} />
        {!filtered.length ? <div className={styles.emptyState}><Inbox size={30} /><h2>선택한 역할의 응답이 없습니다.</h2><p>다른 역할을 선택하면 제출된 응답을 확인할 수 있습니다.</p></div> : <><DistributionPanels summary={summary} /><ResponseExplorer responses={filtered} filterKey={roleFilter} /></>}
      </>}
  </div>;
}
