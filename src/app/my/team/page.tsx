"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Edit,
  Image as ImageIcon,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useSubmission } from "@/hooks/useSubmission";
import { registrationError } from "@/lib/registration/reliability";
import { useTeam } from "@/hooks/useTeam";
import { useDataStore } from "@/stores/dataStore";
import {
  canManageTeam as canManageTeamHelper,
  canEditTeamDetails,
} from "@/lib/team-permissions";
import { AdminHeader } from "@/components/admin-header";
import { AdminLoading } from "@/components/admin-loading";
import { ClubEmblem } from "@/components/club-emblem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REGISTERED_TEAM_ID_KEY = "fg_registered_team_id";

const compressLogoFile = (file: File, maxPx = 512): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 업로드할 수 있습니다."));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = image;
      if (width > maxPx || height > maxPx) {
        if (width > height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("이미지 처리에 실패했습니다."));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 압축에 실패했습니다."));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("이미지 읽기에 실패했습니다."));
          reader.readAsDataURL(blob);
        },
        "image/webp",
        0.75
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };

    image.src = objectUrl;
  });

function TeamLogoUploadHint() {
  return (
    <p
      className="text-xs leading-relaxed"
      style={{ color: "var(--muted-foreground)" }}
    >
      배경 없는 PNG 파일을 권장합니다. JPG나 배경이 있는 이미지는 카드와 팀
      페이지에서 사각 배경이 보일 수 있습니다. 고해상도 이미지는 자동으로
      512px WebP로 압축되어 저장됩니다.
    </p>
  );
}

