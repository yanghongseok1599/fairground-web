export type ResultImageData = { home: string; away: string; homeScore: number; awayScore: number; tournamentName: string; round: number; shootoutText?: string };

export function ResultImage({ result }: { result: ResultImageData }) {
  const teamStyle = { display: "flex", width: 320, justifyContent: "center", textAlign: "center" as const, fontSize: 42, lineHeight: 1.35, wordBreak: "break-all" as const };
  return <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0D1B2A", color: "white", padding: "54px 64px", fontFamily: "Paperlogy", fontWeight: 700 }}>
    <div style={{ display: "flex", justifyContent: "space-between", color: "#B9D4F4", fontSize: 26 }}><span>FAIRGROUND</span><span>경기 종료 · R{result.round}</span></div>
    <div style={{ display: "flex", fontSize: 32, marginTop: 28, maxHeight: 80, overflow: "hidden" }}>{result.tournamentName.slice(0, 65)}</div>
    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", gap: 22 }}>
      <div style={teamStyle}>{result.home.slice(0, 32)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 116, color: "#FFFFFF" }}><span>{result.homeScore}</span><span style={{ fontSize: 62, color: "#6B8AA9" }}>:</span><span>{result.awayScore}</span></div>
      <div style={teamStyle}>{result.away.slice(0, 32)}</div>
    </div>
    {result.shootoutText && <div style={{ display: "flex", justifyContent: "center", marginBottom: 22, fontSize: 28, color: "#B9D4F4" }}>{result.shootoutText}</div>}
    <div style={{ display: "flex", justifyContent: "center", fontSize: 22, color: "#B9D4F4" }}>최종 경기 결과 · fairground-kor.com</div>
  </div>;
}
