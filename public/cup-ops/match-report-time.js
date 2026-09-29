// Clock values in the operating guide are local event times (HH:mm).
export const REPORT_LEAD_MINUTES = 5;

export function matchReportTime(startTime) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    throw new Error('경기 시작 시각은 HH:mm 형식이어야 합니다.');
  }
  const [hour, minute] = startTime.split(':').map(Number);
  const reportMinute = (hour * 60 + minute - REPORT_LEAD_MINUTES + 1440) % 1440;
  return `${String(Math.floor(reportMinute / 60)).padStart(2, '0')}:${String(reportMinute % 60).padStart(2, '0')}`;
}
