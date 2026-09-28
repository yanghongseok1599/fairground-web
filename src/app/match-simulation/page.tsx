import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "테스트 경기 시뮬레이션",
  robots: { index: false, follow: false },
};

export default function Page() {
  redirect("/live");
}
