import {
  gameStandings,
  overallStandings,
  tiedGroups,
  tieComplete,
} from "./scoring.ts";
import type {
  AllianceTeam,
  Command,
  EventState,
  Game,
  Output,
  Scene,
  Setup,
} from "./types.ts";
import { drawSourcePairs, type DrawIndex } from "./pairing.ts";

const COLORS = [
  "#78b5ff",
  "#ffb877",
  "#ad94ff",
  "#d2fa69",
  "#ff89bb",
  "#68ddd0",
];
const NAMES = [
  "블루번개",
  "오렌지크루",
  "퍼플웨이브",
  "그린유나이티드",
  "핑크스톰",
  "민트플레이",
];
const fail = (message: string): never => {
  throw new Error(message);
};
const assert = (condition: unknown, message: string) => {
  if (!condition) fail(message);
};

export function createEvent(
  id: string,
  demo: boolean,
  now: number,
  choose?: DrawIndex,
): EventState {
  const sources = ["A", "B"].flatMap((group) =>
    Array.from({ length: 6 }, (_, i) => ({
      id: `${group}${i + 1}`,
      group: group as "A" | "B",
      name: `${group}조 ${i + 1}팀`,
    })),
  );
  const sourcePairs = drawSourcePairs(sources, choose);
  const teams: AllianceTeam[] = Array.from({ length: 6 }, (_, i) => {
    const group = i < 3 ? "A" : "B";
    return {
      id: `alliance-${i + 1}`,
      group,
      name: demo ? NAMES[i] : `${group}연합 ${(i % 3) + 1}`,
      color: COLORS[i],
      sourceIds: sourcePairs[i],
      male: demo ? `${NAMES[i]} 남자대표` : "",
      female: demo ? `${NAMES[i]} 여자대표` : "",
      keepUpPlayers: Array.from({ length: 6 }, (_, p) =>
        demo ? `선수 ${p + 1}` : "",
      ),
    };
  });
  const state = {
    id,
    version: 0,
    demo,
    setup: {
      title: "FAIRGROUND 연합팀 챌린지",
      metric: "seconds",
      revealSeconds: 4,
      sources,
      teams,
    },
    locked: false,
    attempts: [],
    ties: [],
    finalized: { shooting: false, keepUp: false },
    updatedAt: now,
  } as unknown as EventState;
  state.output = makeOutput(
    state,
    "standby",
    "shooting",
    [teams[0].id, teams[3].id],
    teams[0].id,
    now,
  );
  return state;
}

function text(value: unknown, label: string, required = true) {
  assert(
    typeof value === "string" &&
      value.length <= 60 &&
      (!required || value.trim().length > 0),
    `${label}을(를) 1~60자로 입력해 주세요.`,
  );
}

export function validateSetup(setup: Setup, requireRoster: boolean) {
  assert(setup && typeof setup === "object", "편성 정보가 올바르지 않습니다.");
  text(setup.title, "이벤트명");
  assert(
    setup.metric === "seconds" || setup.metric === "touches",
    "공 살리기 기록 기준을 선택해 주세요.",
  );
  assert(
    Number.isInteger(setup.revealSeconds) &&
      setup.revealSeconds >= 2 &&
      setup.revealSeconds <= 15,
    "공개 시간은 2~15초입니다.",
  );
  assert(
    Array.isArray(setup.sources) && setup.sources.length === 12,
    "원 참가팀 12개가 필요합니다.",
  );
  assert(
    Array.isArray(setup.teams) && setup.teams.length === 6,
    "연합팀 6개가 필요합니다.",
  );
  const expected = ["A", "B"].flatMap((g) =>
    Array.from({ length: 6 }, (_, i) => `${g}${i + 1}`),
  );
  assert(
    new Set(setup.sources.map((s) => s.id)).size === 12 &&
      setup.sources.every(
        (s) => expected.includes(s.id) && s.id[0] === s.group,
      ),
    "A조·B조에 각각 6개 원 참가팀이 필요합니다.",
  );
  setup.sources.forEach((s) => text(s.name, "원 참가팀명"));
  assert(
    new Set(setup.teams.map((t) => t.name.trim())).size === 6,
    "연합팀 이름이 중복되었습니다.",
  );
  const assigned: string[] = [];
  setup.teams.forEach((t, i) => {
    assert(
      t.id === `alliance-${i + 1}` && t.group === (i < 3 ? "A" : "B"),
      "연합팀 소속조를 바꿀 수 없습니다.",
    );
    assert(t.color === COLORS[i], "연합팀 색상이 올바르지 않습니다.");
    text(t.name, "연합팀명");
    assert(
      Array.isArray(t.sourceIds) &&
        t.sourceIds.length === 2 &&
        t.sourceIds.every((id) => expected.includes(id) && id[0] === t.group),
      "같은 조 안에서 두 팀을 선택해 주세요.",
    );
    assigned.push(...t.sourceIds);
    text(t.male, `${t.name} 남자 대표`, requireRoster);
    text(t.female, `${t.name} 여자 대표`, requireRoster);
    assert(
      !requireRoster || t.male.trim() !== t.female.trim(),
      `${t.name}의 남녀 대표를 각각 입력해 주세요.`,
    );
    assert(
      Array.isArray(t.keepUpPlayers) && t.keepUpPlayers.length === 6,
      `${t.name}의 공 살리기 출전자는 6명입니다.`,
    );
    t.keepUpPlayers.forEach((p) =>
      text(p, `${t.name} 공 살리기 선수`, requireRoster),
    );
    assert(
      !requireRoster ||
        new Set(t.keepUpPlayers.map((p) => p.trim())).size === 6,
      `${t.name}의 공 살리기 선수 6명을 중복 없이 입력해 주세요.`,
    );
  });
  assert(
    new Set(assigned).size === 12,
    "원 참가팀이 중복 편성되었습니다. 각 팀을 한 번씩 배정해 주세요.",
  );
}

