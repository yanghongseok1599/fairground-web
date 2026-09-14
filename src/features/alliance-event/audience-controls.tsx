"use client";

import { audienceView } from "./broadcast-model";
import { recordUnit } from "./scoring";
import type { AudienceTab, Command, Game, Output } from "./types";
import ui from "./operator.module.css";

export function AudienceControls({
  output,
  now,
  busy,
  send,
}: {
  output: Output;
  now: number;
  busy: boolean;
  send: (command: Command) => Promise<boolean>;
}) {
  const { tab, game } = audienceView(output, now);
  const show = (nextTab: AudienceTab, nextGame: Game = game) =>
    void send({ type: "audience", tab: nextTab, game: nextGame });
  const tabs: [AudienceTab, string][] = [
    [
      "live",
      game === "shooting"
        ? "속도 · km/h"
        : `기록 · ${recordUnit(game, output.metric)}`,
    ],
    ["records", "팀별 기록순위"],
    ["scores", "종합 스코어"],
  ];
  return (
    <div className={ui.audienceControls}>
      <nav className={ui.audienceTabs} aria-label="관객 화면 선택">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            disabled={busy}
            aria-pressed={tab === key}
            onClick={() => show(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab !== "scores" && (
        <div className={ui.audienceGames} role="group" aria-label="출력할 종목">
          {(
            [
              ["shooting", "슈팅왕"],
              ["keepUp", "공 살리기"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              aria-pressed={game === key}
              onClick={() => show(tab, key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
