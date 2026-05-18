"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, CheckCircle, Edit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeam } from "@/hooks/useTeam";
import { useDataStore } from "@/stores/dataStore";
import { AdminHeader } from "@/components/admin-header";
import { AdminLoading } from "@/components/admin-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MyTeamPage() {
  const router = useRouter();
  const { user, player, initialized } = useAuth();
  const { team, loading: teamLoading } = useTeam(player?.teamId);
  const createTeam = useDataStore((s) => s.createTeam);
  const updateTeam = useDataStore((s) => s.updateTeam);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Edit mode states
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editFoundedYear, setEditFoundedYear] = useState("");

  const isCaptainOrAdmin =
    player?.role === "captain" || player?.role === "admin";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("팀 이름을 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      await createTeam({
        name: name.trim(),
        logo: logo.trim() || "/images/default-team.png",
        isApproved: false,
        captainId: player?.id || "",
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
      setSuccess(true);
    } catch {
      setError("팀 등록에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    if (!team) return;
    setEditName(team.name);
    setEditLogo(team.logo);
    setEditFoundedYear(team.foundedYear?.toString() || "");
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
      });
      setEditing(false);
    } catch {
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

  if (!user) {
    return (
      <div
        className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center"
        style={{ background: "var(--background)" }}
      >
        <Shield
          className="mb-4 h-12 w-12"
          style={{ color: "var(--muted-foreground)" }}
        />
        <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          로그인이 필요합니다
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          팀 관리는 로그인 후 이용할 수 있습니다.
        </p>
        <Button
          className="mt-4 min-h-[44px]"
          onClick={() => router.push("/login?returnTo=%2Fmy%2Fteam")}
        >
          로그인
        </Button>
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
                onClick={() => router.push("/my")}
              >
                마이페이지로 이동
              </Button>
              <Button
                variant="outline"
                className="min-h-[44px] flex-1"
                onClick={() => router.push("/")}
              >
                홈으로
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
                    <Label>로고 URL</Label>
                    <Input
                      value={editLogo}
                      onChange={(e) => setEditLogo(e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
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

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      className="min-h-[44px] flex-1"
                      disabled={submitting}
                    >
                      {submitting ? "수정 중..." : "수정 완료"}
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
                      className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full"
                      style={{ background: "var(--muted)" }}
                    >
                      {team.logo ? (
                        <img
                          src={team.logo}
                          alt={team.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Shield
                          className="h-8 w-8"
                          style={{ color: "var(--muted-foreground)" }}
                        />
                      )}
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
                <Label htmlFor="teamLogo">로고 URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="teamLogo"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="flex-1"
                  />
                  {logo && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                      <img
                        src={logo}
                        alt="미리보기"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <p
                  className="text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  이미지 URL을 입력해주세요. 비워두면 기본 로고가 사용됩니다.
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
                disabled={submitting}
              >
                {submitting ? "등록 중..." : "팀 등록하기"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
