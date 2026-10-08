"use client";

import { useState } from "react";
import { ChevronDown, MessageSquare, Rows3 } from "lucide-react";
import {
  CATEGORY_ITEMS, ENTRY_FEE_OPTIONS, MATCH_DURATION_OPTIONS, QUESTION_TITLES,
  RETURN_INTENT_OPTIONS, ROLE_OPTIONS, RULES_OPINION_OPTIONS,
} from "../../model";
import type { SurveyResponse } from "../model";
import { formatKstDate } from "./format";
import styles from "./survey-results.module.css";

type CommentField = "bestMoment" | "improvement" | "safetyIncident" | "suggestions";
const COMMENT_FIELDS: readonly { key: CommentField; label: string; number: number }[] = [
  { key: "bestMoment", label: "좋았던 점", number: 9 },
  { key: "improvement", label: "아쉬웠던 점", number: 10 },
  { key: "safetyIncident", label: "위험·불편한 순간", number: 11 },
  { key: "suggestions", label: "추가·기타 의견", number: 12 },
];
const PAGE_SIZE = 20;

function optionLabel(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? "응답 없음";
}

function ResponseDetail({ response }: { response: SurveyResponse }) {
  const { answers } = response;
  const items = [
    { key: "role", value: optionLabel(ROLE_OPTIONS, answers.role) },
    { key: "overallSatisfaction", value: `${answers.overallSatisfaction} / 5점` },
    { key: "recommendation", value: `${answers.recommendation} / 10점` },
    { key: "returnIntent", value: optionLabel(RETURN_INTENT_OPTIONS, answers.returnIntent) },
    { key: "categoryRatings", value: <ul className={styles.detailCategories}>{CATEGORY_ITEMS.map(({ key, label }) => <li key={key}><span>{label}</span><strong>{answers.categoryRatings[key]} / 5점</strong></li>)}</ul> },
    { key: "rulesOpinion", value: optionLabel(RULES_OPINION_OPTIONS, answers.rulesOpinion) },
    { key: "matchDuration", value: optionLabel(MATCH_DURATION_OPTIONS, answers.matchDuration) },
    { key: "entryFee", value: optionLabel(ENTRY_FEE_OPTIONS, answers.entryFee) },
    { key: "bestMoment", value: answers.bestMoment },
    { key: "improvement", value: answers.improvement },
    { key: "safetyIncident", value: answers.safetyIncident || "응답 없음 (선택 문항)" },
    { key: "suggestions", value: answers.suggestions || "응답 없음 (선택 문항)" },
  ] as const;

  return <dl className={styles.responseDetail}>{items.map((item, index) => <div key={item.key}>
    <dt><span>Q{String(index + 1).padStart(2, "0")}</span>{QUESTION_TITLES[item.key]}</dt>
    <dd>{item.value}</dd>
  </div>)}</dl>;
}

export function ResponseExplorer({ responses, filterKey }: { responses: SurveyResponse[]; filterKey: string }) {
  return <ResponseExplorerContent key={filterKey} responses={responses} />;
}

function ResponseExplorerContent({ responses }: { responses: SurveyResponse[] }) {
  const [view, setView] = useState<"comments" | "responses">("comments");
  const [field, setField] = useState<CommentField>("bestMoment");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const ordered = [...responses].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const comments = ordered.filter((response) => response.answers[field].trim());
  const selected = COMMENT_FIELDS.find((item) => item.key === field)!;
  const items = view === "comments" ? comments : ordered;

  return <section aria-labelledby="survey-responses-title" className={styles.dashboardSection}>
    <div className={styles.sectionTitle}><div><h2 id="survey-responses-title">참가자의 목소리</h2><p>자유 의견을 읽고, 개별 응답의 전체 문항을 확인하세요.</p></div></div>
    <div className={styles.explorerPanel}>
      <div className={styles.explorerTabs} aria-label="응답 보기 방식">
        <button type="button" aria-pressed={view === "comments"} onClick={() => { setView("comments"); setVisibleCount(PAGE_SIZE); }}><MessageSquare size={16} /> 자유 의견</button>
        <button type="button" aria-pressed={view === "responses"} onClick={() => { setView("responses"); setVisibleCount(PAGE_SIZE); }}><Rows3 size={16} /> 개별 응답 <span>{responses.length}</span></button>
      </div>
      {view === "comments" && <div className={styles.commentFilters} aria-label="자유 의견 문항">{COMMENT_FIELDS.map(({ key, label }) => <button type="button" key={key} aria-pressed={field === key} onClick={() => { setField(key); setVisibleCount(PAGE_SIZE); }}>{label}<span>{ordered.filter((response) => response.answers[key].trim()).length}</span></button>)}</div>}
      <div className={styles.explorerContent}>
        {view === "comments" && <p className={styles.commentQuestion}>Q{selected.number} · {QUESTION_TITLES[field]}</p>}
        {!items.length ? <p className={styles.noComments}>{view === "comments" ? "이 문항에 남겨진 의견이 없습니다." : "현재 선택한 역할의 응답이 없습니다."}</p> : view === "comments" ? <ul className={styles.commentList}>{comments.slice(0, visibleCount).map((response) => <li key={response.responseId}>
          <div className={styles.responseMeta}><span className={styles.roleBadge}>{optionLabel(ROLE_OPTIONS, response.answers.role)}</span><time dateTime={response.createdAt}>{formatKstDate(response.createdAt)} KST</time></div>
          <p>{response.answers[field]}</p>
        </li>)}</ul> : <div className={styles.individualResponses}>{ordered.slice(0, visibleCount).map((response, index) => <details key={response.responseId} className={styles.responseItem}>
          <summary><div className={styles.responseSummary}><span className={styles.responseIndex}>응답 {index + 1}</span><span className={styles.roleBadge}>{optionLabel(ROLE_OPTIONS, response.answers.role)}</span><time dateTime={response.createdAt}>{formatKstDate(response.createdAt)} KST</time></div><div className={styles.responseScores}><span>만족 <strong>{response.answers.overallSatisfaction}</strong>/5</span><span>추천 <strong>{response.answers.recommendation}</strong>/10</span><span className={styles.openLabel}>전체 답변 <ChevronDown size={16} /></span></div></summary>
          <ResponseDetail response={response} />
        </details>)}</div>}
        {items.length > visibleCount && <button type="button" className={styles.moreButton} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>응답 더 보기 <span>({Math.min(visibleCount, items.length)} / {items.length})</span><ChevronDown size={16} /></button>}
      </div>
    </div>
  </section>;
}
