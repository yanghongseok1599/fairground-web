-- 경기 이벤트에 반칙(foul) 추가. 풋살 누적 파울(half당 5회 → 직접 프리킥) 기록용.
alter type match_event_t add value if not exists 'foul';