export default function MyTeamPage() {
  const router = useRouter();
  const { user, player, initialized } = useAuth();
  const createTeam = useDataStore((s) => s.createTeam);
  const updateTeam = useDataStore((s) => s.updateTeam);
  const claimTeamCoach = useDataStore((s) => s.claimTeamCoach);

  const [registeredTeamId, setRegisteredTeamId] = useState("");
  const [queryTeamId, setQueryTeamId] = useState("");
  const activeTeamId = player?.teamId || queryTeamId || registeredTeamId || undefined;
  const { team, loading: teamLoading, error: teamError, retry: retryTeam } = useTeam(activeTeamId);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  // 팀 운영 형태. community = 동호회(투명 회비 공개), club = 개인 수익형 클럽
  // (회비 장부는 디렉터 전용). 등록 후 변경하려면 별도 마이그레이션 흐름이
  // 필요하므로(멤버 신뢰 영향) 일단 생성 시 1회 선택.
  const [teamType, setTeamType] = useState<"community" | "club">("community");
  const [logoProcessing, setLogoProcessing] = useState(false);
  const submission = useSubmission();
  const { submitting } = submission;
  const [savedMessage, setSavedMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Edit mode states
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editFoundedYear, setEditFoundedYear] = useState("");
  const [editIntroSubtitle, setEditIntroSubtitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [editTeamType, setEditTeamType] = useState<"community" | "club">("community");
  const [editLogoProcessing, setEditLogoProcessing] = useState(false);

  // RLS-aligned director permissions. Pending players and regular members
  // can view team details only; operation surfaces stay hidden.
  const canManageTeamStrict = canManageTeamHelper(player, team);
  const canManageTeam = canEditTeamDetails(player, team);
  const isLocalRegisteredTeam =
    Boolean(registeredTeamId) && team?.id === registeredTeamId;

  useEffect(() => {
    if (!user) { setRegisteredTeamId(""); return; }
    try {
      setRegisteredTeamId(localStorage.getItem(`${REGISTERED_TEAM_ID_KEY}:${user.uid}`) || "");
    } catch { /* Storage is optional; server membership is authoritative. */ }
    const params = new URLSearchParams(window.location.search);
    setQueryTeamId(params.get("teamId") || "");
  }, [user]);

  const createDraft = useFormDraft(user && !activeTeamId && !success ? `team-create:${user.uid}` : null,
    { name, logo, foundedYear, teamType }, (draft) => {
      setName(draft.name); setLogo(draft.logo); setFoundedYear(draft.foundedYear); setTeamType(draft.teamType);
    });
  const editDraft = useFormDraft(user && team && editing ? `team-edit:${user.uid}:${team.id}` : null,
    { editName, editLogo, editFoundedYear, editIntroSubtitle, editDescription, editBannerUrl, editTeamType }, (draft) => {
      setEditName(draft.editName); setEditLogo(draft.editLogo); setEditFoundedYear(draft.editFoundedYear);
      setEditIntroSubtitle(draft.editIntroSubtitle); setEditDescription(draft.editDescription);
      setEditBannerUrl(draft.editBannerUrl); setEditTeamType(draft.editTeamType);
    });

  const handleLogoFile = async (
    file: File | undefined,
    mode: "create" | "edit"
  ) => {
    if (!file) return;

    const setProcessing =
      mode === "create" ? setLogoProcessing : setEditLogoProcessing;
    const setLogoValue = mode === "create" ? setLogo : setEditLogo;

    setError("");
    setProcessing(true);
    try {
      const compressedLogo = await compressLogoFile(file);
      setLogoValue(compressedLogo);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "로고 이미지를 처리하지 못했습니다."
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!player || !user) { setError("로그인 후 선수 프로필을 확인해주세요."); return; }
    if (logoProcessing || !createDraft.ready) return;
    if (!name.trim()) {
      setError("팀 이름을 입력해주세요");
      return;
    }

    if (!submission.begin()) return;
    try {
      const createdTeamId = await createTeam({
        name: name.trim(),
        logo: logo.trim(),
        isApproved: false,
        captainId: player?.id || undefined,
        foundedYear: foundedYear ? parseInt(foundedYear, 10) : undefined,
        memberCount: 1,
        seasonStats: {
          points: 0,
          rank: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          gamesPlayed: 0,
        },
        createdAt: Date.now(),
        teamType,
        leagueTier: "bronze",
        participationStreak: 0,
      });
      createDraft.clear();
      setRegisteredTeamId(createdTeamId);
      setSuccess(true);
      try { localStorage.setItem(`${REGISTERED_TEAM_ID_KEY}:${user.uid}`, createdTeamId); } catch { /* Saved in DB. */ }
    } catch (err) {
      setError(registrationError(err, "팀 등록을 완료하지 못했습니다. 입력은 유지됩니다."));
    } finally {
      submission.end();
    }
  };

  const startEdit = () => {
    if (!team) return;
    setError(""); setSavedMessage("");
    setEditName(team.name);
    setEditLogo(team.logo);
    setEditFoundedYear(team.foundedYear?.toString() || "");
    setEditIntroSubtitle(team.introSubtitle ?? "");
    setEditDescription(team.description ?? "");
    setEditBannerUrl(team.bannerUrl ?? "");
    setEditTeamType(team.teamType ?? "community");
    setEditing(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || editLogoProcessing || !editDraft.ready) return;
    setError("");

    if (!editName.trim()) {
      setError("팀 이름을 입력해주세요");
      return;
    }

    // 운영 형태 변경은 회비 장부 공개 범위를 바꾸므로 변경 시 확인을 받는다.
    if (editTeamType !== (team.teamType ?? "community")) {
      const ok = window.confirm(
        editTeamType === "club"
          ? "클럽형으로 변경하면 회비 장부 전체(수입·지출·잔액·다른 멤버 납부내역)는 감독·매니저만 보고, 일반 멤버는 본인 납부 내역만 보게 됩니다. 변경할까요?"
          : "동호회형으로 변경하면 모든 팀원에게 회비 수입·지출·잔액이 공개됩니다. 변경할까요?",
      );
      if (!ok) return;
    }

    if (!submission.begin()) return;
    try {
      await updateTeam(team.id, {
        name: editName.trim(),
        logo: editLogo.trim(),
        foundedYear: editFoundedYear
          ? parseInt(editFoundedYear, 10)
          : undefined,
        introSubtitle: editIntroSubtitle.trim() || undefined,
        description: editDescription.trim() || undefined,
        bannerUrl: editBannerUrl.trim() || undefined,
        teamType: editTeamType,
      });
      editDraft.clear();
      setEditing(false);
      setSavedMessage("팀 정보가 저장되었습니다.");
    } catch (err) {
      console.error("[MyTeamPage] updateTeam failed:", err);
      setError(registrationError(err, "팀 정보 수정에 실패했습니다. 입력은 유지됩니다."));
    } finally {
      submission.end();
    }
  };

  if (!initialized) {
    return (
      <div className="min-h-screen" style={{ background: "var(--background)" }}>
        <AdminHeader title="팀 관리" />
        <AdminLoading />
      </div>
    );
  }

  if (teamLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--background)" }}>
        <AdminHeader title="팀 관리" />
        <AdminLoading />
      </div>
    );
  }

  if (!user || !player) return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-12">
      <p role="alert">팀 등록·수정에는 로그인이 필요합니다.</p>
      <Link href="/login?returnTo=%2Fmy%2Fteam">로그인하고 계속하기</Link>
    </main>
  );
  if (teamError || (activeTeamId && !team && !success)) return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-12">
      <p role="alert">{teamError || "기존 팀 정보를 확인하지 못했습니다. 새 팀을 만들기 전에 등록 결과를 확인해주세요."}</p>
      <Button onClick={retryTeam}>팀 정보 다시 확인</Button>
    </main>
  );

  // Success screen after team creation
  if (success) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "var(--background)" }}
      >
        <AdminHeader title="팀 관리" />
        <main className="mx-auto max-w-md px-4 py-12">
          <div className="space-y-6 text-center">
            <CheckCircle
              className="mx-auto h-16 w-16"
              style={{ color: "var(--primary)" }}
            />
            <div>
              <h2 className="text-xl font-bold">팀 등록 완료!</h2>
              <p
                className="mt-3 text-sm leading-relaxed"
                style={{ color: "var(--muted-foreground)" }}
              >
                관리자 승인 후 팀이 활성화됩니다.
                <br />
                승인이 완료되면 팀 페이지에서 확인할 수 있습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                className="min-h-[44px] flex-1"
                onClick={() => setSuccess(false)}
              >
                팀 관리 보기
              </Button>
              <Button
                variant="outline"
                className="min-h-[44px] flex-1"
                onClick={() => router.push("/my")}
              >
                마이페이지
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Team exists → show info / edit
  if (team) {
    return (
      <div
        className="min-h-screen pb-8"
        style={{ background: "var(--background)" }}
      >
        <AdminHeader title="팀 관리" />

        <main className="mx-auto max-w-md space-y-4 px-4 py-4">
          {savedMessage && <p role="status" className="text-sm text-blue-700">{savedMessage}</p>}
          {error && !editing && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] gap-1"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            돌아가기
          </Button>

          {/* Owner claim — when the team has no captainId yet and this user
              is a member of the team, let them adopt 감독 authority. createTeam set
              captain_id on the API call but the row landed without it; this
              is the in-product self-repair. RLS still has final say. */}
          {player &&
            player.teamId === team.id &&
            player.isApproved &&
            !team.captainId &&
            !canManageTeamStrict && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    이 팀에 등록된 소유자가 없습니다. 본인을 감독으로 등록하면
                    팀 정보 수정·멤버 관리·공지 등의 권한이 활성화됩니다.
                  </p>
                  <Button
                    className="min-h-[44px] w-full"
                    disabled={submitting}
                    onClick={async () => {
                      if (!team || !player) return;
                      setError("");
                      if (!submission.begin()) return;
                      try {
                        await claimTeamCoach(team.id);

                        // claimTeamCoach revalidates the team store; the
                        // canManageTeamStrict flag flips on next render.
                      } catch (err) {
                        console.error(
                          "[MyTeamPage] captain claim failed:",
                          err,
                        );
                        const msg =
                          err instanceof Error ? err.message : "";
                        setError(
                          msg.includes("row-level security") ||
                            msg.includes("permission")
                            ? "감독 등록 권한이 없습니다. 관리자에게 문의해주세요."
                            : "감독 등록에 실패했습니다. 다시 시도해주세요.",
                        );
                      } finally {
                        submission.end();
                      }
                    }}
                  >
                    {submitting ? "등록 중..." : "이 팀의 감독으로 등록"}
                  </Button>
                  {error && (
                    <p className="text-xs" style={{ color: "#dc2626" }}>
                      {error}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

          {editing ? (
            /* Edit Form */
            <Card>
              <CardHeader>
                <CardTitle className="text-base">팀 정보 수정</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdate} className="space-y-4">
                  {editDraft.message && <p role="status" className="text-sm">{editDraft.message}</p>}
                  <fieldset disabled={submitting || !editDraft.ready} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="editTeamName">팀 이름</Label>
                    <Input
                      id="editTeamName"
                      value={editName}
                      maxLength={100}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editTeamLogo">로고 이미지</Label>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="editTeamLogo"
                        className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        <ImageIcon className="h-4 w-4" />
                        {editLogoProcessing ? "압축 중..." : "이미지 선택"}
                      </label>
                      <Input
                        id="editTeamLogo"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={editLogoProcessing}
                        onChange={(e) =>
                          void handleLogoFile(e.target.files?.[0], "edit")
                        }
                      />
                      {editLogo && (
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border">
                          <img
                            src={editLogo}
                            alt="로고 미리보기"
                            className="h-full w-full object-contain bg-[var(--color-fg-paper)]"
                          />
                          <button
                            type="button"
                            aria-label="로고 제거"
                            className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-black/60 text-white"
                            onClick={() => setEditLogo("")}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <TeamLogoUploadHint />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editFoundedYear">창단 연도</Label>
                    <Input
                      type="number"
                      id="editFoundedYear"
                      value={editFoundedYear}
                      onChange={(e) => setEditFoundedYear(e.target.value)}
                      placeholder="2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editIntroSubtitle">한 줄 소개 (부제)</Label>
                    <Input
                      id="editIntroSubtitle"
                      value={editIntroSubtitle}
                      onChange={(e) => setEditIntroSubtitle(e.target.value)}
                      placeholder="우리 팀을 한 문장으로"
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editDescription">팀 소개</Label>
                    <textarea
                      id="editDescription"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="팀 색깔, 운영 방향, 모집 안내 등 자유롭게 작성하세요."
                      rows={5}
                      maxLength={800}
                      className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editBannerUrl">배너 이미지 URL (선택)</Label>
                    <Input
                      id="editBannerUrl"
                      type="url"
                      value={editBannerUrl}
                      onChange={(e) => setEditBannerUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  {/* 팀 운영 형태 변경 — 회비 장부 공개 범위가 달라진다. */}
                  <div className="space-y-2">
                    <Label>팀 운영 형태</Label>
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      회비 장부의 공개 범위가 달라집니다. 변경 시 모든 팀원에게
                      즉시 적용됩니다.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <TeamTypeCard
                        selected={editTeamType === "community"}
                        onClick={() => setEditTeamType("community")}
                        title="동호회형"
                        desc="모든 팀원에게 회비/지출/잔액이 투명하게 공개됩니다. 멤버 회비로 함께 운영하는 동호회에 적합."
                      />
                      <TeamTypeCard
                        selected={editTeamType === "club"}
                        onClick={() => setEditTeamType("club")}
                        title="클럽형"
                        desc="감독·매니저만 회비 장부 전체를 볼 수 있습니다. 본인 납부 내역은 멤버 본인에게만 노출. 개인이 수익화 목적으로 운영하는 클럽에 적합."
                      />
                    </div>
                    {editTeamType !== (team.teamType ?? "community") && (
                      <p
                        className="text-xs font-medium"
                        style={{ color: "#b45309" }}
                      >
                        ⚠️{" "}
                        {team.teamType === "club"
                          ? "클럽형 → 동호회형"
                          : "동호회형 → 클럽형"}
                        으로 변경됩니다. 회비 장부 공개 범위가 바뀌니 팀원에게
                        안내해주세요.
                      </p>
                    )}
                  </div>

                  {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      className="min-h-[44px] flex-1"
                      disabled={submitting || editLogoProcessing}
                    >
                      {submitting
                        ? "수정 중..."
                        : editLogoProcessing
                          ? "이미지 처리 중..."
                          : "수정 완료"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px] flex-1"
                      onClick={() => {
                        setEditing(false);
                        setError("");
                      }}
                    >
                      취소
                    </Button>
                  </div>
                  </fieldset>
                </form>
              </CardContent>
            </Card>
          ) : (
            /* Team Info Display */
            <>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl p-1.5"
                      style={{ background: "var(--muted)" }}
                    >
                      <ClubEmblem name={team.name} logoSrc={team.logo} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold">{team.name}</h2>
                      <div className="mt-1 flex items-center gap-2">
                        {!team.isApproved && (
                          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600">
                            승인 대기 중
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">팀 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--muted-foreground)" }}>
                      팀원 수
                    </span>
                    <span className="font-medium">{team.memberCount}명</span>
                  </div>
                  {team.foundedYear && (
                    <div className="flex justify-between text-sm">
                      <span style={{ color: "var(--muted-foreground)" }}>
                        창단 연도
                      </span>
                      <span className="font-medium">
                        {team.foundedYear}년
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--muted-foreground)" }}>
                      승점
                    </span>
                    <span className="font-medium">
                      {team.seasonStats.points}점
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--muted-foreground)" }}>
                      시즌 전적
                    </span>
                    <span className="font-medium">
                      {team.seasonStats.wins}승 {team.seasonStats.draws}무{" "}
                      {team.seasonStats.losses}패
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "var(--muted-foreground)" }}>
                      득실차
                    </span>
                    <span className="font-medium">
                      {team.seasonStats.goalsFor} /{" "}
                      {team.seasonStats.goalsAgainst} (
                      {team.seasonStats.goalDifference >= 0 ? "+" : ""}
                      {team.seasonStats.goalDifference})
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Edit Button (team staff / admin) */}
              {canManageTeam && (
                <Button
                  className="min-h-[44px] w-full"
                  onClick={startEdit}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  팀 정보 수정
                </Button>
              )}
              {isLocalRegisteredTeam && !canManageTeam && (
                <Card>
                  <CardContent className="p-4">
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      이 브라우저에서 등록한 팀입니다. 현재는 승인 대기 상태를
                      확인할 수 있고, 팀 정보 수정은 관리자 승인 후 가능합니다.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Team operations — only the director-only surfaces. Public
                  boards (notices/gallery/chat) handle their own role-based
                  edit UI on the board pages themselves, so they don't need a
                  separate admin entry point here. */}
              {canManageTeamStrict && (
                <div className="space-y-2">
                  <p
                    className="px-1 text-xs font-semibold tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    팀 운영
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/teams/${team.id}/admin`}
                      className="flex min-h-[64px] items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      팀 개요
                    </Link>
                    <Link
                      href={`/teams/${team.id}/members`}
                      className="flex min-h-[64px] items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      멤버 관리
                    </Link>
                    <Link
                      href={`/teams/${team.id}/dues`}
                      className="col-span-2 flex min-h-[64px] items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                    >
                      <CreditCard className="h-4 w-4 shrink-0" />
                      <span className="flex flex-col items-start leading-tight">
                        회비 장부
                        <span className="text-[10px] font-normal opacity-70">
                          월 회비 · 미납 · 잔액
                        </span>
                      </span>
                    </Link>
                  </div>
                </div>
              )}

              {/* View Team Page */}
              <Button
                variant="outline"
                className="min-h-[44px] w-full"
                onClick={() => router.push(`/teams/${team.id}`)}
              >
                팀 상세 페이지 보기
              </Button>
            </>
          )}
        </main>
      </div>
    );
  }

  // No team → registration form
  return (
    <div
      className="min-h-screen pb-8"
      style={{ background: "var(--background)" }}
    >
      <AdminHeader title="팀 등록" />

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] gap-1"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          돌아가기
        </Button>

        {/* Info Banner */}
        <Card
          style={{
            borderColor: "var(--accent-gold)",
            background: "var(--secondary)",
          }}
        >
          <CardContent className="flex items-start gap-3 p-4">
            <Shield
              className="mt-0.5 h-5 w-5 shrink-0"
              style={{ color: "var(--accent-gold)" }}
            />
            <div>
              <p className="text-sm font-medium">팀을 등록하세요</p>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                감독이 팀 이름, 로고, 기본 정보를 등록할 수 있습니다.
                등록 후 관리자 승인이 필요합니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">팀 정보 입력</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {createDraft.message && <p role="status" className="text-sm">{createDraft.message}</p>}
              <fieldset disabled={submitting || !createDraft.ready} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">
                  팀 이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="teamName"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="팀 이름 입력"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamLogo">로고 이미지</Label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="teamLogo"
                    className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <ImageIcon className="h-4 w-4" />
                    {logoProcessing ? "압축 중..." : "이미지 선택"}
                  </label>
                  <Input
                    id="teamLogo"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={logoProcessing}
                    onChange={(e) =>
                      void handleLogoFile(e.target.files?.[0], "create")
                    }
                  />
                  {logo && (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border">
                      <img
                        src={logo}
                        alt="로고 미리보기"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label="로고 제거"
                        className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center bg-black/60 text-white"
                        onClick={() => setLogo("")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <TeamLogoUploadHint />
                <p
                  className="text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  비워두면 기본 로고가 사용됩니다.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="foundedYear">창단 연도</Label>
                <Input
                  id="foundedYear"
                  type="number"
                  value={foundedYear}
                  onChange={(e) => setFoundedYear(e.target.value)}
                  placeholder="2024"
                  min={1900}
                  max={2100}
                />
              </div>

              {/* 팀 운영 형태 — 회비 장부 공개 범위가 달라지는 1회 결정. */}
              <div className="space-y-2">
                <Label>
                  팀 운영 형태 <span className="text-red-500">*</span>
                </Label>
                <p
                  className="text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  회비 장부의 공개 범위가 달라집니다. 등록 후 변경은 신중히
                  진행되며, 기본은 동호회형입니다.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <TeamTypeCard
                    selected={teamType === "community"}
                    onClick={() => setTeamType("community")}
                    title="동호회형"
                    desc="모든 팀원에게 회비/지출/잔액이 투명하게 공개됩니다. 멤버 회비로 함께 운영하는 동호회에 적합."
                  />
                  <TeamTypeCard
                    selected={teamType === "club"}
                    onClick={() => setTeamType("club")}
                    title="클럽형"
                    desc="감독·매니저만 회비 장부 전체를 볼 수 있습니다. 본인 납부 내역은 멤버 본인에게만 노출. 개인이 수익화 목적으로 운영하는 클럽에 적합."
                  />
                </div>
              </div>

              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

              <Button
                type="submit"
                className="min-h-[44px] w-full"
                disabled={submitting || logoProcessing}
              >
                {submitting
                  ? "등록 중..."
                  : logoProcessing
                    ? "이미지 처리 중..."
                    : "팀 등록하기"}
              </Button>
            </fieldset>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function TeamTypeCard({
  selected,
  onClick,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="text-left rounded-md border p-3 transition-colors"
      style={{
        background: selected ? "rgba(0,71,171,0.08)" : "var(--color-fg-paper)",
        borderColor: selected
          ? "var(--primary)"
          : "var(--color-fg-line-soft, var(--border))",
        color: "var(--color-fg-ink)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border"
          style={{
            borderColor: selected ? "var(--primary)" : "var(--color-fg-line-soft, var(--border))",
            background: selected ? "var(--primary)" : "transparent",
          }}
        >
          {selected && (
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          )}
        </span>
        <span className="font-bold text-sm">{title}</span>
      </div>
      <p
        className="mt-1.5 text-[11px] leading-relaxed"
        style={{ color: "var(--color-fg-ink-muted, var(--muted-foreground))" }}
      >
        {desc}
      </p>
    </button>
  );
}
