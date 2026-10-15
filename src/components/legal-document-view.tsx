/**
 * 법적 문서 렌더러. /terms /privacy /refund 가 모두 이것 하나를 쓴다 (키트 legal-document-view).
 *
 * 초안 배너: 시행일이 없거나 확정 안 된 항목이 남은 문서, 또는 사업자 정보가 비어 있으면 띄운다.
 * 확정 전 문서를 정식처럼 게시하면 그 내용이 그대로 계약 조건이 된다.
 */
import { BUSINESS_INFO_READY } from "@/lib/business-info";
import { isDraft, type LegalDocument } from "@/lib/legal-document";

export function LegalDocumentView({ doc, history }: { doc: LegalDocument; history?: { version: string; href: string }[] }) {
  const draft = isDraft(doc) || !BUSINESS_INFO_READY;
  return (
    <article className="mx-auto w-full max-w-3xl px-5 pb-16 pt-[92px] text-foreground" style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}>
      <h1 className="text-2xl font-black sm:text-3xl">{doc.title}</h1>
      {draft ? (
        <p role="status" className="mt-4 rounded-xl border border-primary/30 bg-muted px-4 py-3 text-sm leading-relaxed">
          이 문서는 확정 전 초안입니다. 표시된 항목은 운영 정보가 정해지면 갱신됩니다.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        버전 {doc.version}
        {doc.effectiveAt ? <> · 시행일 {doc.effectiveAt}</> : <> · 시행일 미정</>}
      </p>
      <nav aria-label="목차" className="mt-6 rounded-2xl border border-border bg-muted/40 p-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {doc.sections.map((s, i) => <li key={s.heading}><a href={`#s${i + 1}`} className="underline-offset-2 hover:underline">{s.heading}</a></li>)}
        </ol>
      </nav>
      {doc.sections.map((s, i) => (
        <section key={s.heading} id={`s${i + 1}`} data-pending={s.pending || undefined} className="mt-8 scroll-mt-24">
          <h2 className="text-lg font-bold">
            {s.heading}
            {s.pending ? <span className="ml-2 text-sm font-bold text-destructive">(확정 전)</span> : null}
          </h2>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {s.body.map((p, j) => <p key={j}>{p}</p>)}
          </div>
        </section>
      ))}
      {history && history.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-bold">이전 버전</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">{history.map((h) => <li key={h.version}><a href={h.href}>{h.version}</a></li>)}</ul>
        </section>
      ) : null}
    </article>
  );
}
