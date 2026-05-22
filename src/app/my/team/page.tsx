"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, CheckCircle, Edit, ImageIcon, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeam } from "@/hooks/useTeam";
import { useDataStore } from "@/stores/dataStore";
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

export default function MyTeamPage() {
  const router = useRouter();
  const { player, initialized, updatePlayer } = useAuth();
  const createTeam = useDataStore((s) => s.createTeam);
  const updateTeam = useDataStore((s) => s.updateTeam);

  const [registeredTeamId, setRegisteredTeamId] = useState("");
  const [queryTeamId, setQueryTeamId] = useState("");
  const activeTeamId = player?.teamId || queryTeamId || registeredTeamId || undefined;
  const { team, loading: teamLoading } = useTeam(activeTeamId);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const [editLogoProcessing, setEditLogoProcessing] = useState(false);

  const isCaptainOrAdmin =
    player?.role === "captain" || player?.role === "admin";
  const isLocalRegisteredTeam =
    Boolean(registeredTeamId) && team?.id === registeredTeamId;

  useEffect(() => {
    const savedTeamId = localStorage.getItem(REGISTERED_TEAM_ID_KEY) || "";
    setRegisteredTeamId(savedTeamId);

    const params = new URLSearchParams(window.location.search);
    const teamId = params.get("teamId") || "";
    if (!teamId) return;
    localStorage.setItem(REGISTERED_TEAM_ID_KEY, teamId);
    setQueryTeamId(teamId);
    setRegisteredTeamId(teamId);
  }, []);

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

    if (!name.trim()) {
      setError("팀 이름을 입력해주세요");
      return;
    }

    setSubmitting(true);
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
      });
      if (player) {
        await updatePlayer({ teamId: createdTeamId });
      }
      localStorage.setItem(REGISTERED_TEAM_ID_KEY, createdTeamId);
      setRegisteredTeamId(createdTeamId);
      setSuccess(false);
    } catch (err) {
      console.error("[MyTeamPage] createTeam failed:", err);
      const message = err instanceof Error ? err.message : "";
      setError(
        message.includes("row-level security")
          ? "팀 등록 권한 설정이 필요합니다. 관리자에게 문의해주세요."
          : "팀 등록에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    if (!team) return;
    setEditName(team.name);
    setEditLogo(team.logo);
    setEditFoundedYear(team.foundedYear?.toString() || "");
    setEditIntroSubtitle(team.introSubtitle ?? "");
    setEditDescription(team.description ?? "");
    setEditBannerUrl(team.bannerUrl ?? "");
    setEditing(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    setError("");

    if (!editName.trim()) {
      setError("팀 이름을 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      await updateTeam(team.id, {
        name: editName.trim(),
        logo: editLogo.trim() || team.logo,
        foundedYear: editFoundedYear
          ? parseInt(editFoundedYear, 10)
          : undefined,
        introSubtitle: editIntroSubtitle.trim() || undefined,
        description: editDescription.trim() || undefined,
        bannerUrl: editBannerUrl.trim() || undefined,
      });
      setEditing(false);
    } catch (err) {
      console.error("[MyTeamPage] updateTeam failed:", err);
      setError("팀 정보 수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
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

          {editing ? (
            /* Edit Form */
            <Card>
              <CardHeader>
                <CardTitle className="text-base">팀 정보 수정</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>팀 이름</Label>
                    <Input
                      value={editName}
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
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      고해상도 이미지는 자동으로 512px WebP로 압축되어 저장됩니다.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>창단 연도</Label>
                    <Input
                      type="number"
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

                  {error && <p className="text-sm text-red-500">{error}</p>}

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

              {/* Edit Button (captain/admin only) */}
              {isCaptainOrAdmin && (
                <Button
                  className="min-h-[44px] w-full"
                  onClick={startEdit}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  팀 정보 수정
                </Button>
              )}
              {isLocalRegisteredTeam && !isCaptainOrAdmin && (
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
                감독 또는 주장이 팀 이름, 로고, 기본 정보를 등록할 수 있습니다.
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
              <div className="space-y-2">
                <Label htmlFor="teamName">
                  팀 이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="teamName"
                  value={name}
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
                <p
                  className="text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  고해상도 이미지는 자동으로 512px WebP로 압축됩니다. 비워두면
                  기본 로고가 사용됩니다.
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

              {error && <p className="text-sm text-red-500">{error}</p>}

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
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