export function validateValue(
  value: number,
  game: Game,
  metric: Setup["metric"],
) {
  assert(
    typeof value === "number" && Number.isFinite(value) && value > 0,
    "측정한 양수 기록을 입력해 주세요. 측정 실패는 기록하지 말고 재시도해 주세요.",
  );
  const scale = game === "shooting" ? 10 : metric === "seconds" ? 100 : 1;
  const max = game === "shooting" ? 300 : metric === "seconds" ? 3600 : 100000;
  assert(
    value <= max && Math.abs(value * scale - Math.round(value * scale)) < 1e-7,
    game === "shooting"
      ? "속도는 300km/h 이하, 소수점 한 자리까지 입력해 주세요."
      : metric === "seconds"
        ? "시간은 3,600초 이하, 소수점 두 자리까지 입력해 주세요."
        : "횟수는 100,000회 이하의 정수로 입력해 주세요.",
  );
}

export function makeOutput(
  state: EventState,
  scene: Scene,
  game: Game,
  pair: string[],
  focusTeamId: string,
  now: number,
  playerName = "",
  value: number | null = null,
): Output {
  const overall = overallStandings(state);
  return {
    title: state.setup.title,
    demo: state.demo,
    metric: state.setup.metric,
    scene,
    game,
    teams: structuredClone(state.setup.teams),
    sourceNames: Object.fromEntries(
      state.setup.sources.map((s) => [s.id, s.name]),
    ),
    pair,
    focusTeamId,
    playerName,
    value,
    publishedAt: now,
    durationMs: state.setup.revealSeconds * 1000,
    held: false,
    shooting: gameStandings(state, "shooting"),
    keepUp: gameStandings(state, "keepUp"),
    overall,
    finalized: { ...state.finalized },
    winnerId:
      state.finalized.shooting && state.finalized.keepUp
        ? (overall[0]?.teamId ?? null)
        : null,
  };
}

export function effectiveScene(output: Output, now: number): Scene {
  return output.scene === "reveal" &&
    !output.held &&
    now >= output.publishedAt + output.durationMs
    ? "compare"
    : output.scene;
}

