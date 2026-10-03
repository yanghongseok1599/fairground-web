import type { SavedShootoutAttempts } from "./attempts";

export function ShootoutAttemptsSummary({ homeName, awayName, attempts }: {
  homeName: string;
  awayName: string;
  attempts: SavedShootoutAttempts;
}) {
  return <div className="mt-1.5 space-y-1 text-xs" data-slot="shootout-attempts-summary">
    <p className="text-muted-foreground">O = 골 · X = 노골</p>
    {[{ name: homeName, values: attempts.home }, { name: awayName, values: attempts.away }].map((team, index) => <div key={index} className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold">{team.name}</span>
      {team.values.length === 0 ? <span className="text-muted-foreground">기록 전</span> : team.values.map((goal, i) => <span key={i} aria-label={`${team.name} ${i + 1}차 ${goal ? "골 O" : "노골 X"}`} className={`rounded border px-1.5 py-0.5 font-bold tabular-nums ${goal ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-red-700 bg-red-50 text-red-900"}`}>{i + 1}차 {goal ? "O" : "X"}</span>)}
    </div>)}
  </div>;
}
