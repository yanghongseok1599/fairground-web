/* global taskSpace, FairgroundCardExport */
// Run inside ego-browser nodejs. Reuse one caller-owned TaskSpace across retries.
// Required env: FAIRGROUND_EXPORT_DIR, FAIRGROUND_EXPORT_BUNDLE, FAIRGROUND_EXPORT_SPACE.
const fs = await import("node:fs/promises");
const path = await import("node:path");
const output = process.env.FAIRGROUND_EXPORT_DIR;
const bundle = process.env.FAIRGROUND_EXPORT_BUNDLE;
const space = Number(process.env.FAIRGROUND_EXPORT_SPACE);
if (!output || !path.isAbsolute(output) || !bundle || !Number.isInteger(space) || space <= 0) throw new Error("내보내기 경로·브라우저 공간·번들을 지정하세요.");
const snapshot = JSON.parse(await fs.readFile(path.join(output, "source.json"), "utf8"));
const task = await taskSpace(space);
const page = task.page("p1");
await page.evaluate(await fs.readFile(bundle, "utf8"));
const jobs = await page.evaluate(({ players, teams }) => FairgroundCardExport.buildCardExportJobs(players, teams), snapshot);
const results = [];
for (const job of jobs) {
  const target = path.resolve(output, job.relativePath);
  if (!target.startsWith(path.resolve(output) + path.sep)) throw new Error("잘못된 저장 경로입니다.");
  try {
    await page.evaluate(job => FairgroundCardExport.prepareDownload(job), job);
    const href = await page.evaluate(() => document.getElementById("fairground-team-card-download").href);
    // The image was rendered in this Page; save its Blob without exposing PNG bytes in logs.
    await fs.mkdir(path.dirname(target), { recursive: true });
    await page.fetch(href, { saveAs: target });
    const png = await fs.readFile(target);
    if (png.subarray(1, 4).toString("ascii") !== "PNG" || png.readUInt32BE(16) !== 2160 || png.readUInt32BE(20) !== 2700 || png[25] !== 6) throw new Error("PNG 규격 검증 실패");
    results.push({ playerId: job.player.id, team: job.teamName, file: job.relativePath, status: "saved", registeredPhoto: job.hasRegisteredPhoto });
  } catch (error) {
    results.push({ playerId: job.player.id, team: job.teamName, file: job.relativePath, status: "failed", reason: String(error.message) });
  } finally {
    await page.evaluate(() => FairgroundCardExport.releaseDownload());
    await fs.writeFile(path.join(output, "export-results.json"), JSON.stringify({ fetchedAt: snapshot.fetchedAt, expected: jobs.length, results }, null, 2));
  }
  console.log(JSON.stringify({ completed: results.length, expected: jobs.length, saved: results.filter(r => r.status === "saved").length }));
}
if (results.some(r => r.status === "failed")) throw new Error("생성 실패 선수는 export-results.json을 확인하세요.");
// Caller verifies the artifacts and finishes this same TaskSpace exactly once.
