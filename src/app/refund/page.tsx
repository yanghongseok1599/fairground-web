import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal-document-view";
import { REFUND_DOCUMENT } from "@/content/legal/refund";

export const metadata: Metadata = { title: "환불정책", alternates: { canonical: "/refund" } };

export default function RefundPage() {
  return <LegalDocumentView doc={REFUND_DOCUMENT} />;
}
