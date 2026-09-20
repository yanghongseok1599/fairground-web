import type { Metadata } from "next";
import { MatchSimulationPage } from "@/features/match-simulation/simulation-page";

export const metadata: Metadata = {
  title: "테스트 경기 시뮬레이션",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <MatchSimulationPage />;
}
