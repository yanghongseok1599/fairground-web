# 카카오 대회 도구

대회 상세 공유·경기장 검색·공식 채널 문의와 종료 경기 결과 공유를 관리한다.

- `components/`: 화면 버튼과 사용자 피드백
- `share.ts`: 카카오 SDK 공유, 미설정 시 기기 공유/내용 복사
- `links.ts`: 장소 검색, 채널 주소 검증, 경기 결과 앵커
- 공통 SDK 로더: `src/lib/kakao-sdk.ts`. 기존 선수 카드 공유와 함께 사용한다.

`NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`와 카카오 콘솔의 JavaScript 허용 도메인이 필요하다.
`NEXT_PUBLIC_KAKAO_CHANNEL_URL=https://pf.kakao.com/_채널ID`를 설정하면 문의 버튼을 표시한다. 공식 채널 주소가 없는 환경에서는 표시하지 않는다.
공유는 공식 사이트 주소를 사용한다. 실제 발송은 사용자가 카카오톡에서 대상을 선택해야 완료된다.
경기장 찾기는 장소명 검색 연결이며, 좌표가 없는 현재 데이터에서 특정 경기장이나 내비 목적지를 단정하지 않는다.
종료 경기만 공유하며 비공개 예정 대진은 공유 메시지에 넣지 않는다.

UI 참고: Lazyweb Fixtured Share event 및 Eventbrite 이벤트 정보/공유 사례.
https://www.lazyweb.com/flow/fixtured/share-event
https://www.lazyweb.com/company/eventbrite

검증: `node --experimental-strip-types tests/kakao-tools-links.test.ts`
