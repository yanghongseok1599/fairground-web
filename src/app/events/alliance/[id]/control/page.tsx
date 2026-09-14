import { ControlPage } from "@/features/alliance-event/control-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ControlPage key={id} id={id} />;
}
