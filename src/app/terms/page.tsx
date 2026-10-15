import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal-document-view";
import { TERMS_DOCUMENT } from "@/content/legal/terms";

export const metadata: Metadata = { title: "이용약관", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <LegalDocumentView doc={TERMS_DOCUMENT} />;
}
