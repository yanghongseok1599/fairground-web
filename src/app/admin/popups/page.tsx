"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ChevronRight, Eye, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteSitePopup,
  fetchAdminSitePopups,
  getEmptyPopupDraft,
  joinPopupTitleLines,
  popupToDraft,
  saveSitePopup,
  splitPopupTitleLines,
  type SitePopup,
  type SitePopupDraft,
} from "@/lib/site-popups";

export default function AdminPopupsPage() {
  return (
    <AdminGuard allow={["admin"]}>
      <AdminPopups />
    </AdminGuard>
  );
}

function AdminPopups() {
  const [popups, setPopups] = useState<SitePopup[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<SitePopupDraft>(getEmptyPopupDraft);
  const [titleLineOne, setTitleLineOne] = useState(
    () => splitPopupTitleLines(getEmptyPopupDraft().title).lineOne,
  );
  const [titleLineTwo, setTitleLineTwo] = useState(
    () => splitPopupTitleLines(getEmptyPopupDraft().title).lineTwo,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActiveHintId = useId();

  const selectedPopup = useMemo(
    () => popups.find((popup) => popup.id === selectedId) ?? null,
    [popups, selectedId],
  );

  /**
   * draft 와 제목 두 줄 상태를 항상 함께 갈아끼운다.
   * (팝업을 바꿔 선택했는데 이전 제목이 남는 버그 방지)
   */
  const loadDraft = (nextDraft: SitePopupDraft) => {
    const { lineOne, lineTwo } = splitPopupTitleLines(nextDraft.title);
    setDraft(nextDraft);
    setTitleLineOne(lineOne);
    setTitleLineTwo(lineTwo);
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminSitePopups();
      setPopups(list);
      if (list.length > 0) {
        setSelectedId(list[0].id);
        loadDraft(popupToDraft(list[0]));
      } else {
        setSelectedId("");
        loadDraft(getEmptyPopupDraft());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "팝업 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, []);

  const selectPopup = (popup: SitePopup) => {
    setSelectedId(popup.id);
    loadDraft(popupToDraft(popup));
  };

  const startNewPopup = () => {
    setSelectedId("");
    loadDraft(getEmptyPopupDraft());
  };

  const updateDraft = <K extends keyof SitePopupDraft>(
    key: K,
    value: SitePopupDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * 폼은 제목을 두 칸으로 보여주지만 저장 포맷은 `첫째줄|둘째줄` 한 문자열이다.
   * 두 칸 중 하나가 바뀔 때마다 draft.title 을 즉시 합쳐 넣어 PREVIEW·저장이 그대로 동작하게 한다.
   */
  const updateTitleLine = (line: "one" | "two", value: string) => {
    const nextLineOne = line === "one" ? value : titleLineOne;
    const nextLineTwo = line === "two" ? value : titleLineTwo;
    if (line === "one") {
      setTitleLineOne(value);
    } else {
      setTitleLineTwo(value);
    }
    updateDraft("title", joinPopupTitleLines(nextLineOne, nextLineTwo));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveSitePopup(draft);
      setPopups((prev) => {
        const exists = prev.some((popup) => popup.id === saved.id);
        const next = exists
          ? prev.map((popup) => (popup.id === saved.id ? saved : popup))
          : [saved, ...prev];
        return next.sort(
          (a, b) =>
            b.priority - a.priority ||
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });
      setSelectedId(saved.id);
      loadDraft(popupToDraft(saved));
      alert("팝업 설정을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "팝업 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPopup) return;
    if (!confirm(`"${selectedPopup.name}" 팝업을 삭제하시겠습니까?`)) return;

    setSaving(true);
    setError(null);
    try {
      await deleteSitePopup(selectedPopup.id);
      const remaining = popups.filter((popup) => popup.id !== selectedPopup.id);
      setPopups(remaining);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
        loadDraft(popupToDraft(remaining[0]));
      } else {
        startNewPopup();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "팝업 삭제에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      eyebrow="PROMOTION CONTROL"
      title="팝업 관리"
      description="홈 진입 홍보 팝업을 추가·수정하고, 노출 순서와 노출 기간을 운영자가 직접 제어합니다."
      aside={
        <div
          className="border p-4 md:p-6"
          style={{
            background: "rgba(255,255,255,0.86)",
            borderColor: "rgba(0,71,171,0.16)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <Megaphone className="mb-3 h-6 w-6" style={{ color: "var(--primary)" }} />
          <div className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>
            ACTIVE POPUPS
          </div>
          <div className="mt-2 fg-display text-3xl font-black" style={{ color: "var(--color-fg-ink)" }}>
            {popups.filter((popup) => popup.isActive).length}
          </div>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
            홈에서는 켜둔 팝업 중 기간 조건에 맞고 순서 숫자가 가장 큰 1개만 노출됩니다.
          </p>
        </div>
      }
    >
      {error && (
        <div
          className="mb-5 border px-4 py-3 text-sm font-semibold"
          style={{
            background: "rgba(255,59,48,0.08)",
            borderColor: "rgba(255,59,48,0.22)",
            color: "var(--destructive)",
          }}
        >
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <AdminPanel>
          <div
            className="flex items-center justify-between gap-3 border-b px-5 py-4"
            style={{ borderColor: "rgba(0,71,171,0.14)" }}
          >
            <div className="fg-label" style={{ color: "var(--primary)" }}>
              POPUPS · {popups.length}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={startNewPopup}
              className="min-h-9"
            >
              <Plus className="h-4 w-4" />
              새 팝업
            </Button>
          </div>

          {loading ? (
            <div className="p-12 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>
              로딩 중…
            </div>
          ) : popups.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
              아직 저장된 팝업이 없습니다.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(0,71,171,0.10)" }}>
              {popups.map((popup) => (
                <button
                  key={popup.id}
                  type="button"
                  onClick={() => selectPopup(popup)}
                  className="block w-full p-4 text-left transition-colors hover:bg-[#F5F7FF]"
                  style={{
                    background:
                      popup.id === selectedId ? "var(--color-fg-paper-3)" : "transparent",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black" style={{ color: "var(--color-fg-ink)" }}>
                        {popup.name}
                      </div>
                      <div className="mt-1 truncate text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                        {popup.title.replaceAll("|", " ")}
                      </div>
                    </div>
                    <AdminStatusPill tone={popup.isActive ? "blue" : "muted"}>
                      {popup.isActive ? "활성" : "비활성"}
                    </AdminStatusPill>
                  </div>
                  <div className="mt-3 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                    <span>순서 {popup.priority}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </AdminPanel>

        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <AdminPanel>
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
              style={{ borderColor: "rgba(0,71,171,0.14)" }}
            >
              <div className="fg-label" style={{ color: "var(--primary)" }}>
                {selectedId ? "EDIT POPUP" : "NEW POPUP"}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={saving}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    삭제
                  </Button>
                )}
                <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "저장 중" : "저장"}
                </Button>
              </div>
            </div>

            <div className="grid gap-5 p-5">
              <div
                className="border p-4"
                style={{
                  borderColor: "rgba(0,71,171,0.16)",
                  background: "var(--color-fg-paper-3)",
                }}
              >
                <label
                  className="flex cursor-pointer items-center gap-3 text-xs font-black"
                  style={{ color: "var(--color-fg-ink)" }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={draft.isActive}
                    aria-describedby={isActiveHintId}
                    onChange={(e) => updateDraft("isActive", e.target.checked)}
                  />
                  지금 홈에 띄우기
                </label>
                <p
                  id={isActiveHintId}
                  className="mt-2 pl-7 text-[11px] leading-relaxed"
                  style={{ color: "var(--color-fg-ink-muted)" }}
                >
                  체크를 풀면 내용은 그대로 남고 노출만 멈춥니다.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="팝업 이름 (관리자용)"
                  hint="홈에는 안 보입니다. 왼쪽 목록에서 구분하려고 쓰는 이름입니다."
                >
                  <Input value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} />
                </Field>
                <Field
                  label="포스터 이미지 주소"
                  hint="/promotions/… 처럼 /로 시작하는 주소 또는 https:// 주소를 넣으세요."
                >
                  <Input value={draft.imageUrl} onChange={(e) => updateDraft("imageUrl", e.target.value)} />
                </Field>
              </div>

              <Field
                label="포스터 위 작은 영문 글씨"
                hint="예: MIXED FUTSAL · 비워두면 PROMOTION 으로 나옵니다."
              >
                <Input value={draft.eyebrow} onChange={(e) => updateDraft("eyebrow", e.target.value)} />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="제목 첫 줄" hint="예: 제1회">
                  <Input
                    value={titleLineOne}
                    onChange={(e) => updateTitleLine("one", e.target.value)}
                  />
                </Field>
                <Field label="제목 둘째 줄" hint="비워두면 제목이 한 줄로 나옵니다.">
                  <Input
                    value={titleLineTwo}
                    onChange={(e) => updateTitleLine("two", e.target.value)}
                  />
                </Field>
              </div>

              <Field label="설명 글" hint="팝업 가운데에 들어갈 두세 문장입니다.">
                <textarea
                  value={draft.body}
                  onChange={(e) => updateDraft("body", e.target.value)}
                  className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                  style={{
                    borderColor: "var(--input)",
                    outlineColor: "var(--ring)",
                  }}
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="장소" hint="팝업에 위치 아이콘과 함께 나옵니다.">
                  <Input value={draft.detailOne} onChange={(e) => updateDraft("detailOne", e.target.value)} />
                </Field>
                <Field label="날짜" hint="팝업에 달력 아이콘과 함께 나옵니다.">
                  <Input value={draft.detailTwo} onChange={(e) => updateDraft("detailTwo", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="추가 정보 1" hint="예: 총상금 500만원 · 비워두면 안 나옵니다.">
                  <Input value={draft.detailThree} onChange={(e) => updateDraft("detailThree", e.target.value)} />
                </Field>
                <Field label="추가 정보 2" hint="예: 팀당 참가비 20만원 · 비워두면 안 나옵니다.">
                  <Input value={draft.detailFour} onChange={(e) => updateDraft("detailFour", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="버튼에 쓸 글씨" hint="예: 참가 신청하기">
                  <Input value={draft.ctaLabel} onChange={(e) => updateDraft("ctaLabel", e.target.value)} />
                </Field>
                <Field
                  label="버튼을 누르면 갈 곳"
                  hint="/로 시작하는 사이트 안 주소 또는 https:// 주소"
                >
                  <Input value={draft.ctaHref} onChange={(e) => updateDraft("ctaHref", e.target.value)} />
                </Field>
              </div>

              <details
                className="group border"
                style={{
                  borderColor: "rgba(0,71,171,0.16)",
                  background: "var(--color-fg-paper-3)",
                }}
              >
                <summary
                  className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-black outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
                  style={{ color: "var(--color-fg-ink)" }}
                >
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                    style={{ color: "var(--primary)" }}
                  />
                  고급 설정 — 평소엔 안 건드려도 됩니다
                </summary>

                <div
                  className="grid gap-4 border-t p-4"
                  style={{
                    borderColor: "rgba(0,71,171,0.14)",
                    background: "rgba(255,255,255,0.72)",
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="여러 팝업이 켜져 있을 때 순서"
                      hint="숫자가 클수록 먼저입니다. 홈에는 조건에 맞는 1개만 뜹니다."
                    >
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        value={draft.priority}
                        onChange={(e) => updateDraft("priority", Number(e.target.value))}
                      />
                    </Field>
                    <Field
                      label="'다시 보지 않기' 초기화"
                      hint="내용을 크게 바꿨다면 숫자를 1 올리세요. 예전에 닫은 사람에게도 다시 보입니다."
                    >
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        value={draft.dismissVersion}
                        onChange={(e) => updateDraft("dismissVersion", Number(e.target.value))}
                      />
                    </Field>
                  </div>

                  <Field label="홈에 들어온 뒤 뜨기까지" hint="1000 = 1초입니다. 권장값은 650.">
                    <Input
                      type="number"
                      min={0}
                      max={10000}
                      value={draft.displayDelayMs}
                      onChange={(e) => updateDraft("displayDelayMs", Number(e.target.value))}
                    />
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="버튼 아래 작은 링크 글씨 (선택)"
                      hint="예: 대회 안내 보기 · 안 쓰면 비워두세요."
                    >
                      <Input
                        value={draft.secondaryLabel}
                        onChange={(e) => updateDraft("secondaryLabel", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="버튼 아래 작은 링크 주소 (선택)"
                      hint="링크 글씨를 넣었다면 주소도 넣어야 저장됩니다."
                    >
                      <Input
                        value={draft.secondaryHref}
                        onChange={(e) => updateDraft("secondaryHref", e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="자동 노출 시작 (선택)" hint="비워두면 켜둔 동안 계속 뜹니다.">
                      <Input
                        type="datetime-local"
                        value={toDateTimeLocal(draft.startsAt)}
                        onChange={(e) => updateDraft("startsAt", fromDateTimeLocal(e.target.value))}
                      />
                    </Field>
                    <Field label="자동 노출 종료 (선택)" hint="비워두면 끌 때까지 계속 뜹니다.">
                      <Input
                        type="datetime-local"
                        value={toDateTimeLocal(draft.endsAt)}
                        onChange={(e) => updateDraft("endsAt", fromDateTimeLocal(e.target.value))}
                      />
                    </Field>
                  </div>
                </div>
              </details>
            </div>
          </AdminPanel>

          <AdminPanel>
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: "rgba(0,71,171,0.14)" }}
            >
              <div className="fg-label" style={{ color: "var(--primary)" }}>
                PREVIEW
              </div>
              <Link
                href="/?promoPreview=1"
                className="inline-flex items-center gap-1 text-xs font-bold"
                style={{ color: "var(--primary)" }}
              >
                <Eye className="h-3.5 w-3.5" />
                홈 미리보기
              </Link>
            </div>
            <div className="p-4">
              <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[#071a2f] text-white">
                <div className="relative aspect-[4/5] bg-[#06162a]">
                  {draft.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.imageUrl}
                      alt="팝업 이미지 미리보기"
                      className="h-full w-full object-contain object-center"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/52">
                      이미지 없음
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="mb-4 inline-flex border border-[#f3d38a]/40 px-3 py-1 text-[10px] font-black tracking-[0.2em] text-[#f3d38a]">
                    {draft.eyebrow || "PROMOTION"}
                  </div>
                  <h2 className="text-[28px] font-black leading-none text-white">
                    {draft.title.split("|").map((line, index) => (
                      <span key={`${line}-${index}`} className="block">
                        {line}
                      </span>
                    ))}
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-white/70">{draft.body}</p>
                  <div className="mt-5 inline-flex rounded-md bg-[#f3d38a] px-4 py-2 text-sm font-black text-[#071a2f]">
                    {draft.ctaLabel || "자세히 보기"}
                  </div>
                </div>
              </div>
            </div>
          </AdminPanel>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const fieldId = useId();
  const controlId = `${fieldId}-control`;
  const hintId = `${fieldId}-hint`;

  // 라벨과 설명이 실제로 입력 칸에 연결되도록 id/aria-describedby 를 주입한다.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; "aria-describedby"?: string }>, {
        id: controlId,
        "aria-describedby": hint ? hintId : undefined,
      })
    : children;

  return (
    <div className="grid gap-2">
      <Label
        htmlFor={controlId}
        className="text-xs font-black"
        style={{ color: "var(--color-fg-ink)" }}
      >
        {label}
      </Label>
      {hint && (
        <p
          id={hintId}
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          {hint}
        </p>
      )}
      {control}
    </div>
  );
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
