import { BroadcastPage } from "@/features/alliance-event/broadcast";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BroadcastPage key={id} id={id} />;
}
