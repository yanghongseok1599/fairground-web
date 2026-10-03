import { useId } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function parseShootoutScores(home: string, away: string): [number, number] | null {
  if (!/^\d{1,2}$/.test(home) || !/^\d{1,2}$/.test(away)) return null;
  const pair: [number, number] = [Number(home), Number(away)];
  return pair[0] !== pair[1] ? pair : null;
}

export function ShootoutInput({ homeName, awayName, homeValue, awayValue, onChange, onSave, disabled, saving, savedHome, savedAway, error }: {
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
}) {
  const id = useId();
  const scores = parseShootoutScores(homeValue, awayValue);
  const saved = scores && scores[0] === savedHome && scores[1] === savedAway;
  const winner = scores ? scores[0] > scores[1] ? homeName : awayName : null;
  return <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-slate-950" data-slot="shootout-input">
    <div>
      <p className="text-sm font-bold">승부차기 기록</p>
      <p className="mt-1 text-xs text-slate-600">승부차기가 끝나면 양 팀의 최종 성공 횟수를 입력하세요. 정규 경기 점수와 별도로 저장됩니다.</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
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
    {savedHome != null && savedAway != null && !saved && <p className="text-xs text-slate-600">현재 저장된 승부차기: {savedHome} : {savedAway}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button type="button" className="min-h-11 w-full" onClick={onSave} disabled={disabled || !scores || !!saved} aria-busy={saving}>
      {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />승부차기 저장 중…</> : saved ? "승부차기 저장 완료" : "승부차기 저장"}
    </Button>
  </div>;
}
