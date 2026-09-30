"use client";

import { AdminGuard } from "@/components/admin-guard";
import { AdminInspections } from "@/features/player-inspection/components/admin-inspections";

export default function AdminInspectionsPage() {
  return <AdminGuard allow={["admin"]}><AdminInspections /></AdminGuard>;
}
