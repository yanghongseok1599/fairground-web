"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShootoutAttemptPicker } from "./attempt-picker";
import { normalizeShootoutAttempts, sameShootoutAttempts, shootoutAttemptTotals, type ShootoutAttempts, type SavedShootoutAttempts } from "./attempts";

export function parseShootoutScores(home: string, away: string): [number, number] | null {
  if (!/^\d{1,2}$/.test(home) || !/^\d{1,2}$/.test(away)) return null;
  const pair: [number, number] = [Number(home), Number(away)];
  return pair[0] !== pair[1] ? pair : null;
}

export function ShootoutInput({ homeName, awayName, homeValue, awayValue, onChange, onSave, disabled, saving, savedHome, savedAway, error, attempts, onAttemptsChange, savedAttempts }: {
  homeName: string;
  awayName: string;
  homeValue: string;
  awayValue: string;
  onChange: (home: string, away: string) => void;
  onSave: () => void;
  disabled: boolean;
  saving: boolean;
  savedHome?: number | null;
  savedAway?: number | null;
  error?: string;
  attempts?: ShootoutAttempts;
  onAttemptsChange?: (attempts: ShootoutAttempts) => void;
  savedAttempts?: SavedShootoutAttempts;
}) {
  const id = useId();
  const scores = parseShootoutScores(homeValue, awayValue);
  const normalized = attempts ? normalizeShootoutAttempts(attempts) : null;
  const totals = attempts ? shootoutAttemptTotals(attempts) : null;
  const hasAttempt = normalized && normalized.home.length + normalized.away.length > 0;
  const saved = attempts ? sameShootoutAttempts(attempts, savedAttempts) : scores && scores[0] === savedHome && scores[1] === savedAway;
  const winner = scores ? scores[0] > scores[1] ? homeName : awayName : null;
  const changeAttempts = (next: ShootoutAttempts) => {
    onAttemptsChange?.(next);
    const [home, away] = shootoutAttemptTotals(next);
    onChange(String(home), String(away));
  };
  return <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-slate-950" data-slot="shootout-input">
    <div>
      <p className="text-sm font-bold">승부차기 기록</p>
      <p className="mt-1 text-xs text-slate-600">{attempts ? "차수별로 O(골) / X(노골)를 선택하고 저장하세요. 성공 횟수는 자동으로 합산됩니다." : "승부차기가 끝나면 양 팀의 최종 성공 횟수를 입력하세요. 정규 경기 점수와 별도로 저장됩니다."}</p>
    </div>
    {attempts ? <>
      <div className="grid gap-3 sm:grid-cols-2">
        <ShootoutAttemptPicker teamName={homeName} values={attempts.home} disabled={disabled || !onAttemptsChange} onChange={home => changeAttempts({ ...attempts, home })} />
        <ShootoutAttemptPicker teamName={awayName} values={attempts.away} disabled={disabled || !onAttemptsChange} onChange={away => changeAttempts({ ...attempts, away })} />
      </div>
      <p role="status" className="text-sm font-semibold">승부차기 O {totals![0]} : {totals![1]} · {saved ? "저장됨" : "저장 전"}</p>
      {!normalized && <p role="alert" className="text-xs text-red-700">앞선 차수의 빈칸부터 O/X를 선택하세요. 아직 차지 않은 마지막 차수는 비워둘 수 있습니다.</p>}
      <p className="text-xs text-slate-600">진행 중 동점도 저장할 수 있습니다. 승부차기가 끝나면 최종 기록을 확인하고 경기 종료를 눌러주세요.</p>
    </> : <><div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-home`} className="block text-xs font-semibold">{homeName}</label>
        <Input id={`${id}-home`} type="number" inputMode="numeric" min={0} max={99} step={1} value={homeValue} placeholder="성공 횟수" disabled={disabled} onChange={event => onChange(event.target.value, awayValue)} className="min-h-11 bg-white text-center text-xl font-bold" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-away`} className="block text-xs font-semibold">{awayName}</label>
        <Input id={`${id}-away`} type="number" inputMode="numeric" min={0} max={99} step={1} value={awayValue} placeholder="성공 횟수" disabled={disabled} onChange={event => onChange(homeValue, event.target.value)} className="min-h-11 bg-white text-center text-xl font-bold" />
      </div>
    </div>
    <p role="status" className="text-sm font-semibold">{winner ? `${winner} 승리 · 승부차기 ${scores![0]} : ${scores![1]}${saved ? " (저장됨)" : " (저장 전)"}` : "양 팀 성공 횟수가 달라야 승자를 확정할 수 있습니다."}</p>
    {onAttemptsChange && <div className="space-y-2 border-t border-blue-200 pt-2">
      {savedHome != null && savedAway != null && <p className="text-xs text-slate-600">기존 기록은 합계만 저장되어 있습니다. 차수별 O/X는 기록되어 있지 않습니다.</p>}
      <Button type="button" variant="outline" className="min-h-11 w-full bg-white" disabled={disabled} onClick={() => changeAttempts({ home: [null], away: [null] })}>차수별 O/X 기록 시작</Button>
    </div>}</>}
    {savedHome != null && savedAway != null && !saved && <p className="text-xs text-slate-600">현재 저장된 승부차기: {savedHome} : {savedAway}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button type="button" className="min-h-11 w-full" onClick={onSave} disabled={disabled || (attempts ? !hasAttempt || !onAttemptsChange : !scores) || !!saved} aria-busy={saving}>
      {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />승부차기 저장 중…</> : saved ? "승부차기 저장 완료" : "승부차기 저장"}
    </Button>
  </div>;
}
