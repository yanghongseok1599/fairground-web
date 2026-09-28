import { renderBronzePlayerCard } from "./render";
import { buildCardExportJobs, type CardExportJob } from "./model";
export { buildCardExportJobs };

let activeUrl: string | null = null;
export function releaseDownload() {
  if (activeUrl) URL.revokeObjectURL(activeUrl);
  activeUrl = null;
  document.getElementById("fairground-team-card-download")?.remove();
}

export async function prepareDownload(job: CardExportJob) {
  releaseDownload();
  const blob = await renderBronzePlayerCard(job);
  activeUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.id = "fairground-team-card-download";
  link.href = activeUrl;
  link.download = job.relativePath.split("/").at(-1)!;
  link.textContent = `${job.player.name} 선수카드 저장`;
  Object.assign(link.style, { position: "fixed", left: "16px", top: "80px", zIndex: "99999", color: "black", background: "white", padding: "12px" });
  document.body.append(link);
  return { bytes: blob.size, path: job.relativePath };
}
