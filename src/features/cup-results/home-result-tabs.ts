import type { CupAward } from "./types";

export type HomeResultTab = "overview" | CupAward["id"] | "match-moms";

export const HOME_RESULT_TABS = [
  { id: "overview", label: "대회 결과" },
  { id: "top-scorer", label: "득점왕" },
  { id: "goalkeeper", label: "골레이로왕" },
  { id: "mens-mom", label: "남자 MOM" },
  { id: "womens-mom", label: "여자 MOM" },
  { id: "match-moms", label: "경기별 MOM" },
] as const satisfies readonly { id: HomeResultTab; label: string }[];

export const HOME_RESULTS_PANEL_ID = "home-cup-results-panel";
export const homeResultTabId = (id: HomeResultTab) => `home-cup-tab-${id}`;