export function applyCommand(
  original: EventState,
  command: Command,
  now: number,
  id: () => string,
): EventState {
  assert(
    command && typeof command === "object" && typeof command.type === "string",
    "명령이 올바르지 않습니다.",
  );
  const state = structuredClone(original);
  const team = (teamId: string) =>
    state.setup.teams.find((t) => t.id === teamId) ??
    fail("연합팀을 찾을 수 없습니다.");
  const checkGame = (game: Game) =>
    assert(
      game === "shooting" || game === "keepUp",
      "종목이 올바르지 않습니다.",
    );
  const pair = (ids: string[]) => {
    assert(
      Array.isArray(ids) && ids.length === 2 && ids[0] !== ids[1],
      "서로 다른 두 연합팀을 선택해 주세요.",
    );
    ids.forEach(team);
    return ids;
  };
  const resetResult = (game: Game) => {
    state.finalized[game] = false;
  };
  switch (command.type) {
    case "audience": {
      checkGame(command.game);
      assert(
        ["live", "records", "scores"].includes(command.tab),
        "관객 화면을 선택해 주세요.",
      );
      // Reopen the last valid measurement without inserting another attempt.
      const attempt =
        command.tab === "live"
          ? state.attempts.findLast((a) => !a.voided && a.game === command.game)
          : undefined;
      const t = team(attempt?.teamId ?? state.output.focusTeamId);
      const ids = state.output.pair.includes(t.id)
        ? state.output.pair
        : [t.id, state.output.pair.find((id) => id !== t.id)!];
      state.output = makeOutput(
        state,
        command.tab === "scores"
          ? "overall"
          : command.tab === "records"
            ? command.game
            : attempt
              ? "reveal"
              : "prepare",
        command.game,
        ids,
        t.id,
        now,
        attempt?.slot ? t[attempt.slot] : "",
        attempt?.value ?? null,
      );
      // A manually selected tab stays selected until the operator's next action.
      state.output.held = command.tab === "live";
      break;
    }
    case "setup": {
      assert(
        !state.locked,
        "편성 확정 후에는 선수와 경기 규칙을 바꿀 수 없습니다. 새 이벤트를 만들어 주세요.",
      );
      validateSetup(command.setup, false);
      state.setup = structuredClone(command.setup);
      state.output = makeOutput(
        state,
        "standby",
        "shooting",
        state.output.pair,
        state.output.focusTeamId,
        now,
      );
      break;
    }
    case "lock":
      validateSetup(state.setup, true);
      state.locked = true;
      break;
    case "record": {
      checkGame(command.game);
      assert(state.locked, "팀 편성과 출전 명단을 먼저 확정해 주세요.");
      assert(
        !state.finalized[command.game],
        "이미 확정된 종목입니다. 기존 기록을 정정하면 결과 확정이 해제됩니다.",
      );
      const t = team(command.teamId);
      validateValue(command.value, command.game, state.setup.metric);
      const slot = command.game === "shooting" ? command.slot : null;
      assert(
        command.game !== "shooting" || slot === "male" || slot === "female",
        "남자·여자 대표를 선택해 주세요.",
      );
      const tie = command.tieId
        ? state.ties.find(
            (r) =>
              r.id === command.tieId &&
              r.game === command.game &&
              r.teamIds.includes(t.id),
          )
        : null;
      assert(!command.tieId || tie, "올바른 재도전 라운드를 선택해 주세요.");
      assert(!tie || !tieComplete(state, tie), "이미 끝난 재도전입니다.");
      const count = state.attempts.filter(
        (a) =>
          !a.voided &&
          a.game === command.game &&
          a.teamId === t.id &&
          a.slot === slot &&
          a.tieId === (tie?.id ?? null),
      ).length;
      assert(
        count < (tie ? 1 : 2),
        "정해진 시도를 모두 기록했습니다. 오입력은 기록 내역에서 정정해 주세요.",
      );
      const p = pair(command.pair);
      assert(
        p.includes(t.id),
        "기록할 팀을 비교 화면의 두 팀에 포함해 주세요.",
      );
      state.attempts.push({
        id: id(),
        game: command.game,
        teamId: t.id,
        slot: slot ?? null,
        value: command.value,
        tieId: tie?.id ?? null,
        voided: false,
        createdAt: now,
      });
      state.output = makeOutput(
        state,
        "reveal",
        command.game,
        p,
        t.id,
        now,
        slot ? t[slot] : "6인 공 살리기",
        command.value,
      );
      break;
    }
    case "replay": {
      const attempt = state.attempts.find(
        (a) => a.id === command.attemptId && !a.voided,
      );
      assert(attempt, "다시 공개할 유효 기록을 찾을 수 없습니다.");
      if (!attempt) break;
      const t = team(attempt.teamId);
      const ids = state.output.pair.includes(t.id)
        ? state.output.pair
        : [t.id, state.output.pair.find((v) => v !== t.id)!];
      state.output = makeOutput(
        state,
        "reveal",
        attempt.game,
        ids,
        t.id,
        now,
        attempt.slot ? t[attempt.slot] : "6인 공 살리기",
        attempt.value,
      );
      break;
    }
    case "void":
    case "correct": {
      const attempt = state.attempts.find((a) => a.id === command.attemptId);
      assert(
        attempt && !attempt.voided,
        "정정할 유효 기록을 찾을 수 없습니다.",
      );
      if (!attempt) break;
      if (command.type === "correct") {
        validateValue(command.value, attempt.game, state.setup.metric);
        attempt.value = command.value;
      } else attempt.voided = true;
      // All dependent replays are invalid after a base/result correction.
      const tieIds = state.ties
        .filter((t) => t.game === attempt.game)
        .map((t) => t.id);
      state.attempts = state.attempts.map((a) =>
        a.tieId && tieIds.includes(a.tieId) ? { ...a, voided: true } : a,
      );
      state.ties = state.ties.filter((t) => t.game !== attempt.game);
      resetResult(attempt.game);
      state.output = makeOutput(
        state,
        attempt.game,
        attempt.game,
        state.output.pair,
        attempt.teamId,
        now,
      );
      break;
    }
    case "show": {
      checkGame(command.game);
      assert(
        [
          "standby",
          "prepare",
          "compare",
          "shooting",
          "keepUp",
          "overall",
          "winner",
        ].includes(command.scene),
        "출력 장면이 올바르지 않습니다.",
      );
      const t = team(command.teamId);
      assert(
        command.slot === undefined ||
          command.slot === "male" ||
          command.slot === "female",
        "남자·여자 대표를 선택해 주세요.",
      );
      if (command.scene === "winner")
        assert(
          state.finalized.shooting && state.finalized.keepUp,
          "두 종목 결과를 모두 확정해야 우승을 발표할 수 있습니다.",
        );
      state.output = makeOutput(
        state,
        command.scene,
        command.game,
        pair(command.pair),
        t.id,
        now,
        command.slot ? t[command.slot] : "6인 공 살리기",
      );
      break;
    }
    case "hold": {
      if (state.output.scene === "reveal" && !state.output.held) {
        const remaining =
          state.output.publishedAt + state.output.durationMs - now;
        if (remaining > 0) {
          state.output.held = true;
          state.output.durationMs = remaining;
        } else state.output.scene = "compare";
      }
      break;
    }
    case "resume":
      if (state.output.held) {
        state.output.held = false;
        state.output.publishedAt = now;
      }
      break;
    case "finalize": {
      checkGame(command.game);
      const rows = gameStandings(state, command.game);
      assert(
        rows.every((r) => r.complete && r.points !== null),
        "미완료 기록 또는 동률이 있습니다. 모든 시도와 순위 결정전을 마쳐 주세요.",
      );
      state.finalized[command.game] = true;
      state.output = makeOutput(
        state,
        command.game,
        command.game,
        state.output.pair,
        state.output.focusTeamId,
        now,
      );
      break;
    }
    case "tiebreak": {
      checkGame(command.game);
      assert(
        !state.finalized[command.game],
        "확정된 종목은 재도전할 수 없습니다.",
      );
      const ids = command.teamIds;
      assert(
        Array.isArray(ids) &&
          ids.length >= 2 &&
          new Set(ids).size === ids.length,
        "동률인 팀을 선택해 주세요.",
      );
      assert(
        !state.ties.some(
          (t) => t.game === command.game && !tieComplete(state, t),
        ),
        "진행 중인 순위 결정전을 먼저 마쳐 주세요.",
      );
      assert(
        tiedGroups(state, command.game).some(
          (g) => g.length === ids.length && g.every((v) => ids.includes(v)),
        ),
        "동률 그룹 전체가 일치해야 합니다.",
      );
      state.ties.push({ id: id(), game: command.game, teamIds: ids });
      break;
    }
    case "demo-records": {
      assert(
        state.demo && state.attempts.length === 0,
        "기록이 없는 연습 이벤트에서만 사용할 수 있습니다.",
      );
      validateSetup(state.setup, true);
      state.locked = true;
      state.setup.teams.forEach((t, i) => {
        for (let round = 0; round < 2; round++) {
          for (const slot of ["male", "female"] as const)
            state.attempts.push({
              id: id(),
              game: "shooting",
              teamId: t.id,
              slot,
              value: 85 + (5 - i) * 3 + round + (slot === "male" ? 14 : 0),
              tieId: null,
              voided: false,
              createdAt: now,
            });
          state.attempts.push({
            id: id(),
            game: "keepUp",
            teamId: t.id,
            slot: null,
            value: [38, 25, 17, 52, 44, 31][i] + round,
            tieId: null,
            voided: false,
            createdAt: now,
          });
        }
      });
      state.output = makeOutput(
        state,
        "overall",
        "keepUp",
        state.output.pair,
        state.output.focusTeamId,
        now,
      );
      break;
    }
    default:
      fail("지원하지 않는 명령입니다.");
  }
  state.version++;
  state.updatedAt = now;
  return state;
}
