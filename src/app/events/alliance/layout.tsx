import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "연합팀 이벤트 중계",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function AllianceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
