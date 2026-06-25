import { isDemoMode, supabase } from "@/config/supabase";
import type { Database } from "@/lib/database.types";

type SitePopupRow = Database["public"]["Tables"]["site_popups"]["Row"];
type SitePopupInsert = Database["public"]["Tables"]["site_popups"]["Insert"];
type SitePopupUpdate = Database["public"]["Tables"]["site_popups"]["Update"];

export type SitePopupPlacement = "home";

export interface SitePopup {
  id: string;
  placement: SitePopupPlacement;
  name: string;
  isActive: boolean;
  priority: number;
  dismissVersion: number;
  displayDelayMs: number;
  eyebrow: string;
  title: string;
  body: string;
  detailOne: string;
  detailTwo: string;
  detailThree: string;
  detailFour: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export type SitePopupDraft = Omit<
  SitePopup,
  "id" | "createdAt" | "updatedAt" | "updatedBy"
> & {
  id?: string;
};

export const DEFAULT_BEACH_SOCCER_POPUP: SitePopup = {
  id: "beach-soccer-national-college",
  placement: "home",
  name: "전국 비치사커대회",
  isActive: true,
  priority: 100,
  dismissVersion: 2,
  displayDelayMs: 650,
  eyebrow: "BEACH SOCCER",
  title: "전국|비치사커대회",
  body: "강원 동해시 망상해수욕장에서 열리는 여름 특별 프로젝트로, 대학부·남자부·여자부 세 부문 팀이 모여 비치사커 이벤트 매치를 펼칩니다.",
  detailOne: "강원 동해시 망상해수욕장",
  detailTwo: "2026년 8월 7일 금요일",
  detailThree: "총상금 200만원",
  detailFour: "참가비 30만원",
  imageUrl: "/promotions/beach-soccer-2026-photo.png",
  ctaLabel: "프로젝트 보기",
  ctaHref: "/beach-soccer",
  secondaryLabel: "",
  secondaryHref: "",
  startsAt: null,
  endsAt: null,
  createdAt: "",
  updatedAt: "",
  updatedBy: null,
};

function rowToSitePopup(row: SitePopupRow): SitePopup {
  return {
    id: row.id,
    placement: row.placement as SitePopupPlacement,
    name: row.name,
    isActive: row.is_active,
    priority: row.priority,
    dismissVersion: row.dismiss_version,
    displayDelayMs: row.display_delay_ms,
    eyebrow: row.eyebrow,
    title: row.title,
    body: row.body,
    detailOne: row.detail_one,
    detailTwo: row.detail_two,
    // detail_three/four 는 마이그레이션으로 추가된 컬럼 — 자동생성 타입에 아직
    // 반영되지 않아 캐스팅으로 읽는다(런타임 안전, 없으면 빈 문자열).
    detailThree: (row as { detail_three?: string | null }).detail_three ?? "",
    detailFour: (row as { detail_four?: string | null }).detail_four ?? "",
    imageUrl: row.image_url,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    secondaryLabel: row.secondary_label,
    secondaryHref: row.secondary_href,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function draftToInsert(draft: SitePopupDraft): SitePopupInsert {
  return {
    placement: draft.placement,
    name: draft.name.trim(),
    is_active: draft.isActive,
    priority: draft.priority,
    dismiss_version: draft.dismissVersion,
    display_delay_ms: draft.displayDelayMs,
    eyebrow: draft.eyebrow.trim(),
    title: draft.title.trim(),
    body: draft.body.trim(),
    detail_one: draft.detailOne.trim(),
    detail_two: draft.detailTwo.trim(),
    detail_three: draft.detailThree.trim(),
    detail_four: draft.detailFour.trim(),
    image_url: draft.imageUrl.trim(),
    cta_label: draft.ctaLabel.trim(),
    cta_href: draft.ctaHref.trim(),
    secondary_label: draft.secondaryLabel.trim(),
    secondary_href: draft.secondaryHref.trim(),
    starts_at: draft.startsAt || null,
    ends_at: draft.endsAt || null,
    // detail_three/four 는 자동생성 타입에 아직 없어 캐스팅으로 포함.
  } as unknown as SitePopupInsert;
}

function draftToUpdate(draft: SitePopupDraft): SitePopupUpdate {
  return draftToInsert(draft);
}

function isAllowedHref(value: string): boolean {
  return value === "" || value.startsWith("/") || value.startsWith("https://");
}

function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function assertValidIsoDate(value: string | null, fieldName: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) throw new Error(`${fieldName} 값이 올바르지 않습니다.`);
  return time;
}

function validatePopupDraft(draft: SitePopupDraft): void {
  if (!draft.name.trim()) throw new Error("관리용 이름을 입력하세요.");
  if (!draft.title.trim()) throw new Error("팝업 제목을 입력하세요.");
  if (!draft.ctaLabel.trim()) throw new Error("CTA 버튼 문구를 입력하세요.");
  if (!draft.ctaHref.trim()) throw new Error("CTA 이동 주소를 입력하세요.");
  if (!isAllowedHref(draft.ctaHref.trim())) {
    throw new Error("CTA 이동 주소는 /로 시작하는 내부 주소 또는 https:// 주소만 사용할 수 있습니다.");
  }
  if (draft.secondaryHref.trim() && !draft.secondaryLabel.trim()) {
    throw new Error("보조 링크 주소를 쓰려면 보조 링크 문구도 입력하세요.");
  }
  if (!isAllowedHref(draft.secondaryHref.trim())) {
    throw new Error("보조 링크 주소는 비워두거나 /로 시작하는 내부 주소 또는 https:// 주소만 사용할 수 있습니다.");
  }
  if (!isIntegerInRange(draft.priority, 0, 1000)) {
    throw new Error("우선순위는 0부터 1000 사이의 정수여야 합니다.");
  }
  if (!isIntegerInRange(draft.dismissVersion, 1, 999)) {
    throw new Error("다시 노출 버전은 1부터 999 사이의 정수여야 합니다.");
  }
  if (!isIntegerInRange(draft.displayDelayMs, 0, 10000)) {
    throw new Error("노출 지연은 0부터 10000ms 사이의 정수여야 합니다.");
  }

  const startsAt = assertValidIsoDate(draft.startsAt, "노출 시작");
  const endsAt = assertValidIsoDate(draft.endsAt, "노출 종료");
  if (startsAt && endsAt && startsAt > endsAt) {
    throw new Error("노출 종료는 노출 시작 이후여야 합니다.");
  }
}

function isWithinWindow(popup: SitePopup, now = Date.now()): boolean {
  const start = popup.startsAt ? new Date(popup.startsAt).getTime() : 0;
  const end = popup.endsAt ? new Date(popup.endsAt).getTime() : 0;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

export function getEmptyPopupDraft(): SitePopupDraft {
  return {
    id: undefined,
    placement: "home",
    name: "새 홍보 팝업",
    isActive: false,
    priority: 50,
    dismissVersion: 1,
    displayDelayMs: 650,
    eyebrow: "EVENT",
    title: "새 홍보 팝업",
    body: "",
    detailOne: "",
    detailTwo: "",
    detailThree: "",
    detailFour: "",
    imageUrl: "/promotions/beach-soccer-2026-photo.png",
    ctaLabel: "자세히 보기",
    ctaHref: "/",
    secondaryLabel: "",
    secondaryHref: "",
    startsAt: null,
    endsAt: null,
  };
}

export function popupToDraft(popup: SitePopup): SitePopupDraft {
  return {
    id: popup.id,
    placement: popup.placement,
    name: popup.name,
    isActive: popup.isActive,
    priority: popup.priority,
    dismissVersion: popup.dismissVersion,
    displayDelayMs: popup.displayDelayMs,
    eyebrow: popup.eyebrow,
    title: popup.title,
    body: popup.body,
    detailOne: popup.detailOne,
    detailTwo: popup.detailTwo,
    detailThree: popup.detailThree,
    detailFour: popup.detailFour,
    imageUrl: popup.imageUrl,
    ctaLabel: popup.ctaLabel,
    ctaHref: popup.ctaHref,
    secondaryLabel: popup.secondaryLabel,
    secondaryHref: popup.secondaryHref,
    startsAt: popup.startsAt,
    endsAt: popup.endsAt,
  };
}

export async function fetchActiveSitePopup(
  placement: SitePopupPlacement = "home",
): Promise<SitePopup | null> {
  if (isDemoMode) return DEFAULT_BEACH_SOCCER_POPUP;

  const { data, error } = await supabase
    .from("site_popups")
    .select("*")
    .eq("placement", placement)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[site-popups] fetchActiveSitePopup:", error.message);
    return DEFAULT_BEACH_SOCCER_POPUP;
  }

  return (data ?? [])
    .map(rowToSitePopup)
    .find((popup) => isWithinWindow(popup)) ?? null;
}

export async function fetchAdminSitePopups(): Promise<SitePopup[]> {
  if (isDemoMode) return [DEFAULT_BEACH_SOCCER_POPUP];

  const { data, error } = await supabase
    .from("site_popups")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSitePopup);
}

export async function saveSitePopup(draft: SitePopupDraft): Promise<SitePopup> {
  validatePopupDraft(draft);

  if (isDemoMode) {
    return {
      ...DEFAULT_BEACH_SOCCER_POPUP,
      ...draft,
      id: draft.id ?? `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  }

  if (draft.id) {
    const { data, error } = await supabase
      .from("site_popups")
      .update(draftToUpdate(draft))
      .eq("id", draft.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToSitePopup(data);
  }

  const { data, error } = await supabase
    .from("site_popups")
    .insert(draftToInsert(draft))
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToSitePopup(data);
}

export async function deleteSitePopup(id: string): Promise<void> {
  if (isDemoMode) return;
  const { error } = await supabase.from("site_popups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
