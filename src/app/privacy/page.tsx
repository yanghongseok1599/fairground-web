import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal-document-view";
import { PRIVACY_DOCUMENT } from "@/content/legal/privacy";

export const metadata: Metadata = { title: "개인정보처리방침", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return <LegalDocumentView doc={PRIVACY_DOCUMENT} />;
}
