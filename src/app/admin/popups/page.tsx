"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteSitePopup,
  fetchAdminSitePopups,
  getEmptyPopupDraft,
  popupToDraft,
  saveSitePopup,
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
  const [draft, setDraft] = useState<SitePopupDraft>(() => getEmptyPopupDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPopup = useMemo(
    () => popups.find((popup) => popup.id === selectedId) ?? null,
    [popups, selectedId],
  );

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminSitePopups();
      setPopups(list);
      if (list.length > 0) {
        setSelectedId(list[0].id);
        setDraft(popupToDraft(list[0]));
      } else {
        setSelectedId("");
        setDraft(getEmptyPopupDraft());
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
    setDraft(popupToDraft(popup));
  };

  const startNewPopup = () => {
    setSelectedId("");
    setDraft(getEmptyPopupDraft());
  };

  const updateDraft = <K extends keyof SitePopupDraft>(
    key: K,
    value: SitePopupDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
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
      setDraft(popupToDraft(saved));
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
        setDraft(popupToDraft(remaining[0]));
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
      description="홈 진입 홍보 팝업을 추가·수정하고, 우선순위와 노출 기간을 운영자가 직접 제어합니다."
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
            홈에서는 활성 팝업 중 기간 조건에 맞고 우선순위가 가장 높은 1개만 노출됩니다.
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
                  <div className="mt-3 flex items-center justify-between text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                    <span>우선순위 {popup.priority}</span>
                    <span>v{popup.dismissVersion}</span>
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
              <div>
                <div className="fg-label" style={{ color: "var(--primary)" }}>
                  {selectedId ? "EDIT POPUP" : "NEW POPUP"}
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                  제목 줄바꿈은 제목에 `|`를 넣어서 제어합니다.
                </p>
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
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="관리용 이름">
                  <Input value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} />
                </Field>
                <Field label="이미지 URL">
                  <Input value={draft.imageUrl} onChange={(e) => updateDraft("imageUrl", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="활성 상태">
                  <label className="flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) => updateDraft("isActive", e.target.checked)}
                    />
                    홈에 노출
                  </label>
                </Field>
                <Field label="우선순위">
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={draft.priority}
                    onChange={(e) => updateDraft("priority", Number(e.target.value))}
                  />
                </Field>
                <Field label="다시 노출 버전">
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={draft.dismissVersion}
                    onChange={(e) => updateDraft("dismissVersion", Number(e.target.value))}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="상단 라벨">
                  <Input value={draft.eyebrow} onChange={(e) => updateDraft("eyebrow", e.target.value)} />
                </Field>
                <Field label="노출 지연(ms)">
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    value={draft.displayDelayMs}
                    onChange={(e) => updateDraft("displayDelayMs", Number(e.target.value))}
                  />
                </Field>
              </div>

              <Field label="팝업 제목">
                <Input value={draft.title} onChange={(e) => updateDraft("title", e.target.value)} />
              </Field>

              <Field label="본문">
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
                <Field label="세부 문구 1 (장소)">
                  <Input value={draft.detailOne} onChange={(e) => updateDraft("detailOne", e.target.value)} />
                </Field>
                <Field label="세부 문구 2 (날짜)">
                  <Input value={draft.detailTwo} onChange={(e) => updateDraft("detailTwo", e.target.value)} />
                </Field>
                <Field label="세부 문구 3 (총상금 등)">
                  <Input value={draft.detailThree} onChange={(e) => updateDraft("detailThree", e.target.value)} />
                </Field>
                <Field label="세부 문구 4 (참가비 등)">
                  <Input value={draft.detailFour} onChange={(e) => updateDraft("detailFour", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="CTA 문구">
                  <Input value={draft.ctaLabel} onChange={(e) => updateDraft("ctaLabel", e.target.value)} />
                </Field>
                <Field label="CTA 이동 주소">
                  <Input value={draft.ctaHref} onChange={(e) => updateDraft("ctaHref", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="보조 링크 문구">
                  <Input value={draft.secondaryLabel} onChange={(e) => updateDraft("secondaryLabel", e.target.value)} />
                </Field>
                <Field label="보조 링크 주소">
                  <Input value={draft.secondaryHref} onChange={(e) => updateDraft("secondaryHref", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="노출 시작">
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocal(draft.startsAt)}
                    onChange={(e) => updateDraft("startsAt", fromDateTimeLocal(e.target.value))}
                  />
                </Field>
                <Field label="노출 종료">
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocal(draft.endsAt)}
                    onChange={(e) => updateDraft("endsAt", fromDateTimeLocal(e.target.value))}
                  />
                </Field>
              </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs font-black" style={{ color: "var(--color-fg-ink)" }}>
        {label}
      </Label>
      {children}
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
