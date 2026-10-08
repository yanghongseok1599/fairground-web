"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Clock3, LoaderCircle, LockKeyhole, MessageSquare, ShieldCheck } from "lucide-react";
import {
  CATEGORY_ITEMS, ENTRY_FEE_OPTIONS, MATCH_DURATION_OPTIONS, QUESTION_TITLES,
  RETURN_INTENT_OPTIONS, ROLE_OPTIONS, RULES_OPINION_OPTIONS,
  SURVEY_DESCRIPTION, SURVEY_TITLE, countAnsweredQuestions,
  type SurveyAnswers,
} from "../model";
import { useSurvey } from "../use-survey";
import { CategoryRatings, ChoiceField, Question, RatingField, TextField } from "./survey-fields";
import styles from "../survey.module.css";

function Wordmark() {
  return <span className={styles.wordmark} role="img" aria-label="페어그라운드" />;
}

function SectionHeading({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className={styles.sectionHeading}><span>{number}</span><div><h2>{title}</h2><p>{detail}</p></div></div>;
}

export function FestivalSurvey() {
  const { answers, errors, update, submit, pending, submitting, submitted, message, ready, storageWarning } = useSurvey();
  const completed = countAnsweredQuestions(answers) - Number(Boolean(answers.safetyIncident.trim())) - Number(Boolean(answers.suggestions.trim()));
  const progress = Math.round(completed / 10 * 100);
  const choices = <K extends "role" | "returnIntent" | "rulesOpinion" | "matchDuration" | "entryFee">(name: K, options: readonly { value: string; label: string }[], compact = false) => (
    <ChoiceField name={name} options={options} value={answers[name]} onChange={(value) => update(name, value as SurveyAnswers[K])} compact={compact} />
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="페어그라운드 홈"><Wordmark /></Link>
          <span className={styles.headerLabel}>FESTIVAL FEEDBACK</span>
          <Link href="/" className={styles.homeLink}>홈으로 <ArrowUpRight size={15} /></Link>
        </div>
        {!submitted && <div className={styles.progressTrack}><div style={{ width: `${progress}%` }} /></div>}
      </header>

      {submitted ? (
        <main className={styles.success}>
          <div className={styles.successIcon}><Check size={38} strokeWidth={2} /></div>
          <span className={styles.eyebrow}>THANK YOU FOR PLAYING</span>
          <h1 tabIndex={-1} ref={(node) => node?.focus()}>여러분의 이야기가<br />다음 페스티벌의 시작입니다.</h1>
          <p>설문이 제출되었습니다.<br />함께 뛰어주시고, 소중한 의견을 들려주셔서 감사합니다.</p>
          <div className={styles.receipt}><CheckCircle2 size={18} /> 익명 응답 제출 완료</div>
          <Link className={styles.primaryLink} href="/">페어그라운드로 돌아가기 <ArrowRight size={18} /></Link>
        </main>
      ) : (
        <>
          <section className={styles.hero} aria-labelledby="survey-title">
            <div className={styles.heroContent}>
              <div className={styles.heroEyebrow}><span className={styles.edition}>제1회</span><span>FAIRGROUND MIXED FUTSAL FESTIVAL</span></div>
              <h1 id="survey-title" aria-label={SURVEY_TITLE}>제1회 페어그라운드<br />혼성풋살페스티벌<br /><span>만족도 조사</span></h1>
              <p className={styles.heroMessage}>함께한 첫 번째 페스티벌,<br className={styles.mobileBreak} /> 여러분의 이야기를 들려주세요.</p>
              <div className={styles.heroTags}><span><Clock3 size={15} /> 약 3분</span><span><LockKeyhole size={15} /> 익명 응답</span><span><MessageSquare size={15} /> 총 12문항</span></div>
            </div>
            <div className={styles.heroArt} aria-hidden="true"><div className={styles.court}><div className={styles.centerLine} /><div className={styles.centerCircle} /><div className={styles.goalLeft} /><div className={styles.goalRight} /><span className={styles.courtDot} /></div><span className={styles.artCaption}>OUR FIRST KICKOFF.<br />OUR NEXT CHAPTER.</span><span className={styles.artNumber}>01</span></div>
          </section>

          <main className={styles.content}>
            <aside className={styles.sidebar}>
              <div className={styles.sidebarSticky}>
                <span className={styles.eyebrow}>YOUR VOICE MATTERS</span>
                <h2>더 좋은 대회를<br />함께 만들어가요.</h2>
                <p>{SURVEY_DESCRIPTION}</p>
                <div className={styles.progressCard}><div><span>필수 문항 응답</span><strong>{completed}<small> / 10</small></strong></div><progress max={10} value={completed} aria-label="필수 문항 응답 진행률" /><p>나머지 2문항은 선택 사항입니다.</p></div>
                <nav className={styles.sectionNav} aria-label="설문 섹션"><a href="#section-overall"><span>01</span> 대회 전반</a><a href="#section-operation"><span>02</span> 운영과 경기</a><a href="#section-feedback"><span>03</span> 자유 의견</a></nav>
                <div className={styles.privacy}><ShieldCheck size={18} /><span>이름·연락처 없이<br />의견만 익명으로 받습니다.</span></div>
              </div>
            </aside>

            <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }} aria-label={SURVEY_TITLE}>
              <div className={styles.formIntro}><span><span className={styles.requiredDot}>*</span> 표시는 필수 문항입니다.</span><span className={styles.mobileProgress}>{completed} / 10 완료</span></div>
              <fieldset className={styles.formFields} disabled={submitting || Boolean(pending) || !ready}>
                <section id="section-overall" className={styles.section}>
                  <SectionHeading number="01" title="대회는 어떠셨나요?" detail="첫 페스티벌의 전반적인 경험을 알려주세요." />
                  <Question id="role" number={1} title={QUESTION_TITLES.role} error={errors.role}>{choices("role", ROLE_OPTIONS, true)}</Question>
                  <Question id="overallSatisfaction" number={2} title={QUESTION_TITLES.overallSatisfaction} error={errors.overallSatisfaction}><RatingField name="overallSatisfaction" min={1} max={5} value={answers.overallSatisfaction} onChange={(value) => update("overallSatisfaction", value)} minLabel="매우 불만족" maxLabel="매우 만족" /></Question>
                  <Question id="recommendation" number={3} title={QUESTION_TITLES.recommendation} error={errors.recommendation}><RatingField name="recommendation" min={0} max={10} value={answers.recommendation} onChange={(value) => update("recommendation", value)} minLabel="전혀 추천하지 않음" maxLabel="적극 추천" /></Question>
                  <Question id="returnIntent" number={4} title={QUESTION_TITLES.returnIntent} error={errors.returnIntent}>{choices("returnIntent", RETURN_INTENT_OPTIONS)}</Question>
                </section>

                <section id="section-operation" className={styles.section}>
                  <SectionHeading number="02" title="운영과 경기를 돌아보며" detail="좋았던 부분과 더 나아질 부분을 살펴볼게요." />
                  <Question id="categoryRatings" number={5} title={QUESTION_TITLES.categoryRatings} description="모든 항목에 하나씩 선택해 주세요." error={errors.categoryRatings || CATEGORY_ITEMS.map(({ key }) => errors[`categoryRatings.${key}`]).find(Boolean)}><CategoryRatings values={answers.categoryRatings} onChange={(key, value) => update("categoryRatings", { ...answers.categoryRatings, [key]: value })} errors={errors} /></Question>
                  <Question id="rulesOpinion" number={6} title={QUESTION_TITLES.rulesOpinion} error={errors.rulesOpinion}>{choices("rulesOpinion", RULES_OPINION_OPTIONS)}</Question>
                  <Question id="matchDuration" number={7} title={QUESTION_TITLES.matchDuration} error={errors.matchDuration}>{choices("matchDuration", MATCH_DURATION_OPTIONS, true)}</Question>
                  <Question id="entryFee" number={8} title={QUESTION_TITLES.entryFee} error={errors.entryFee}>{choices("entryFee", ENTRY_FEE_OPTIONS, true)}</Question>
                </section>

                <section id="section-feedback" className={styles.section}>
                  <SectionHeading number="03" title="여러분의 이야기를 들려주세요" detail="짧은 한마디도 다음 대회에 큰 도움이 됩니다." />
                  <Question id="bestMoment" number={9} title={QUESTION_TITLES.bestMoment} error={errors.bestMoment}><TextField name="bestMoment" value={answers.bestMoment} onChange={(value) => update("bestMoment", value)} required placeholder="기억에 남는 좋았던 순간을 알려주세요." /></Question>
                  <Question id="improvement" number={10} title={QUESTION_TITLES.improvement} error={errors.improvement}><TextField name="improvement" value={answers.improvement} onChange={(value) => update("improvement", value)} required placeholder="다음 대회에서 개선되었으면 하는 점을 알려주세요. 없으시면 ‘없음’이라고 적어주세요." /></Question>
                  <Question id="safetyIncident" number={11} title={QUESTION_TITLES.safetyIncident} required={false} error={errors.safetyIncident}><TextField name="safetyIncident" value={answers.safetyIncident} onChange={(value) => update("safetyIncident", value)} placeholder="해당하는 경험이 있을 때만 적어주세요." /></Question>
                  <Question id="suggestions" number={12} title={QUESTION_TITLES.suggestions} required={false} error={errors.suggestions}><TextField name="suggestions" value={answers.suggestions} onChange={(value) => update("suggestions", value)} placeholder="새로운 프로그램이나 바라는 점 등 무엇이든 좋아요." /></Question>
                </section>
              </fieldset>

              <div className={styles.submitArea}>
                {storageWarning && <p className={styles.retryNotice} role="status">{storageWarning}</p>}
                {message && <p className={styles.formError} role="alert">{message}</p>}
                {pending && !submitting && <p className={styles.retryNotice}>같은 응답을 다시 전송해 제출 결과를 확인할 수 있습니다. 중복 제출을 방지하기 위해 접수가 확인되기 전까지 답변을 변경하지 않습니다.</p>}
                <button type="submit" className={styles.submitButton} disabled={submitting || !ready}>{submitting ? <><LoaderCircle className={styles.spinner} size={20} /> 응답 전송 중</> : <>{pending ? "응답 다시 전송" : "설문 제출하기"}<ArrowRight size={20} /></>}</button>
                <p>보내주신 의견은 다음 대회를 준비하는 데 소중히 활용됩니다.</p>
              </div>
            </form>
          </main>
        </>
      )}
      <footer className={styles.footer}><span>FAIRGROUND</span><p>함께 뛰는 즐거움, 함께 만드는 페어그라운드.</p><span>© {new Date().getFullYear()} FAIRGROUND</span></footer>
    </div>
  );
}
